// ============================================================
//  controllers/features/cryptoController.js
//  Crypto: Real-time market, buy, sell, margin, pay debt, portfolio
//  Ported from WA Bot crypto.js → Express controllers
// ============================================================

const axios = require("axios");
const db = require("../../config/database");
const { getUserGameData } = require("../userController");
const { parseBet, fmt } = require("../../utils/helpers");

// ── Coin List (Ticker → CoinGecko ID) ───────────────────────
const COIN_IDS = {
  btc: "bitcoin",
  eth: "ethereum",
  sol: "solana",
  bnb: "binancecoin",
  doge: "dogecoin",
  pepe: "pepe",
  shib: "shiba-inu",
  xrp: "ripple",
  ada: "cardano",
  trx: "tron",
};

const CACHE_TIME = 60 * 1000; // 1 minute cache

// ── Helper: save user data back to DB ────────────────────────
async function saveUser(username, userData, source) {
  const data = db.getData();
  if (source === "wa") {
    const webUsers = db.getWebUsers();
    const waId = webUsers[username]?.waId;
    if (waId) data.users[waId] = userData;
  } else {
    if (!data.webGameData) data.webGameData = {};
    data.webGameData[username] = userData;
  }
  await db.saveData(data);
}

// ── Core: Fetch market prices & run liquidation engine ───────
async function refreshMarket() {
  const data = db.getData();
  if (!data.market) data.market = { prices: {}, lastUpdate: 0 };
  const market = data.market;
  const now = Date.now();

  if (now - (market.lastUpdate || 0) > CACHE_TIME) {
    try {
      const ids = Object.values(COIN_IDS).join(",");
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=idr&include_24hr_change=true`;
      const response = await axios.get(url, { timeout: 10000 });
      const apiData = response.data;

      for (const [ticker, id] of Object.entries(COIN_IDS)) {
        if (apiData[id]) {
          market.prices[ticker] = {
            price: apiData[id].idr,
            change: apiData[id].idr_24h_change || 0,
          };
        }
      }
      market.lastUpdate = now;

      // ── Liquidation Engine ──────────────────────────────────
      // Check all users — if debt > 85% of total collateral, liquidate
      const users = db.getUsers();
      for (const userId of Object.keys(users)) {
        const u = users[userId];
        if ((u.debt || 0) > 0) {
          let totalAssetValue = 0;
          if (u.crypto) {
            for (const [k, v] of Object.entries(u.crypto)) {
              if (market.prices[k]) {
                totalAssetValue += v * market.prices[k].price;
              }
            }
          }
          const totalCollateral = totalAssetValue + (u.balance || 0);
          if (totalCollateral === 0 || u.debt > totalCollateral * 0.85) {
            console.log(
              `💀 LIQUIDATION: User ${u.name || userId} — debt exceeded 85% collateral`,
            );
            u.crypto = {};
            u.balance = 0;
            u.debt = 0;
          }
        }
      }

      // Also check webGameData users
      const webGameData = data.webGameData || {};
      for (const username of Object.keys(webGameData)) {
        const u = webGameData[username];
        if ((u.debt || 0) > 0) {
          let totalAssetValue = 0;
          if (u.crypto) {
            for (const [k, v] of Object.entries(u.crypto)) {
              if (market.prices[k]) {
                totalAssetValue += v * market.prices[k].price;
              }
            }
          }
          const totalCollateral = totalAssetValue + (u.balance || 0);
          if (totalCollateral === 0 || u.debt > totalCollateral * 0.85) {
            console.log(
              `💀 LIQUIDATION: WebUser ${username} — debt exceeded 85% collateral`,
            );
            u.crypto = {};
            u.balance = 0;
            u.debt = 0;
          }
        }
      }

      await db.saveData(data);
    } catch (error) {
      console.error("❌ Gagal update crypto market:", error.message);
      // Falls back to last cached prices
    }
  }

  return market;
}

// ══════════════════════════════════════════════════════════════
//  1. GET MARKET — Real-time prices
// ══════════════════════════════════════════════════════════════
async function getMarket(req, res) {
  try {
    const { username } = req.user;
    const { source, data: u } = getUserGameData(username);
    const market = await refreshMarket();

    const coins = [];
    for (const [ticker, id] of Object.entries(COIN_IDS)) {
      const d = market.prices?.[ticker];
      if (d) {
        coins.push({
          ticker,
          name: id,
          price: d.price,
          change: d.change,
        });
      }
    }

    res.json({
      success: true,
      coins,
      balance: Math.floor(u.balance || 0),
      debt: Math.floor(u.debt || 0),
      lastUpdate: market.lastUpdate || 0,
    });
  } catch (err) {
    console.error("getMarket error:", err);
    res
      .status(500)
      .json({ success: false, message: "Gagal ambil data market." });
  }
}

// ══════════════════════════════════════════════════════════════
//  2. BUY CRYPTO
// ══════════════════════════════════════════════════════════════
async function buyCrypto(req, res) {
  try {
    const { username } = req.user;
    const { source, data: u } = getUserGameData(username);
    const { coin, amount: rawAmount } = req.body;
    const koin = coin?.toLowerCase();

    if (!COIN_IDS[koin]) {
      return res.status(400).json({
        success: false,
        message: `❌ Koin tidak ada. List: ${Object.keys(COIN_IDS).join(", ")}`,
      });
    }

    const market = await refreshMarket();
    if (!market.prices?.[koin]) {
      return res.status(400).json({
        success: false,
        message: "❌ Data harga sedang loading... coba lagi.",
      });
    }

    const nominal = parseBet(rawAmount, u.balance);
    if (!nominal || nominal < 10000) {
      return res.status(400).json({
        success: false,
        message: "❌ Minimum pembelian Rp 10.000",
      });
    }
    if ((u.balance || 0) < nominal) {
      return res.status(400).json({
        success: false,
        message: `❌ Saldo tidak cukup. Saldo: Rp ${fmt(u.balance || 0)}`,
      });
    }

    const currentPrice = market.prices[koin].price;
    const fee = nominal * 0.001; // 0.1% fee
    const bersih = nominal - fee;
    const coinAmount = bersih / currentPrice;

    u.balance = (u.balance || 0) - nominal;
    if (!u.crypto) u.crypto = {};
    u.crypto[koin] = (u.crypto[koin] || 0) + coinAmount;
    await saveUser(username, u, source);

    res.json({
      success: true,
      message: `✅ BELI SUKSES! ${coinAmount.toFixed(8)} ${koin.toUpperCase()} @ Rp ${fmt(currentPrice)}`,
      coin: koin,
      amount: coinAmount,
      price: currentPrice,
      paid: nominal,
      fee: Math.floor(fee),
      balance: Math.floor(u.balance),
    });
  } catch (err) {
    console.error("buyCrypto error:", err);
    res.status(500).json({ success: false, message: "Gagal beli crypto." });
  }
}

// ══════════════════════════════════════════════════════════════
//  3. SELL CRYPTO
// ══════════════════════════════════════════════════════════════
async function sellCrypto(req, res) {
  try {
    const { username } = req.user;
    const { source, data: u } = getUserGameData(username);
    const { coin, amount: rawAmount } = req.body;
    const koin = coin?.toLowerCase();

    if (!u.crypto?.[koin] || u.crypto[koin] <= 0) {
      return res.status(400).json({
        success: false,
        message: "❌ Kamu tidak punya koin ini.",
      });
    }

    const market = await refreshMarket();
    if (!market.prices?.[koin]) {
      return res.status(400).json({
        success: false,
        message: "❌ Data harga sedang loading... coba lagi.",
      });
    }

    let amount;
    if (rawAmount === "all" || rawAmount === "semua") {
      amount = u.crypto[koin];
    } else {
      amount = parseFloat(rawAmount);
    }
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "❌ Jumlah jual tidak valid.",
      });
    }
    if (amount > u.crypto[koin]) amount = u.crypto[koin];

    const currentPrice = market.prices[koin].price;
    const gross = Math.floor(amount * currentPrice);

    // Progressive tax
    let taxRate = 0.002; // 0.2% standard
    if ((u.balance || 0) > 100_000_000_000_000) taxRate = 0.05; // 5% sultan tax

    const fee = Math.floor(gross * 0.01); // 1% trading fee
    const tax = Math.floor(gross * taxRate);
    const net = Math.floor(gross - fee - tax);

    u.crypto[koin] -= amount;
    if (u.crypto[koin] <= 0.00000001) delete u.crypto[koin];

    u.balance = (u.balance || 0) + net;
    u.dailyIncome = (u.dailyIncome || 0) + net;
    await saveUser(username, u, source);

    res.json({
      success: true,
      message: `✅ JUAL SUKSES! ${amount.toFixed(8)} ${koin.toUpperCase()} → Rp ${fmt(net)}`,
      coin: koin,
      amount,
      price: currentPrice,
      gross,
      fee,
      tax,
      net,
      balance: Math.floor(u.balance),
    });
  } catch (err) {
    console.error("sellCrypto error:", err);
    res.status(500).json({ success: false, message: "Gagal jual crypto." });
  }
}

// ══════════════════════════════════════════════════════════════
//  4. MARGIN BUY (Leverage)
// ══════════════════════════════════════════════════════════════
async function marginCrypto(req, res) {
  try {
    const { username } = req.user;
    const { source, data: u } = getUserGameData(username);
    const { coin, amount: rawAmount } = req.body;
    const koin = coin?.toLowerCase();

    if (!COIN_IDS[koin]) {
      return res.status(400).json({
        success: false,
        message: "❌ Koin tidak valid.",
      });
    }

    const nominal = parseBet(rawAmount, u.balance);
    if (!nominal || nominal < 100000) {
      return res.status(400).json({
        success: false,
        message: "❌ Minimum margin Rp 100.000",
      });
    }

    // Margin limit: 3x balance
    const maxLoan = (u.balance || 0) * 3;
    if ((u.debt || 0) + nominal > maxLoan) {
      return res.status(400).json({
        success: false,
        message: `❌ Limit margin mentok! Sisa limit: Rp ${fmt(maxLoan - (u.debt || 0))}`,
      });
    }

    const market = await refreshMarket();
    if (!market.prices?.[koin]) {
      return res.status(400).json({
        success: false,
        message: "❌ Data harga sedang loading... coba lagi.",
      });
    }

    const currentPrice = market.prices[koin].price;
    const coinAmount = nominal / currentPrice;

    u.debt = (u.debt || 0) + nominal;
    if (!u.crypto) u.crypto = {};
    u.crypto[koin] = (u.crypto[koin] || 0) + coinAmount;
    await saveUser(username, u, source);

    res.json({
      success: true,
      message: `⚠️ MARGIN BUY! Berhutang Rp ${fmt(nominal)} → ${coinAmount.toFixed(8)} ${koin.toUpperCase()}`,
      coin: koin,
      amount: coinAmount,
      price: currentPrice,
      borrowed: nominal,
      totalDebt: Math.floor(u.debt),
      balance: Math.floor(u.balance),
    });
  } catch (err) {
    console.error("marginCrypto error:", err);
    res.status(500).json({ success: false, message: "Gagal margin buy." });
  }
}

// ══════════════════════════════════════════════════════════════
//  5. PAY DEBT
// ══════════════════════════════════════════════════════════════
async function paydeptCrypto(req, res) {
  try {
    const { username } = req.user;
    const { source, data: u } = getUserGameData(username);
    const { amount: rawAmount } = req.body;

    if ((u.debt || 0) <= 0) {
      return res.status(400).json({
        success: false,
        message: "❌ Kamu tidak punya hutang.",
      });
    }

    let bayar;
    if (rawAmount === "all" || rawAmount === "semua" || !rawAmount) {
      bayar = Math.min(u.balance || 0, u.debt);
    } else {
      bayar = parseBet(rawAmount, u.balance);
    }

    if (!bayar || bayar <= 0) {
      return res.status(400).json({
        success: false,
        message: "❌ Jumlah tidak valid.",
      });
    }
    bayar = Math.min(bayar, u.debt);

    if ((u.balance || 0) < bayar) {
      return res.status(400).json({
        success: false,
        message: `❌ Saldo tidak cukup. Saldo: Rp ${fmt(u.balance || 0)}`,
      });
    }

    u.balance = (u.balance || 0) - bayar;
    u.debt = (u.debt || 0) - bayar;
    await saveUser(username, u, source);

    res.json({
      success: true,
      message: `✅ Hutang lunas Rp ${fmt(bayar)}. Sisa hutang: Rp ${fmt(u.debt)}`,
      paid: bayar,
      remainingDebt: Math.floor(u.debt),
      balance: Math.floor(u.balance),
    });
  } catch (err) {
    console.error("paydeptCrypto error:", err);
    res.status(500).json({ success: false, message: "Gagal bayar hutang." });
  }
}

// ══════════════════════════════════════════════════════════════
//  6. PORTFOLIO
// ══════════════════════════════════════════════════════════════
async function portofolioCrypto(req, res) {
  try {
    const { username } = req.user;
    const { source, data: u } = getUserGameData(username);
    const market = await refreshMarket();

    const holdings = [];
    let totalAsset = 0;

    if (u.crypto) {
      for (const [k, v] of Object.entries(u.crypto)) {
        if (v > 0 && market.prices?.[k]) {
          const value = Math.floor(v * market.prices[k].price);
          totalAsset += value;
          holdings.push({
            coin: k,
            amount: v,
            price: market.prices[k].price,
            change: market.prices[k].change || 0,
            value,
          });
        }
      }
    }

    const netWorth = totalAsset + (u.balance || 0) - (u.debt || 0);

    res.json({
      success: true,
      holdings,
      totalAsset: Math.floor(totalAsset),
      balance: Math.floor(u.balance || 0),
      debt: Math.floor(u.debt || 0),
      netWorth: Math.floor(netWorth),
    });
  } catch (err) {
    console.error("portofolioCrypto error:", err);
    res.status(500).json({ success: false, message: "Gagal ambil portfolio." });
  }
}

module.exports = {
  getMarket,
  buyCrypto,
  sellCrypto,
  marginCrypto,
  paydeptCrypto,
  portofolioCrypto,
  COIN_IDS,
};

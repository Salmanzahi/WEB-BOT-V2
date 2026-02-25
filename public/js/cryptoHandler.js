// ============================================================
//  public/js/cryptoHandler.js — Crypto Trading Frontend Logic
//  Handles all interaction with /api/features/crypto/* endpoints
// ============================================================

// ── Coin metadata (icons & names for UI) ─────────────────────
const COIN_META = {
  btc: { icon: "₿", name: "Bitcoin", color: "#f7931a" },
  eth: { icon: "⟠", name: "Ethereum", color: "#627eea" },
  sol: { icon: "◎", name: "Solana", color: "#9945ff" },
  bnb: { icon: "🔶", name: "Binance", color: "#f3ba2f" },
  doge: { icon: "🐕", name: "Dogecoin", color: "#c3a634" },
  pepe: { icon: "🐸", name: "Pepe", color: "#3a9d38" },
  shib: { icon: "🦊", name: "Shiba Inu", color: "#e45826" },
  xrp: { icon: "✕", name: "Ripple", color: "#0085c0" },
  ada: { icon: "🔵", name: "Cardano", color: "#0033ad" },
  trx: { icon: "🔻", name: "Tron", color: "#ff0013" },
};

// ── State ────────────────────────────────────────────────────
let marketData = []; // Array of { ticker, name, price, change }
let portfolioData = {}; // { holdings, totalAsset, balance, debt, netWorth }
let userBalance = 0;
let userDebt = 0;

// ── Format helpers ───────────────────────────────────────────
function fmtCrypto(n) {
  return Math.floor(Number(n) || 0).toLocaleString("id-ID");
}
function fmtCoin(n) {
  if (n >= 1) return Number(n).toFixed(4);
  if (n >= 0.001) return Number(n).toFixed(6);
  return Number(n).toFixed(8);
}
function timeAgo(ts) {
  if (!ts) return "belum pernah";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return "baru saja";
  if (diff < 60) return `${diff} detik lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  return `${Math.floor(diff / 3600)} jam lalu`;
}

// ══════════════════════════════════════════════════════════════
//  LOAD: Market Data
// ══════════════════════════════════════════════════════════════
async function loadMarket() {
  try {
    const r = await api.get("/features/crypto/market");
    if (!r || !r.success) {
      showToast("error", "Gagal memuat data market");
      return;
    }

    marketData = r.coins || [];
    userBalance = r.balance || 0;
    userDebt = r.debt || 0;
    console.log("loaded");
    // Update top bar
    document.getElementById("top-balance").textContent =
      "Rp " + fmtCrypto(userBalance);
    document.getElementById("stat-balance").textContent =
      "Rp " + fmtCrypto(userBalance);
    document.getElementById("stat-debt").textContent =
      "Rp " + fmtCrypto(userDebt);
    document.getElementById("last-update-text").textContent =
      "Live — " + timeAgo(r.lastUpdate);

    renderMarketTable();
    populateCoinSelects();
  } catch (e) {
    console.error("loadMarket error:", e);
    showToast("error", "Gagal memuat data market");
  }
}

// ══════════════════════════════════════════════════════════════
//  LOAD: Portfolio
// ══════════════════════════════════════════════════════════════
async function loadPortfolio() {
  try {
    const r = await api.get("/features/crypto/portfolio");
    if (!r || !r.success) return;

    portfolioData = r;
    userBalance = r.balance || 0;

    // Update stats
    document.getElementById("stat-asset").textContent =
      "Rp " + fmtCrypto(r.totalAsset);
    document.getElementById("stat-networth").textContent =
      "Rp " + fmtCrypto(r.netWorth);
    document.getElementById("stat-debt").textContent =
      "Rp " + fmtCrypto(r.debt);
    document.getElementById("stat-balance").textContent =
      "Rp " + fmtCrypto(r.balance);
    document.getElementById("top-balance").textContent =
      "Rp " + fmtCrypto(r.balance);

    // Portfolio tab content
    document.getElementById("porto-asset").textContent =
      "Rp " + fmtCrypto(r.totalAsset);
    document.getElementById("porto-cash").textContent =
      "Rp " + fmtCrypto(r.balance);
    document.getElementById("porto-debt").textContent =
      "Rp " + fmtCrypto(r.debt);
    document.getElementById("porto-net").textContent =
      "Rp " + fmtCrypto(r.netWorth);

    renderPortfolio(r.holdings || []);
    populateSellSelect(r.holdings || []);

    // Debt meter
    const debtMeter = document.getElementById("debt-meter");
    if (r.debt > 0) {
      debtMeter.style.display = "flex";
      document.getElementById("debt-display").textContent =
        "Rp " + fmtCrypto(r.debt);
    } else {
      debtMeter.style.display = "none";
    }
  } catch (e) {
    console.error("loadPortfolio error:", e);
  }
}

// ══════════════════════════════════════════════════════════════
//  RENDER: Market Table
// ══════════════════════════════════════════════════════════════
function renderMarketTable() {
  const tbody = document.getElementById("market-tbody");
  if (!marketData.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state"><div class="empty-icon">📡</div><div class="empty-text">Data market kosong</div></td></tr>`;
    return;
  }

  tbody.innerHTML = marketData
    .map((c) => {
      const meta = COIN_META[c.ticker] || {
        icon: "🪙",
        name: c.ticker,
        color: "#888",
      };
      const isUp = c.change >= 0;
      const changeClass = isUp ? "change-up" : "change-down";
      const arrow = isUp ? "▲" : "▼";
      const sign = isUp ? "+" : "";

      return `
      <tr>
        <td>
          <div class="coin-cell">
            <div class="coin-icon" style="color:${meta.color}">${meta.icon}</div>
            <div>
              <div class="coin-ticker">${c.ticker}</div>
              <div class="coin-name">${meta.name}</div>
            </div>
          </div>
        </td>
        <td><span class="price-val">Rp ${fmtCrypto(c.price)}</span></td>
        <td><span class="change-badge ${changeClass}">${arrow} ${sign}${c.change.toFixed(2)}%</span></td>
        <td>
          <div class="action-btn-group">
            <button class="action-btn buy" onclick="quickBuy('${c.ticker}')">Beli</button>
            <button class="action-btn sell" onclick="quickSell('${c.ticker}')">Jual</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

// ══════════════════════════════════════════════════════════════
//  RENDER: Portfolio Holdings
// ══════════════════════════════════════════════════════════════
function renderPortfolio(holdings) {
  const grid = document.getElementById("portfolio-grid");
  if (!holdings.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">💼</div><div class="empty-text">Portofolio kosong. Mulai beli crypto!</div></div>`;
    return;
  }

  grid.innerHTML = holdings
    .map((h) => {
      const meta = COIN_META[h.coin] || {
        icon: "🪙",
        name: h.coin,
        color: "#888",
      };
      const isUp = h.change >= 0;
      const changeClass = isUp ? "change-up" : "change-down";
      const sign = isUp ? "+" : "";

      return `
      <div class="holding-card">
        <div class="holding-header">
          <div class="holding-coin">
            <div class="h-icon" style="color:${meta.color}">${meta.icon}</div>
            <div class="h-ticker">${h.coin}</div>
          </div>
          <span class="change-badge ${changeClass}">${sign}${h.change.toFixed(2)}%</span>
        </div>
        <div class="holding-amount">${fmtCoin(h.amount)} ${h.coin.toUpperCase()}</div>
        <div class="holding-value">Rp ${fmtCrypto(h.value)}</div>
        <div class="holding-meta">
          Harga: Rp ${fmtCrypto(h.price)}<br>
          <button class="action-btn sell" style="margin-top:6px" onclick="quickSell('${h.coin}')">🔴 Jual</button>
        </div>
      </div>`;
    })
    .join("");
}

// ══════════════════════════════════════════════════════════════
//  POPULATE: Coin Selects
// ══════════════════════════════════════════════════════════════
function populateCoinSelects() {
  const buySelect = document.getElementById("buy-coin");
  const marginSelect = document.getElementById("margin-coin");

  const options = marketData
    .map((c) => {
      const meta = COIN_META[c.ticker] || { icon: "🪙", name: c.ticker };
      return `<option value="${c.ticker}">${meta.icon} ${c.ticker.toUpperCase()} — ${meta.name} (Rp ${fmtCrypto(c.price)})</option>`;
    })
    .join("");

  if (buySelect) buySelect.innerHTML = options;
  if (marginSelect) marginSelect.innerHTML = options;
}

function populateSellSelect(holdings) {
  const sellSelect = document.getElementById("sell-coin");
  if (!sellSelect) return;

  if (!holdings.length) {
    sellSelect.innerHTML = `<option disabled>Tidak ada koin</option>`;
    return;
  }

  sellSelect.innerHTML = holdings
    .map((h) => {
      const meta = COIN_META[h.coin] || { icon: "🪙", name: h.coin };
      return `<option value="${h.coin}" data-amount="${h.amount}">${meta.icon} ${h.coin.toUpperCase()} — ${fmtCoin(h.amount)} (≈Rp ${fmtCrypto(h.value)})</option>`;
    })
    .join("");
}

// ══════════════════════════════════════════════════════════════
//  ACTIONS: Buy / Sell / Margin / Pay Debt
// ══════════════════════════════════════════════════════════════
async function doBuy() {
  const coin = document.getElementById("buy-coin").value;
  const amountInput = document.getElementById("buy-amount").value;
  const amount = amountInput === "all" ? "all" : parseInt(amountInput);

  if (!coin) return showToast("error", "Pilih koin dulu!");
  if (!amount && amount !== "all")
    return showToast("error", "Masukkan jumlah!");

  const btn = document.getElementById("btn-buy");
  btn.disabled = true;
  btn.textContent = "⏳ Memproses...";

  try {
    const r = await api.post("/features/crypto/buy", { coin, amount });
    if (r?.success) {
      showToast("success", r.message);
      await reloadAll();
    } else {
      showToast("error", r?.message || "Gagal beli crypto");
    }
  } catch (e) {
    showToast("error", "Gagal beli crypto");
  } finally {
    btn.disabled = false;
    btn.textContent = "🟢 Beli Sekarang";
  }
}

async function doSell() {
  const coin = document.getElementById("sell-coin").value;
  const amount = document.getElementById("sell-amount").value;

  if (!coin) return showToast("error", "Pilih koin dulu!");
  if (!amount) return showToast("error", "Masukkan jumlah!");

  const btn = document.getElementById("btn-sell");
  btn.disabled = true;
  btn.textContent = "⏳ Memproses...";

  try {
    const r = await api.post("/features/crypto/sell", { coin, amount });
    if (r?.success) {
      showToast("success", r.message);
      await reloadAll();
    } else {
      showToast("error", r?.message || "Gagal jual crypto");
    }
  } catch (e) {
    showToast("error", "Gagal jual crypto");
  } finally {
    btn.disabled = false;
    btn.textContent = "🔴 Jual Sekarang";
  }
}

async function doMargin() {
  const coin = document.getElementById("margin-coin").value;
  const amount = parseInt(document.getElementById("margin-amount").value);

  if (!coin) return showToast("error", "Pilih koin dulu!");
  if (!amount || amount < 100000)
    return showToast("error", "Min margin Rp 100.000");

  if (
    !confirm(
      `⚠️ MARGIN BUY — Kamu akan berhutang Rp ${fmtCrypto(amount)} untuk beli ${coin.toUpperCase()}.\n\nJika harga turun drastis, semua asetmu bisa disita.\n\nLanjutkan?`,
    )
  )
    return;

  const btn = document.getElementById("btn-margin");
  btn.disabled = true;
  btn.textContent = "⏳ Memproses...";

  try {
    const r = await api.post("/features/crypto/margin", { coin, amount });
    if (r?.success) {
      showToast("success", r.message);
      await reloadAll();
    } else {
      showToast("error", r?.message || "Gagal margin buy");
    }
  } catch (e) {
    showToast("error", "Gagal margin buy");
  } finally {
    btn.disabled = false;
    btn.textContent = "⚡ Margin Buy";
  }
}

async function doPayDebt() {
  const amount = prompt(
    "Masukkan jumlah bayar hutang (Rp), atau kosongkan untuk bayar semua:",
  );

  try {
    const r = await api.post("/features/crypto/paydebt", {
      amount: amount ? parseInt(amount) : "all",
    });
    if (r?.success) {
      showToast("success", r.message);
      await reloadAll();
    } else {
      showToast("error", r?.message || "Gagal bayar hutang");
    }
  } catch (e) {
    showToast("error", "Gagal bayar hutang");
  }
}

// ══════════════════════════════════════════════════════════════
//  QUICK ACTIONS (from market table buttons)
// ══════════════════════════════════════════════════════════════
function quickBuy(ticker) {
  switchTab("buy");
  const select = document.getElementById("buy-coin");
  if (select) select.value = ticker;
  document.getElementById("buy-amount").focus();
}

function quickSell(ticker) {
  switchTab("sell");
  // Ensure portfolio is loaded for sell select
  loadPortfolio().then(() => {
    const select = document.getElementById("sell-coin");
    if (select) select.value = ticker;
    document.getElementById("sell-amount").focus();
  });
}

// ══════════════════════════════════════════════════════════════
//  HELPERS: Amount shortcuts
// ══════════════════════════════════════════════════════════════
function setAmount(type, val) {
  const input = document.getElementById(`${type}-amount`);
  if (!input) return;

  if (val === "all") {
    input.value = userBalance;
  } else {
    input.value = val;
  }
  updatePreview(type);
}

function setSellPct(pct) {
  const select = document.getElementById("sell-coin");
  const input = document.getElementById("sell-amount");
  if (!select || !input) return;

  const option = select.selectedOptions[0];
  if (!option) return;

  const totalAmount = parseFloat(option.dataset.amount || 0);
  if (pct === 100) {
    input.value = "all";
  } else {
    input.value = ((totalAmount * pct) / 100).toFixed(8);
  }
}

function updatePreview(type) {
  const coin = document.getElementById(`${type}-coin`)?.value;
  const amount = parseFloat(
    document.getElementById(`${type}-amount`)?.value || 0,
  );
  const previewEl = document.getElementById(`${type}-preview`);
  if (!previewEl || !coin || !amount) {
    if (previewEl) previewEl.textContent = "";
    return;
  }

  const coinData = marketData.find((c) => c.ticker === coin);
  if (!coinData) return;

  if (type === "buy") {
    const fee = amount * 0.001;
    const net = amount - fee;
    const coinAmount = net / coinData.price;
    previewEl.innerHTML = `💡 Kamu akan dapat ≈ <b>${fmtCoin(coinAmount)} ${coin.toUpperCase()}</b> (Fee: Rp ${fmtCrypto(fee)})`;
  } else if (type === "margin") {
    const coinAmount = amount / coinData.price;
    previewEl.innerHTML = `💡 Kamu akan dapat ≈ <b>${fmtCoin(coinAmount)} ${coin.toUpperCase()}</b> dengan hutang Rp ${fmtCrypto(amount)}`;
  }
}

// ══════════════════════════════════════════════════════════════
//  TAB NAVIGATION
// ══════════════════════════════════════════════════════════════
function switchTab(tab) {
  const tabs = ["market", "buy", "sell", "margin", "portfolio"];
  tabs.forEach((t) => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (el) el.classList.toggle("hidden", t !== tab);
    if (btn) btn.classList.toggle("active", t === tab);
  });

  // Load portfolio data when switching to portfolio or sell tab
  if (tab === "portfolio" || tab === "sell") {
    loadPortfolio();
  }
}

// ══════════════════════════════════════════════════════════════
//  RELOAD ALL
// ══════════════════════════════════════════════════════════════
async function reloadAll() {
  await Promise.all([loadMarket(), loadPortfolio()]);
}

// ══════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  // Guard: require login
  if (!requireLogin()) return;

  // Initial load
  reloadAll();

  // Auto-refresh every 60 seconds (matches backend cache)
  setInterval(loadMarket, 60000);
  setInterval(loadPortfolio, 60000);

  // Preview updates on input change
  const buyAmountEl = document.getElementById("buy-amount");
  const buyCoinEl = document.getElementById("buy-coin");
  const marginAmountEl = document.getElementById("margin-amount");
  const marginCoinEl = document.getElementById("margin-coin");

  if (buyAmountEl)
    buyAmountEl.addEventListener("input", () => updatePreview("buy"));
  if (buyCoinEl)
    buyCoinEl.addEventListener("change", () => updatePreview("buy"));
  if (marginAmountEl)
    marginAmountEl.addEventListener("input", () => updatePreview("margin"));
  if (marginCoinEl)
    marginCoinEl.addEventListener("change", () => updatePreview("margin"));
});

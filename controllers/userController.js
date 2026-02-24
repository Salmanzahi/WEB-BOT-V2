// ============================================================
//  controllers/userController.js
// ============================================================

const db      = require('../config/database');
const { fmt, bar, createDefaultUserData } = require('../utils/helpers');
const { PROPERTY_PRICES, PROPERTY_INCOME, MINING_RIGS, MINING_INCOME_PER_HASH_PER_HOUR } = require('../utils/constants');

/**
 * Ambil data game user (dari WA bot atau data web baru)
 * Urutan prioritas: waData (WA bot lama) > webGameData
 * Normalisasi key legacy WA: miningRigs->rigs, property->properties, ternak->animals
 */
function getUserGameData(username) {
    const webUsers    = db.getWebUsers();
    const webUser     = webUsers[username];
    const data        = db.getData();

    if (webUser?.waId) {
        const waData = db.getUsers()[webUser.waId];
        if (waData) {
            const normalized = { ...waData };
            if (normalized.miningRigs != null && !normalized.rigs) normalized.rigs = Array.isArray(normalized.miningRigs) ? normalized.miningRigs : [normalized.miningRigs];
            if (normalized.property != null && !normalized.properties) normalized.properties = Array.isArray(normalized.property) ? normalized.property : [normalized.property];
            if (normalized.ternak != null && !normalized.animals) normalized.animals = Array.isArray(normalized.ternak) ? normalized.ternak : [normalized.ternak];
            return { source: 'wa', data: normalized };
        }
    }

    if (!data.webGameData) data.webGameData = {};
    if (!data.webGameData[username]) {
        data.webGameData[username] = createDefaultUserData(username);
    }
    return { source: 'web', data: data.webGameData[username] };
}

/**
 * GET /api/user/profile
 */
async function getProfile(req, res) {
    try {
        const { username } = req.user;
        const { source, data: u } = getUserGameData(username);

        // Hitung net worth
        let netWorth = (u.balance || 0) + (u.bank || 0);
        for (const prop of (u.properties || [])) {
            netWorth += PROPERTY_PRICES[prop] || 0;
        }
        for (const rig of (u.rigs || [])) {
            netWorth += MINING_RIGS[rig]?.price || 0;
        }

        res.json({
            success: true,
            source,   // 'wa' = data dari WA bot, 'web' = data baru
            profile: {
                name:      u.name || u.webUsername || username,
                username,
                level:     u.level   || 1,
                xp:        u.xp      || 0,
                hp:        Math.floor(u.hp      ?? 100),
                hunger:    Math.floor(u.hunger  ?? 100),
                energy:    Math.floor(u.energy  ?? 100),
                balance:   Math.floor(u.balance || 0),
                bank:      Math.floor(u.bank    || 0),
                job:       u.job || null,
                sleeping:  !!u.sleeping,
                sleepUntil:u.sleepUntil || null,
                dead:      (u.hp || 100) <= 0,
                netWorth:  Math.floor(netWorth),
                inv:       u.inv || [],
                buffs:     u.buffs || {},
                createdAt: u.createdAt || null,
                lastActive:u.lastActive || null,
            }
        });
    } catch (err) {
        console.error('getProfile error:', err);
        res.status(500).json({ success: false, message: 'Gagal ambil profil.' });
    }
}

/**
 * GET /api/user/leaderboard?type=balance|networth|level
 */
async function getLeaderboard(req, res) {
    try {
        const type     = req.query.type || 'balance';
        const data     = db.getData();
        const webUsers = db.getWebUsers();

        const entries = [];

        // Dari WA users
        for (const [waId, u] of Object.entries(db.getUsers())) {
            // Cari username web jika ada
            const webUsername = Object.keys(webUsers).find(u2 => webUsers[u2].waId === waId) || waId;
            entries.push({ username: webUsername, balance: u.balance || 0, level: u.level || 1, xp: u.xp || 0 });
        }

        // Dari web game data (yang tidak punya waId)
        for (const [username, u] of Object.entries(data.webGameData || {})) {
            if (!webUsers[username]?.waId) {
                entries.push({ username, balance: u.balance || 0, level: u.level || 1, xp: u.xp || 0 });
            }
        }

        const sortKey = type === 'level' ? 'level' : 'balance';
        entries.sort((a, b) => b[sortKey] - a[sortKey]);

        res.json({ success: true, leaderboard: entries.slice(0, 20) });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Gagal ambil leaderboard.' });
    }
}

/**
 * GET /api/user/list — Daftar semua user (admin only)
 */
async function getAllUsers(req, res) {
    try {
        const webUsers = db.getWebUsers();
        const list = Object.entries(webUsers).map(([username, u]) => ({
            username,
            role:     u.role,
            banned:   u.banned || false,
            bannedUntil: u.bannedUntil || null,
            waId:     u.waId || null,
            createdAt:u.createdAt || null,
        }));
        res.json({ success: true, users: list });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Gagal ambil daftar user.' });
    }
}

module.exports = { getProfile, getLeaderboard, getAllUsers, getUserGameData };

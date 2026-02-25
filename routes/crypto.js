// ============================================================
//  routes/crypto.js — Standalone crypto routes (legacy)
//  Note: Main crypto routes are registered in routes/features.js
//        under /api/features/crypto/*
//  This file exists for backward compatibility if mounted separately.
// ============================================================

const router = require("express").Router();
const ctrl = require("../controllers/features/cryptoController");
const { requireAuth } = require("../middleware/auth");
const { gameLimiter } = require("../middleware/rateLimiter");
const { externalApiLimiter } = require("../middleware/rateLimiter");

// Semua route membutuhkan login
router.use(requireAuth);

// Fetch realtime market
router.get("/market", externalApiLimiter, ctrl.getMarket);
router.post("/buy", gameLimiter, ctrl.buyCrypto);
router.post("/sell", gameLimiter, ctrl.sellCrypto);
router.post("/margin", gameLimiter, ctrl.marginCrypto);
router.post("/paydebt", gameLimiter, ctrl.paydeptCrypto);
router.get("/portfolio", ctrl.portofolioCrypto);

module.exports = router;

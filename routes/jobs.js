// ============================================================
//  routes/jobs.js — Jobs (Profesi & Karir)
//  Note: Main jobs routes are registered in routes/features.js
//        under /api/features/jobs/*
//  This file is kept as a reference / alternative mounting point.
// ============================================================

const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const { gameLimiter } = require("../middleware/rateLimiter");
const ctrl = require("../controllers/features/jobsController");

router.use(requireAuth);

router.get("/", ctrl.getStatus);
router.post("/apply", gameLimiter, ctrl.apply);
router.post("/resign", gameLimiter, ctrl.resign);
router.post("/work", gameLimiter, ctrl.work);
router.post("/skill", gameLimiter, ctrl.useSkill);

module.exports = router;

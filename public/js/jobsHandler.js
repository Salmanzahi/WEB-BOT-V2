// ============================================================
//  public/js/jobsHandler.js — Jobs (Profesi & Karir) Frontend
//  Handles all interaction with /api/features/jobs/* endpoints
// ============================================================

// ── State ────────────────────────────────────────────────────
let currentJob = null;
let jobsList = [];
let userBalance = 0;

// ── Format helpers ───────────────────────────────────────────
function fmtJobs(n) {
  return Math.floor(Number(n) || 0).toLocaleString("id-ID");
}

function fmtTimeLeft(ms) {
  if (ms <= 0) return "Siap!";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}j ${m}m ${s}d`;
  if (m > 0) return `${m}m ${s}d`;
  return `${s}d`;
}

// ══════════════════════════════════════════════════════════════
//  LOAD: Jobs Status
// ══════════════════════════════════════════════════════════════
async function loadJobs() {
  try {
    const r = await api.get("/features/jobs");
    if (!r || !r.success) {
      showToast("error", "Gagal memuat data profesi");
      return;
    }

    currentJob = r.currentJob;
    jobsList = r.jobs || [];
    userBalance = r.balance || 0;

    // Update balance display
    const balEl = document.getElementById("jobs-balance");
    if (balEl) balEl.textContent = "Rp " + fmtJobs(userBalance);

    renderCurrentJob();
    renderJobsList();
    updateActionButtons();
  } catch (e) {
    console.error("loadJobs error:", e);
    showToast("error", "Gagal memuat data profesi");
  }
}

// ══════════════════════════════════════════════════════════════
//  RENDER: Current Job Status
// ══════════════════════════════════════════════════════════════
function renderCurrentJob() {
  const container = document.getElementById("current-job");
  if (!container) return;

  if (!currentJob) {
    container.innerHTML = `
      <div class="job-status-card unemployed">
        <div class="job-status-icon">😔</div>
        <div class="job-status-info">
          <h3>Pengangguran</h3>
          <p>Kamu belum punya pekerjaan. Pilih profesi di bawah untuk memulai karir!</p>
        </div>
      </div>`;
    return;
  }

  const workReady = currentJob.canWork;
  const skillReady = currentJob.canSkill;

  container.innerHTML = `
    <div class="job-status-card employed">
      <div class="job-status-header">
        <div class="job-status-icon">${getJobEmoji(currentJob.code)}</div>
        <div class="job-status-info">
          <h3>${currentJob.role}</h3>
          <p class="job-desc">${currentJob.desc}</p>
        </div>
      </div>
      <div class="job-stats-row">
        <div class="job-stat">
          <span class="job-stat-label">💰 Gaji</span>
          <span class="job-stat-value">Rp ${fmtJobs(currentJob.salary)}</span>
        </div>
        <div class="job-stat">
          <span class="job-stat-label">⏱️ Interval</span>
          <span class="job-stat-value">${currentJob.cooldown} menit</span>
        </div>
        <div class="job-stat">
          <span class="job-stat-label">⚒️ Kerja</span>
          <span class="job-stat-value ${workReady ? "ready" : "cooldown"}" id="work-timer">
            ${workReady ? "✅ Siap!" : "⏳ " + fmtTimeLeft(currentJob.workTimeLeft)}
          </span>
        </div>
        <div class="job-stat">
          <span class="job-stat-label">🌟 Skill</span>
          <span class="job-stat-value ${skillReady ? "ready" : "cooldown"}" id="skill-timer">
            ${skillReady ? "✅ Siap!" : "⏳ " + fmtTimeLeft(currentJob.skillTimeLeft)}
          </span>
        </div>
      </div>
      <div class="job-actions">
        <button class="btn btn-primary" id="btn-work" onclick="doWork()" ${!workReady ? "disabled" : ""}>
          ⚒️ Kerja Sekarang
        </button>
        <button class="btn btn-success" id="btn-skill" onclick="doSkill()" ${!skillReady ? "disabled" : ""}>
          🌟 Gunakan Skill
        </button>
        <button class="btn btn-danger btn-sm" id="btn-resign" onclick="doResign()">
          🚪 Resign
        </button>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
//  RENDER: Available Jobs List
// ══════════════════════════════════════════════════════════════
function renderJobsList() {
  const container = document.getElementById("jobs-list");
  if (!container) return;

  if (!jobsList.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Tidak ada lowongan tersedia</div></div>`;
    return;
  }

  container.innerHTML = jobsList
    .map((j) => {
      const canAfford = userBalance >= j.cost;
      const isCurrentJob = j.isCurrentJob;
      const hasJob = currentJob !== null;

      let statusBadge = "";
      if (isCurrentJob) {
        statusBadge = `<span class="job-badge current">✅ Profesimu</span>`;
      } else if (!canAfford) {
        statusBadge = `<span class="job-badge locked">🔒 Kurang Dana</span>`;
      }

      return `
      <div class="job-card ${isCurrentJob ? "current" : ""} ${!canAfford && !isCurrentJob ? "locked" : ""}">
        <div class="job-card-header">
          <div class="job-card-icon">${getJobEmoji(j.code)}</div>
          <div class="job-card-title">
            <h4>${j.role}</h4>
            ${statusBadge}
          </div>
        </div>
        <div class="job-card-body">
          <p class="job-card-desc">${j.desc}</p>
          <div class="job-card-details">
            <div class="job-detail">
              <span class="detail-label">💸 Biaya Masuk</span>
              <span class="detail-value">Rp ${fmtJobs(j.cost)}</span>
            </div>
            <div class="job-detail">
              <span class="detail-label">💵 Gaji</span>
              <span class="detail-value">Rp ${fmtJobs(j.salary)}</span>
            </div>
            <div class="job-detail">
              <span class="detail-label">⏱️ Cooldown</span>
              <span class="detail-value">${j.cooldown} menit</span>
            </div>
            <div class="job-detail">
              <span class="detail-label">💰 Gaji/Jam</span>
              <span class="detail-value">Rp ${fmtJobs((j.salary / j.cooldown) * 60)}</span>
            </div>
          </div>
          <div class="job-card-skill">
            <span class="skill-label">🌟 Skill:</span> ${j.skillDesc}
          </div>
        </div>
        <div class="job-card-footer">
          ${
            isCurrentJob
              ? `<button class="btn btn-secondary btn-block" disabled>✅ Profesi Saat Ini</button>`
              : hasJob
                ? `<button class="btn btn-secondary btn-block" disabled>🔒 Resign dulu</button>`
                : canAfford
                  ? `<button class="btn btn-primary btn-block" onclick="doApply('${j.code}')">✍️ Lamar Sekarang</button>`
                  : `<button class="btn btn-secondary btn-block" disabled>🔒 Butuh Rp ${fmtJobs(j.cost)}</button>`
          }
        </div>
      </div>`;
    })
    .join("");
}

// ══════════════════════════════════════════════════════════════
//  ACTIONS: Apply / Resign / Work / Skill
// ══════════════════════════════════════════════════════════════
async function doApply(jobCode) {
  const job = jobsList.find((j) => j.code === jobCode);
  if (!job) return;

  if (
    !confirm(
      `✍️ Melamar sebagai ${job.role}\n\n💸 Biaya sertifikasi: Rp ${fmtJobs(job.cost)}\n💵 Gaji: Rp ${fmtJobs(job.salary)} / ${job.cooldown} menit\n\nLanjutkan?`,
    )
  )
    return;

  try {
    const r = await api.post("/features/jobs/apply", { job: jobCode });
    if (r?.success) {
      showToast("success", r.message);
      await loadJobs();
    } else {
      showToast("error", r?.message || "Gagal melamar kerja");
    }
  } catch (e) {
    showToast("error", "Gagal melamar kerja");
  }
}

async function doResign() {
  if (!currentJob) return;
  if (
    !confirm(
      `🚪 Kamu yakin ingin resign dari ${currentJob.role}?\n\nKamu tidak akan mendapat refund biaya sertifikasi.`,
    )
  )
    return;

  try {
    const r = await api.post("/features/jobs/resign");
    if (r?.success) {
      showToast("success", r.message);
      await loadJobs();
    } else {
      showToast("error", r?.message || "Gagal resign");
    }
  } catch (e) {
    showToast("error", "Gagal resign");
  }
}

async function doWork() {
  const btn = document.getElementById("btn-work");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Bekerja...";
  }

  try {
    const r = await api.post("/features/jobs/work");
    if (r?.success) {
      showToast("success", r.message);
      await loadJobs();
    } else {
      showToast("error", r?.message || "Gagal kerja");
    }
  } catch (e) {
    showToast("error", "Gagal kerja");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "⚒️ Kerja Sekarang";
    }
  }
}

async function doSkill() {
  const btn = document.getElementById("btn-skill");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Menggunakan skill...";
  }

  try {
    const r = await api.post("/features/jobs/skill");
    if (r?.success) {
      showToast("success", r.message);
      await loadJobs();
    } else {
      showToast("error", r?.message || "Gagal menggunakan skill");
    }
  } catch (e) {
    showToast("error", "Gagal menggunakan skill");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🌟 Gunakan Skill";
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════
function getJobEmoji(code) {
  const map = {
    petani: "🌾",
    peternak: "🤠",
    polisi: "👮",
  };
  return map[code] || "💼";
}

function updateActionButtons() {
  const workSection = document.getElementById("work-actions");
  const skillSection = document.getElementById("skill-actions");
  if (workSection) workSection.style.display = currentJob ? "block" : "none";
  if (skillSection) skillSection.style.display = currentJob ? "block" : "none";
}

// ── Cooldown timer (live countdown) ─────────────────────────
let timerInterval = null;

function startTimers() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (!currentJob) return;

    const now = Date.now();

    // Work timer
    const workEl = document.getElementById("work-timer");
    const btnWork = document.getElementById("btn-work");
    if (workEl && currentJob.workTimeLeft > 0) {
      currentJob.workTimeLeft -= 1000;
      if (currentJob.workTimeLeft <= 0) {
        currentJob.canWork = true;
        workEl.textContent = "✅ Siap!";
        workEl.className = "job-stat-value ready";
        if (btnWork) btnWork.disabled = false;
      } else {
        workEl.textContent = "⏳ " + fmtTimeLeft(currentJob.workTimeLeft);
      }
    }

    // Skill timer
    const skillEl = document.getElementById("skill-timer");
    const btnSkill = document.getElementById("btn-skill");
    if (skillEl && currentJob.skillTimeLeft > 0) {
      currentJob.skillTimeLeft -= 1000;
      if (currentJob.skillTimeLeft <= 0) {
        currentJob.canSkill = true;
        skillEl.textContent = "✅ Siap!";
        skillEl.className = "job-stat-value ready";
        if (btnSkill) btnSkill.disabled = false;
      } else {
        skillEl.textContent = "⏳ " + fmtTimeLeft(currentJob.skillTimeLeft);
      }
    }
  }, 1000);
}

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  if (!requireLogin()) return;

  loadJobs().then(() => startTimers());

  // Auto-refresh every 60 seconds
  setInterval(loadJobs, 60000);
});

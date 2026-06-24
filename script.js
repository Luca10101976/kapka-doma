// ── Helpers ──────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10);

function daysBetween(dateStr) {
  if (!dateStr) return Infinity;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / 86400000);
}

function loadState() {
  try { return JSON.parse(localStorage.getItem("kyticky_v2") || "{}"); }
  catch { return {}; }
}
function saveState() { localStorage.setItem("kyticky_v2", JSON.stringify(state)); }

// state: { lastWatered: { id: "YYYY-MM-DD" }, streak: { lastDay, count } }
let state = loadState();
if (!state.lastWatered) state.lastWatered = {};
if (!state.streak) state.streak = { lastDay: null, count: 0 };

// ── Card helpers ──────────────────────────────────────────────────────────────
function cardId(card) {
  const skip = new Set(["room-card", "wide", "is-watered", "is-due", "turtle-card"]);
  return [...card.classList].find((c) => !skip.has(c));
}

function hasStarted(card) {
  if (!card.dataset.start) return true;
  return TODAY >= card.dataset.start;
}

function daysUntilStart(card) {
  if (!card.dataset.start) return 0;
  const ms = new Date(card.dataset.start).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function isDue(card) {
  if (!hasStarted(card)) return false;
  const id = cardId(card);
  const freq = parseInt(card.dataset.freq, 10);
  return daysBetween(state.lastWatered[id]) >= freq;
}

function daysUntilNext(card) {
  const id = cardId(card);
  const freq = parseInt(card.dataset.freq, 10);
  const since = daysBetween(state.lastWatered[id]);
  return Math.max(0, freq - since);
}

function wateredToday(card) {
  const id = cardId(card);
  return state.lastWatered[id] === TODAY;
}

// ── Animations ───────────────────────────────────────────────────────────────
function spawnDrops(card) {
  const phone = card.closest(".phone");
  const pr = phone.getBoundingClientRect();
  const cr = card.getBoundingClientRect();
  const cx = cr.left - pr.left + cr.width / 2;
  const cy = cr.top - pr.top + cr.height / 2;
  for (let i = 0; i < 7; i++) {
    const d = document.createElement("span");
    d.className = "water-drop";
    d.textContent = "💧";
    d.style.cssText = `left:${cx}px;top:${cy}px;--dx:${(Math.random() - 0.5) * 80}px;--dy:${-(30 + Math.random() * 50)}px`;
    phone.appendChild(d);
    setTimeout(() => d.remove(), 800);
  }
}

function spawnConfetti(card) {
  const colors = ["#ff9aa9", "#ffd36c", "#7cbde9", "#b7f2d5", "#ffb7c7"];
  const phone = card.closest(".phone");
  const pr = phone.getBoundingClientRect();
  const cr = card.getBoundingClientRect();
  const cx = cr.left - pr.left + cr.width / 2;
  const cy = cr.top - pr.top + cr.height / 2;
  for (let i = 0; i < 18; i++) {
    const b = document.createElement("span");
    b.className = "confetti-bit";
    b.style.cssText = `left:${cx}px;top:${cy}px;background:${colors[i % colors.length]};--dx:${(Math.random() - 0.5) * 120}px;--dy:${-(40 + Math.random() * 80)}px;--rot:${Math.random() * 720}deg`;
    phone.appendChild(b);
    setTimeout(() => b.remove(), 900);
  }
}

// ── Streak ───────────────────────────────────────────────────────────────────
function allDueCards() {
  return [...document.querySelectorAll("[data-room],[data-task]")].filter(isDue);
}

function checkStreak() {
  if (allDueCards().length > 0) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (state.streak.lastDay === yesterday) state.streak.count += 1;
  else if (state.streak.lastDay !== TODAY) state.streak.count = 1;
  state.streak.lastDay = TODAY;
  saveState();
  showStreakToast();
}

function showStreakToast() {
  if (document.querySelector(".streak-toast")) return;
  const t = document.createElement("div");
  t.className = "streak-toast";
  t.innerHTML = `🔥 ${state.streak.count}× v řadě!<br><small>Všechno hotovo!</small>`;
  document.querySelector(".phone").appendChild(t);
  setTimeout(() => t.classList.add("show"), 50);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 3000);
}

// ── Render card state ─────────────────────────────────────────────────────────
function renderCard(card) {
  const id = cardId(card);
  const due = isDue(card);
  const done = wateredToday(card);
  const daysLeft = daysUntilNext(card);

  card.classList.toggle("is-watered", done);
  card.classList.toggle("is-due", due && !done);

  // badge — absolute sticker on the card itself
  let badge = card.querySelector(".due-badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "due-badge";
    card.appendChild(badge);
  }

  if (done) {
    badge.textContent = "✓";
    badge.className = "due-badge badge-done";
  } else if (!hasStarted(card)) {
    const ds = daysUntilStart(card);
    badge.textContent = ds === 1 ? "zítra!" : `za ${ds}d`;
    badge.className = "due-badge badge-soon";
  } else if (due) {
    badge.textContent = "dnes!";
    badge.className = "due-badge badge-due";
  } else {
    badge.textContent = `za ${daysLeft}d`;
    badge.className = "due-badge badge-soon";
  }

  // footer text
  const footer = card.querySelector("footer");
  if (!footer._original) footer._original = footer.innerHTML;
  footer.innerHTML = done ? `<span class="drop-icon">✅</span> Zalito dnes!` : footer._original;
}

// ── Tab switching ─────────────────────────────────────────────────────────────
let activeTab = "rooms";

function applyTab(tab) {
  activeTab = tab;
  const grid = document.querySelector(".rooms-grid");
  const cards = [...grid.querySelectorAll("[data-room],[data-task]")];

  if (tab === "today") {
    cards.forEach((c) => {
      const due = isDue(c) || wateredToday(c);
      c.style.display = due ? "" : "none";
    });
  } else {
    cards.forEach((c) => (c.style.display = ""));
  }

  document.querySelectorAll(".tab-bar a").forEach((a) => {
    a.classList.toggle("active", a.dataset.tab === tab);
  });
}

document.querySelectorAll(".tab-bar a").forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    applyTab(a.dataset.tab);
  });
});

// ── Click handler ─────────────────────────────────────────────────────────────
document.querySelectorAll("[data-room],[data-task]").forEach((card) => {
  renderCard(card);

  card.addEventListener("click", () => {
    if (!hasStarted(card)) return;
    const id = cardId(card);
    if (wateredToday(card)) {
      // undo: pretend it was watered yesterday (keeps streak logic intact)
      state.lastWatered[id] = null;
    } else {
      state.lastWatered[id] = TODAY;
      spawnDrops(card);
      setTimeout(() => spawnConfetti(card), 200);
    }
    saveState();
    renderCard(card);
    if (activeTab === "today") applyTab("today");
    checkStreak();
  });
});

// show streak badge on load if everything already done
if (allDueCards().length === 0 && Object.keys(state.lastWatered).length > 0) {
  setTimeout(showStreakToast, 600);
}

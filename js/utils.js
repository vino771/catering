// js/utils.js
// Pure helper functions shared by every page. Keep this file framework-free
// so it can be imported anywhere without side effects (except session helpers).

import { SESSION_KEY, MEALS } from "./config.js";

/* ---------------------------- Date helpers ---------------------------- */

// Returns "YYYY-MM-DD" for a Date object, in local time (never UTC-shifted).
export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Returns "YYYY-MM" for a Date object.
export function toMonthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function todayDateKey() {
  return toDateKey(new Date());
}

export function formatDisplayDate(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

// "HH:MM" -> minutes since midnight
export function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function nowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Determines the expense date (the date the cost is attributed to) for a
 * given meal, based on TODAY's date. Breakfast & Lunch ordered today belong
 * to TOMORROW. Dinner ordered today belongs to TODAY.
 */
export function expenseDateFor(meal, today = new Date()) {
  if (meal === MEALS.DINNER) {
    return toDateKey(today);
  }
  return toDateKey(addDays(today, 1));
}

/**
 * Returns true if ordering is still open for a meal right now, given the
 * cutoff settings loaded from Firestore.
 *   - Breakfast & Lunch share the same cutoff (breakfastCutoff), since both
 *     are ordered "today for tomorrow" and close together at night.
 *   - Dinner uses dinnerCutoff.
 */
export function isOrderingOpen(meal, cutoffs, now = new Date()) {
  const cutoff =
    meal === MEALS.DINNER ? cutoffs.dinnerCutoff : cutoffs.breakfastCutoff;
  return nowMinutes(now) < timeToMinutes(cutoff);
}

/* --------------------------- Formatting helpers --------------------------- */

export function formatINR(amount) {
  const value = Number(amount) || 0;
  return "₹" + value.toLocaleString("en-IN", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* ----------------------------- Session helpers ----------------------------- */

export function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Redirects to login.html if no session exists. Call at the top of every
// protected page. Returns the session object if present.
export function requireAuth() {
  const session = getSession();
  if (!session || !session.username) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

// Redirects non-admins away from admin.html.
export function requireAdmin() {
  const session = requireAuth();
  if (session && session.role !== "admin") {
    window.location.href = "dashboard.html";
    return null;
  }
  return session;
}

export function logout() {
  clearSession();
  window.location.href = "login.html";
}

/* ------------------------------ Small DOM helpers ------------------------------ */

export function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

export function showToast(message, type = "info") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = el("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = el("div", `toast toast--${type}`, escapeHtml(message));
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast--visible"));
  setTimeout(() => {
    toast.classList.remove("toast--visible");
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

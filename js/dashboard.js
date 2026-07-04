// js/dashboard.js
import { requireAuth, logout, formatINR, todayDateKey, toMonthKey, formatMonthLabel, showToast } from "./utils.js";
import { getDailyExpense, getMonthlyExpense, getOrdersForUserOnDate } from "./data.js";
import { MEALS, MEAL_LABELS } from "./config.js";
import { expenseDateFor } from "./utils.js";

const session = requireAuth();
if (session) {
  init();
}

document.getElementById("logout-btn")?.addEventListener("click", logout);

async function init() {
  document.getElementById("welcome-name").textContent = session.displayName || session.username;

  const today = new Date();
  const todayKey = todayDateKey();
  const monthKey = toMonthKey(today);

  document.getElementById("today-date-label").textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  document.getElementById("month-label").textContent = formatMonthLabel(monthKey);

  try {
    const [todayExpense, monthlyExpense] = await Promise.all([
      getDailyExpense(session.username, todayKey),
      getMonthlyExpense(session.username, monthKey),
    ]);

    document.getElementById("today-expense").textContent = formatINR(todayExpense.total);
    document.getElementById("monthly-expense").textContent = formatINR(monthlyExpense.total);

    await renderMealStatuses(todayKey);
  } catch (err) {
    console.error(err);
    showToast("Could not load your dashboard. Please refresh.", "error");
  }
}

async function renderMealStatuses(todayKey) {
  // Breakfast/Lunch ordered today belong to tomorrow's expense date.
  // Dinner ordered today belongs to today's expense date.
  const tomorrowExpenseDate = expenseDateFor(MEALS.BREAKFAST);
  const dinnerExpenseDate = expenseDateFor(MEALS.DINNER);

  const [futureOrders, todaysDinnerOrders] = await Promise.all([
    getOrdersForUserOnDate(session.username, tomorrowExpenseDate),
    getOrdersForUserOnDate(session.username, dinnerExpenseDate),
  ]);

  setStatus("breakfast", futureOrders.breakfast);
  setStatus("lunch", futureOrders.lunch);
  setStatus("dinner", todaysDinnerOrders.dinner);
}

function setStatus(meal, order) {
  const card = document.getElementById(`status-${meal}`);
  if (!card) return;
  const badge = card.querySelector(".status-badge");
  const detail = card.querySelector(".status-detail");

  if (order && order.items && order.items.length) {
    badge.textContent = "ORDERED";
    badge.className = "status-badge status-badge--ordered";
    detail.textContent = order.items.map((i) => `${i.name} ×${i.qty}`).join(", ");
  } else {
    badge.textContent = "NOT ORDERED";
    badge.className = "status-badge status-badge--pending";
    detail.textContent = "Nothing placed yet.";
  }
}

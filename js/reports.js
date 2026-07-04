// js/reports.js
import {
  requireAuth,
  logout,
  formatINR,
  todayDateKey,
  toMonthKey,
  formatMonthLabel,
  formatDisplayDate,
  showToast,
  el,
} from "./utils.js";
import { getOrdersForUserOnDate, getOrdersForUserInMonth, getDailyExpense, getMonthlyExpense } from "./data.js";
import { MEAL_LABELS } from "./config.js";
import { generateUserPdf, buildUserTxtReport, downloadTxt } from "./pdf.js";

const session = requireAuth();
document.getElementById("logout-btn")?.addEventListener("click", logout);

const tabs = document.querySelectorAll(".report-tab");
const dailyDateInput = document.getElementById("daily-date-picker");
const monthPicker = document.getElementById("month-picker");
const yearPicker = document.getElementById("year-picker");

let currentScope = "daily";
let currentRows = [];
let currentMeta = {};

if (session) init();

function init() {
  const today = new Date();
  dailyDateInput.value = todayDateKey();
  monthPicker.value = toMonthKey(today);
  yearPicker.value = String(today.getFullYear());

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("report-tab--active"));
      tab.classList.add("report-tab--active");
      currentScope = tab.dataset.scope;
      document.querySelectorAll(".report-scope").forEach((s) => (s.hidden = true));
      document.getElementById(`scope-${currentScope}`).hidden = false;
      loadReport();
    });
  });

  dailyDateInput.addEventListener("change", loadReport);
  monthPicker.addEventListener("change", loadReport);
  yearPicker.addEventListener("change", loadReport);
  document.getElementById("export-pdf").addEventListener("click", exportPdf);
  document.getElementById("export-txt").addEventListener("click", exportTxt);

  loadReport();
}

async function loadReport() {
  const tableBody = document.getElementById("report-table-body");
  tableBody.innerHTML = `<tr><td colspan="6" class="report-loading">Loading…</td></tr>`;

  try {
    if (currentScope === "daily") await loadDaily();
    else if (currentScope === "monthly") await loadMonthly();
    else await loadYearly();
  } catch (err) {
    console.error(err);
    tableBody.innerHTML = `<tr><td colspan="6" class="report-loading">Could not load report.</td></tr>`;
  }
}

function rowsFromOrders(orders) {
  const rows = [];
  Object.values(orders).forEach((order) => {
    if (!order) return;
    order.items.forEach((item) => {
      rows.push({
        date: order.expenseDate,
        meal: order.meal,
        food: item.name,
        qty: item.qty,
        price: item.price,
        lineTotal: item.price * item.qty,
      });
    });
  });
  return rows;
}

async function loadDaily() {
  const date = dailyDateInput.value || todayDateKey();
  const [orders, dailyExpense] = await Promise.all([
    getOrdersForUserOnDate(session.username, date),
    getDailyExpense(session.username, date),
  ]);
  const rows = rowsFromOrders(orders);
  currentRows = rows;
  currentMeta = {
    userName: session.displayName || session.username,
    monthLabel: formatDisplayDate(date),
    generatedOn: new Date().toLocaleString("en-IN"),
    dailyTotal: dailyExpense.total,
    monthlyTotal: dailyExpense.total,
    scope: "Daily",
    fileName: `food-report-${date}.pdf`,
  };
  renderTable(rows, `Daily total: ${formatINR(dailyExpense.total)}`);
}

async function loadMonthly() {
  const monthKey = monthPicker.value || toMonthKey(new Date());
  const [orders, monthlyExpense] = await Promise.all([
    getOrdersForUserInMonth(session.username, monthKey),
    getMonthlyExpense(session.username, monthKey),
  ]);
  const rows = rowsFromOrdersList(orders);
  currentRows = rows;
  currentMeta = {
    userName: session.displayName || session.username,
    monthLabel: formatMonthLabel(monthKey),
    generatedOn: new Date().toLocaleString("en-IN"),
    monthlyTotal: monthlyExpense.total,
    scope: "Monthly",
    fileName: `food-report-${monthKey}.pdf`,
  };
  renderTable(rows, `Monthly total: ${formatINR(monthlyExpense.total)}`);
}

async function loadYearly() {
  const year = yearPicker.value || String(new Date().getFullYear());
  const monthKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  let allRows = [];
  let yearTotal = 0;

  for (const monthKey of monthKeys) {
    const orders = await getOrdersForUserInMonth(session.username, monthKey);
    allRows = allRows.concat(rowsFromOrdersList(orders));
  }
  yearTotal = allRows.reduce((sum, r) => sum + r.lineTotal, 0);

  currentRows = allRows;
  currentMeta = {
    userName: session.displayName || session.username,
    monthLabel: `Year ${year}`,
    generatedOn: new Date().toLocaleString("en-IN"),
    monthlyTotal: yearTotal,
    scope: "Yearly",
    fileName: `food-report-${year}.pdf`,
  };
  renderTable(allRows, `Yearly total: ${formatINR(yearTotal)}`);
}

function rowsFromOrdersList(orders) {
  const rows = [];
  orders.forEach((order) => {
    order.items.forEach((item) => {
      rows.push({
        date: order.expenseDate,
        meal: order.meal,
        food: item.name,
        qty: item.qty,
        price: item.price,
        lineTotal: item.price * item.qty,
      });
    });
  });
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

function renderTable(rows, summaryText) {
  const tableBody = document.getElementById("report-table-body");
  document.getElementById("report-summary").textContent = summaryText;

  if (!rows.length) {
    tableBody.innerHTML = `<tr><td colspan="6" class="report-loading">No orders found for this period.</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";
  rows.forEach((r) => {
    const tr = el(
      "tr",
      null,
      `
      <td>${formatDisplayDate(r.date)}</td>
      <td>${MEAL_LABELS[r.meal] || r.meal}</td>
      <td>${r.food}</td>
      <td>${r.qty}</td>
      <td>${formatINR(r.price)}</td>
      <td>${formatINR(r.lineTotal)}</td>
    `
    );
    tableBody.appendChild(tr);
  });
}

function exportPdf() {
  if (!currentRows.length) {
    showToast("Nothing to export yet.", "error");
    return;
  }
  generateUserPdf(currentRows, currentMeta);
}

function exportTxt() {
  if (!currentRows.length) {
    showToast("Nothing to export yet.", "error");
    return;
  }
  const content = buildUserTxtReport(currentRows, currentMeta);
  downloadTxt(currentMeta.fileName.replace(".pdf", ".txt"), content);
}

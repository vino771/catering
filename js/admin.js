// js/admin.js
import {
  requireAdmin,
  logout,
  formatINR,
  todayDateKey,
  formatDisplayDate,
  showToast,
  el,
} from "./utils.js";
import {
  getAllOrdersOnDate,
  getAllUsers,
  getSettings,
  saveSettings,
  getMenu,
  addMenuItem,
  updateMenuItem,
} from "./data.js";
import { MEALS, MEAL_LABELS } from "./config.js";
import { generateAdminSummaryPdf, buildAdminTxtReport, downloadTxt } from "./pdf.js";

const session = requireAdmin();
document.getElementById("logout-btn")?.addEventListener("click", logout);

const datePicker = document.getElementById("admin-date-picker");
let currentSummary = { breakfast: [], lunch: [], dinner: [] };
let currentMeta = {};

if (session) init();

async function init() {
  datePicker.value = todayDateKey();
  datePicker.addEventListener("change", loadDay);
  document.getElementById("admin-export-pdf").addEventListener("click", exportPdf);
  document.getElementById("admin-export-txt").addEventListener("click", exportTxt);

  await loadUserCount();
  await loadCutoffSettings();
  await loadMenuManager();
  await loadDay();

  document.getElementById("cutoff-form").addEventListener("submit", handleSaveCutoffs);
  document.getElementById("menu-item-form").addEventListener("submit", handleAddMenuItem);
}

async function loadUserCount() {
  try {
    const users = await getAllUsers();
    document.getElementById("card-users").textContent = users.length;
  } catch (err) {
    console.error(err);
  }
}

async function loadDay() {
  const date = datePicker.value || todayDateKey();
  const summaryBody = document.getElementById("summary-body");
  summaryBody.innerHTML = `<p class="report-loading">Loading orders…</p>`;

  try {
    const orders = await getAllOrdersOnDate(date);

    const totalExpense = orders.reduce((sum, o) => sum + (o.mealTotal || 0), 0);
    const uniqueUsers = new Set(orders.map((o) => o.username));

    document.getElementById("card-orders").textContent = orders.length;
    document.getElementById("card-expense").textContent = formatINR(totalExpense);
    document.getElementById("card-pending").textContent = Math.max(0, 12 - orders.length);
    document.getElementById("summary-date-label").textContent = formatDisplayDate(date);

    const summary = { breakfast: {}, lunch: {}, dinner: {} };
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const bucket = summary[order.meal];
        if (!bucket) return;
        bucket[item.name] = (bucket[item.name] || 0) + item.qty;
      });
    });

    currentSummary = {
      breakfast: Object.entries(summary.breakfast).map(([name, qty]) => ({ name, qty })),
      lunch: Object.entries(summary.lunch).map(([name, qty]) => ({ name, qty })),
      dinner: Object.entries(summary.dinner).map(([name, qty]) => ({ name, qty })),
    };
    currentMeta = { date, totalOrders: orders.length, totalExpense };

    renderSummary(currentSummary);
  } catch (err) {
    console.error(err);
    summaryBody.innerHTML = `<p class="report-loading">Could not load orders for this date.</p>`;
  }
}

function renderSummary(summary) {
  const summaryBody = document.getElementById("summary-body");
  summaryBody.innerHTML = "";

  const meals = ["breakfast", "lunch", "dinner"];
  const hasAny = meals.some((m) => summary[m].length);

  if (!hasAny) {
    summaryBody.appendChild(el("p", "report-loading", "No orders placed for this date."));
    return;
  }

  meals.forEach((meal) => {
    const items = summary[meal];
    if (!items.length) return;

    const block = el("div", "summary-block");
    block.appendChild(el("h3", "summary-block__title", MEAL_LABELS[meal]));

    const list = el("div", "summary-list");
    items.forEach((item) => {
      list.appendChild(
        el(
          "div",
          "summary-row",
          `<span class="summary-row__name">${item.name}</span><span class="summary-row__qty">${item.qty}</span>`
        )
      );
    });
    block.appendChild(list);
    summaryBody.appendChild(block);
  });
}

function exportPdf() {
  if (!currentMeta.date) return;
  generateAdminSummaryPdf(currentSummary, {
    ...currentMeta,
    fileName: `admin-summary-${currentMeta.date}.pdf`,
  });
}

function exportTxt() {
  if (!currentMeta.date) return;
  const content = buildAdminTxtReport(currentSummary, currentMeta);
  downloadTxt(`admin-summary-${currentMeta.date}.txt`, content);
}

/* ------------------------------ Cutoff settings ------------------------------ */

async function loadCutoffSettings() {
  const cutoffs = await getSettings();
  document.getElementById("breakfast-cutoff").value = cutoffs.breakfastCutoff;
  document.getElementById("dinner-cutoff").value = cutoffs.dinnerCutoff;
}

async function handleSaveCutoffs(e) {
  e.preventDefault();
  const breakfastCutoff = document.getElementById("breakfast-cutoff").value;
  const dinnerCutoff = document.getElementById("dinner-cutoff").value;
  try {
    await saveSettings({ breakfastCutoff, dinnerCutoff });
    showToast("Cutoff times updated.", "success");
  } catch (err) {
    console.error(err);
    showToast("Could not save settings.", "error");
  }
}

/* -------------------------------- Menu manager -------------------------------- */

async function loadMenuManager() {
  const menu = await getMenu();
  const listEl = document.getElementById("menu-manager-list");
  listEl.innerHTML = "";

  Object.values(MEALS).forEach((meal) => {
    const items = menu[meal] || [];
    const block = el("div", "menu-manager-block");
    block.appendChild(el("h3", "summary-block__title", MEAL_LABELS[meal]));

    items.forEach((item) => {
      const row = el("div", "menu-manager-row");
      row.innerHTML = `
        <span class="menu-manager-row__name">${item.name}</span>
        <input type="number" min="0" step="0.5" class="menu-price-input" value="${item.price}" data-id="${item.id}" data-meal="${meal}" />
      `;
      const input = row.querySelector(".menu-price-input");
      input.addEventListener("change", async () => {
        const newPrice = parseFloat(input.value) || 0;
        await updateMenuItem(item.id, { name: item.name, meal, price: newPrice, sortOrder: item.sortOrder ?? 0 });
        showToast(`${item.name} price updated to ${formatINR(newPrice)}.`, "success");
      });
      block.appendChild(row);
    });

    listEl.appendChild(block);
  });
}

async function handleAddMenuItem(e) {
  e.preventDefault();
  const name = document.getElementById("new-item-name").value.trim();
  const price = parseFloat(document.getElementById("new-item-price").value);
  const meal = document.getElementById("new-item-meal").value;

  if (!name || isNaN(price) || price < 0) {
    showToast("Enter a valid item name and price.", "error");
    return;
  }

  try {
    await addMenuItem({ name, price, meal, sortOrder: Date.now() });
    showToast(`${name} added to ${MEAL_LABELS[meal]}.`, "success");
    document.getElementById("menu-item-form").reset();
    await loadMenuManager();
  } catch (err) {
    console.error(err);
    showToast("Could not add menu item.", "error");
  }
}

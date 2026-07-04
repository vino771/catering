// js/order.js
import { requireAuth, logout, formatINR, expenseDateFor, isOrderingOpen, formatDisplayDate, el, showToast } from "./utils.js";
import { getMenu, getSettings, getOrder, saveOrder ,deleteOrder} from "./data.js";
import { MEALS, MEAL_LABELS } from "./config.js";

const session = requireAuth();
document.getElementById("logout-btn")?.addEventListener("click", logout);

// State: { breakfast: { itemId: qty }, lunch: {...}, dinner: {...} }
const quantities = { breakfast: {}, lunch: {}, dinner: {} };
let menu = null;
let cutoffs = null;
let existingOrders = { breakfast: null, lunch: null, dinner: null };

if (session) init();

async function init() {
  try {
    [menu, cutoffs] = await Promise.all([getMenu(), getSettings()]);
  } catch (err) {
    console.error(err);
    showToast("Could not load the menu. Please refresh.", "error");
    return;
  }

  for (const meal of Object.values(MEALS)) {
    await renderMealCard(meal);
  }
}

async function renderMealCard(meal) {
  const expenseDate = expenseDateFor(meal);
  const open = isOrderingOpen(meal, cutoffs);
  const section = document.getElementById(`meal-${meal}`);
  if (!section) return;

  const dateLabel = section.querySelector(".meal-expense-date");
  if (dateLabel) dateLabel.textContent = `For ${formatDisplayDate(expenseDate)}`;

  const closedBanner = section.querySelector(".ordering-closed");
  const itemsWrap = section.querySelector(".menu-items");
  const saveBtn = section.querySelector(".save-order-btn");

  if (!open) {
    closedBanner.hidden = false;
    itemsWrap.classList.add("menu-items--disabled");
    saveBtn.disabled = true;
  } else {
    closedBanner.hidden = true;
  }

  // Load any existing order for this meal/expenseDate so the user can edit it.
  const existing = await getOrder(session.username, meal, expenseDate);
  existingOrders[meal] = existing;
  const deleteBtn = section.querySelector(".delete-order-btn");

if (existing) {
    deleteBtn.hidden = false;
}
  if (existing) {
    existing.items.forEach((item) => {
      quantities[meal][item.id] = item.qty;
    });
    saveBtn.textContent = "Update Order";
  }

  itemsWrap.innerHTML = "";
  const items = menu[meal] || [];

  if (!items.length) {
    itemsWrap.appendChild(el("p", "menu-empty", "No menu items configured for this meal yet."));
  }

  items.forEach((item) => {
    const qty = quantities[meal][item.id] || 0;
    const row = el(
      "div",
      "food-row",
      `
      <div class="food-row__info">
        <span class="food-row__name">${item.name}</span>
        <span class="food-row__price">${formatINR(item.price)}</span>
      </div>
      <div class="food-row__controls">
        <button type="button" class="qty-btn qty-btn--minus" aria-label="Decrease quantity">−</button>
        <span class="qty-value">${qty}</span>
        <button type="button" class="qty-btn qty-btn--plus" aria-label="Increase quantity">+</button>
      </div>
      <div class="food-row__line-total">${formatINR(item.price * qty)}</div>
    `
    );
    row.dataset.itemId = item.id;

    const minusBtn = row.querySelector(".qty-btn--minus");
    const plusBtn = row.querySelector(".qty-btn--plus");

    minusBtn.addEventListener("click", () => {
      if (!open) return;
      const current = quantities[meal][item.id] || 0;
      quantities[meal][item.id] = Math.max(0, current - 1);
      refreshRow(row, item, quantities[meal][item.id]);
      updateMealTotal(meal);
    });

    plusBtn.addEventListener("click", () => {
      if (!open) return;
      quantities[meal][item.id] = (quantities[meal][item.id] || 0) + 1;
      refreshRow(row, item, quantities[meal][item.id]);
      updateMealTotal(meal);
    });

    if (!open) {
      minusBtn.disabled = true;
      plusBtn.disabled = true;
    }

    itemsWrap.appendChild(row);
  });

  updateMealTotal(meal);

  saveBtn.onclick = () => handleSave(meal, expenseDate);
  deleteBtn.onclick = async () => {

  if (!confirm("Delete this order?")) return;

  try {

    await deleteOrder(
      session.username,
      meal,
      expenseDate
    );

    showToast("Order deleted successfully.", "success");

    // Clear quantities from UI
    quantities[meal] = {};

    // Reload page to refresh everything
    location.reload();

  } catch (err) {
    console.error(err);
    showToast("Could not delete order.", "error");
  }

};
}

function refreshRow(row, item, qty) {
  row.querySelector(".qty-value").textContent = qty;
  row.querySelector(".food-row__line-total").textContent = formatINR(item.price * qty);
}

function updateMealTotal(meal) {
  const items = menu[meal] || [];
  let total = 0;
  items.forEach((item) => {
    total += (quantities[meal][item.id] || 0) * item.price;
  });
  const totalEl = document.querySelector(`#meal-${meal} .meal-total-value`);
  if (totalEl) totalEl.textContent = formatINR(total);
  updateGrandTotal();
  return total;
}

function updateGrandTotal() {
  let grand = 0;
  Object.values(MEALS).forEach((meal) => {
    const items = menu[meal] || [];
    items.forEach((item) => {
      grand += (quantities[meal][item.id] || 0) * item.price;
    });
  });
  const grandEl = document.getElementById("grand-total-value");
  if (grandEl) grandEl.textContent = formatINR(grand);
}

async function handleSave(meal, expenseDate) {
  if (!isOrderingOpen(meal, cutoffs)) {
    showToast(`Ordering for ${MEAL_LABELS[meal]} has closed.`, "error");
    return;
  }

  const items = menu[meal] || [];
  const chosen = items
    .filter((item) => (quantities[meal][item.id] || 0) > 0)
    .map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      qty: quantities[meal][item.id],
    }));

  if (!chosen.length) {
    showToast("Add at least one item before saving.", "error");
    return;
  }

  const mealTotal = chosen.reduce((sum, i) => sum + i.price * i.qty, 0);
  const btn = document.querySelector(`#meal-${meal} .save-order-btn`);
  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    await saveOrder({
      username: session.username,
      meal,
      expenseDate,
      items: chosen,
      mealTotal,
    });
    showToast(`${MEAL_LABELS[meal]} order saved for ${formatDisplayDate(expenseDate)}.`, "success");
    btn.textContent = "Update Order";
  } catch (err) {
    console.error(err);
    showToast("Could not save your order. Try again.", "error");
    btn.textContent = "Save Order";
  } finally {
    btn.disabled = false;
  }
}

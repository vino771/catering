// js/data.js
// Shared Firestore read/write helpers used by dashboard.js, order.js,
// admin.js and reports.js. Centralised here so every page queries and
// aggregates data the exact same way — no duplicated logic, no drift.

import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  setDoc,
  query,
  where,
} from "./firebase.js";
import { COLLECTIONS, SETTINGS_DOC_ID, DEFAULT_CUTOFFS, MEALS } from "./config.js";
import { toMonthKey } from "./utils.js";

/* ------------------------------- Settings ------------------------------- */

export async function getSettings() {
  const ref = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ...DEFAULT_CUTOFFS };
  const data = snap.data();
  return {
    breakfastCutoff: data.breakfastCutoff || DEFAULT_CUTOFFS.breakfastCutoff,
    dinnerCutoff: data.dinnerCutoff || DEFAULT_CUTOFFS.dinnerCutoff,
  };
}

export async function saveSettings(cutoffs) {
  const ref = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID);
  await setDoc(ref, cutoffs, { merge: true });
}

/* --------------------------------- Menu --------------------------------- */

// Returns { breakfast: [items], lunch: [items], dinner: [items] }
// Each item: { id, name, price, meal, sortOrder }
export async function getMenu() {
  const menuRef = collection(db, COLLECTIONS.MENU);
  const snap = await getDocs(menuRef);

  const grouped = {
    breakfast: [],
    lunch: [],
    dinner: []
  };

  snap.forEach((docSnap) => {
    const data = docSnap.data();

    const meal = data.mealType || data.meal;

    if (!meal) return;

    grouped[meal].push({
      id: docSnap.id,
      name: data.name,
      price: Number(data.price),
      meal,
      sortOrder: data.sortOrder || 0
    });
  });

  Object.keys(grouped).forEach((meal) => {
    grouped[meal].sort((a, b) => a.sortOrder - b.sortOrder);
  });

  console.log("Loaded Menu:", grouped);

  return grouped;
}

export async function addMenuItem(item) {
  const menuRef = collection(db, COLLECTIONS.MENU);
  const newDoc = doc(menuRef);
  await setDoc(newDoc, item);
  return newDoc.id;
}

export async function updateMenuItem(id, item) {
  const ref = doc(db, COLLECTIONS.MENU, id);
  await setDoc(ref, item, { merge: true });
}

/* --------------------------------- Orders -------------------------------- */

// Deterministic doc id => one order per user per meal per expense date.
// Re-saving an order overwrites the same document (never duplicates).
export function orderDocId(username, meal, expenseDate) {
  return `${username}_${meal}_${expenseDate}`;
}

export async function getOrder(username, meal, expenseDate) {
  const ref = doc(db, COLLECTIONS.ORDERS, orderDocId(username, meal, expenseDate));
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveOrder({ username, meal, expenseDate, items, mealTotal }) {
  const ref = doc(db, COLLECTIONS.ORDERS, orderDocId(username, meal, expenseDate));
  const existing = await getDoc(ref);
  const payload = {
    username,
    meal,
    expenseDate,
    items,
    mealTotal,
    orderDate: existing.exists() ? existing.data().orderDate : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setDoc(ref, payload, { merge: false });
  await recomputeDailyExpense(username, expenseDate);
  return payload;
}

export async function getOrdersForUserOnDate(username, expenseDate) {
  const ordersRef = collection(db, COLLECTIONS.ORDERS);
  const q = query(
    ordersRef,
    where("username", "==", username),
    where("expenseDate", "==", expenseDate)
  );
  const snap = await getDocs(q);
  const result = {};
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    result[data.meal] = { id: docSnap.id, ...data };
  });
  return result;
}

export async function getAllOrdersOnDate(expenseDate) {
  const ordersRef = collection(db, COLLECTIONS.ORDERS);
  const q = query(ordersRef, where("expenseDate", "==", expenseDate));
  const snap = await getDocs(q);
  const orders = [];
  snap.forEach((docSnap) => orders.push({ id: docSnap.id, ...docSnap.data() }));
  return orders;
}

export async function getOrdersForUserInMonth(username, monthKey) {
  // expenseDate is stored as YYYY-MM-DD, so a prefix match via range query.
  const ordersRef = collection(db, COLLECTIONS.ORDERS);
  const q = query(
    ordersRef,
    where("username", "==", username),
    where("expenseDate", ">=", `${monthKey}-01`),
    where("expenseDate", "<=", `${monthKey}-31`)
  );
  const snap = await getDocs(q);
  const orders = [];
  snap.forEach((docSnap) => orders.push({ id: docSnap.id, ...docSnap.data() }));
  return orders;
}

/* ---------------------------- Expense aggregation ---------------------------- */

export function dailyDocId(username, date) {
  return `${username}_${date}`;
}

export function monthlyDocId(username, monthKey) {
  return `${username}_${monthKey}`;
}

// Recomputes dailyExpenses/{username_date} from the three order documents
// for that user+date, then rolls the change up into monthlyExpenses.
export async function recomputeDailyExpense(username, expenseDate) {
  try {
    console.log("1. Getting orders...");

    const orders = await getOrdersForUserOnDate(username, expenseDate);

    console.log("2. Orders:", orders);

    const breakfastTotal = orders.breakfast?.mealTotal || 0;
    const lunchTotal = orders.lunch?.mealTotal || 0;
    const dinnerTotal = orders.dinner?.mealTotal || 0;

    const total = breakfastTotal + lunchTotal + dinnerTotal;

    console.log("3. Total:", total);

    const ref = doc(
      db,
      COLLECTIONS.DAILY_EXPENSES,
      dailyDocId(username, expenseDate)
    );

    console.log("4. Writing daily expense...");

    await setDoc(ref, {
      username,
      date: expenseDate,
      breakfastTotal,
      lunchTotal,
      dinnerTotal,
      total,
      updatedAt: new Date().toISOString(),
    });

    console.log("5. Daily expense saved.");

    await recomputeMonthlyExpense(
      username,
      toMonthKey(new Date(expenseDate))
    );

    console.log("6. Monthly expense updated.");

    return total;
  } catch (err) {
    console.error("ERROR:", err);
    throw err;
  }
}

export async function recomputeMonthlyExpense(username, monthKey) {
  const dailyRef = collection(db, COLLECTIONS.DAILY_EXPENSES);
  const q = query(
    dailyRef,
    where("username", "==", username),
    where("date", ">=", `${monthKey}-01`),
    where("date", "<=", `${monthKey}-31`)
  );
  const snap = await getDocs(q);
  let total = 0;
  snap.forEach((docSnap) => (total += docSnap.data().total || 0));

  const ref = doc(db, COLLECTIONS.MONTHLY_EXPENSES, monthlyDocId(username, monthKey));
  await setDoc(ref, {
    username,
    month: monthKey,
    total,
    updatedAt: new Date().toISOString(),
  });
  return total;
}

export async function getDailyExpense(username, date) {
  const ref = doc(db, COLLECTIONS.DAILY_EXPENSES, dailyDocId(username, date));
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : { username, date, breakfastTotal: 0, lunchTotal: 0, dinnerTotal: 0, total: 0 };
}

export async function getMonthlyExpense(username, monthKey) {
  const ref = doc(db, COLLECTIONS.MONTHLY_EXPENSES, monthlyDocId(username, monthKey));
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : { username, month: monthKey, total: 0 };
}

/* --------------------------------- Users --------------------------------- */

export async function getAllUsers() {
  const usersRef = collection(db, COLLECTIONS.USERS);
  const snap = await getDocs(usersRef);
  const users = [];
  snap.forEach((docSnap) => users.push({ id: docSnap.id, ...docSnap.data() }));
  return users;
}
export async function deleteOrder(username, meal, expenseDate) {

    const ref = doc(
        db,
        COLLECTIONS.ORDERS,
        orderDocId(username, meal, expenseDate)
    );

    await deleteDoc(ref);

    await recomputeDailyExpense(username, expenseDate);
}
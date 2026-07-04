// js/config.js
// Shared constants used across the whole app. Nothing here should be
// duplicated in other files — always import from this module.

export const COLLECTIONS = {
  USERS: "users",
  MENU: "menu",
  ORDERS: "orders",
  DAILY_EXPENSES: "dailyExpenses",
  MONTHLY_EXPENSES: "monthlyExpenses",
  SETTINGS: "settings",
};

export const SETTINGS_DOC_ID = "app";

export const MEALS = {
  BREAKFAST: "breakfast",
  LUNCH: "lunch",
  DINNER: "dinner",
};

export const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

// Fallback cutoffs used only if the "settings" document has not been
// created yet in Firestore. Once settings exist, these are ignored.
export const DEFAULT_CUTOFFS = {
  breakfastCutoff: "21:30", // Breakfast + Lunch ordering (for tomorrow) closes 9:30 PM today
  dinnerCutoff: "17:00", // Dinner ordering (for today) closes 5:00 PM today
};

export const SESSION_KEY = "tiffinledger_session";

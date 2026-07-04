// js/seed.js
// OPTIONAL one-time helper to populate Firestore with the starter menu,
// default cutoff settings, and an admin account. Open seed.html once after
// setting up your Firebase project, click "Run Seed", then delete seed.html
// (or leave it — it will not create duplicates on repeat runs).

import { db, doc, setDoc, collection, getDocs } from "./firebase.js";
import { COLLECTIONS, SETTINGS_DOC_ID, DEFAULT_CUTOFFS } from "./config.js";

const MENU_SEED = [
  { meal: "breakfast", name: "Dosa", price: 17, sortOrder: 1 },
  { meal: "breakfast", name: "Egg Dosa", price: 27.5, sortOrder: 2 },
  { meal: "breakfast", name: "Idly", price: 9, sortOrder: 3 },
  { meal: "breakfast", name: "Poori (2)", price: 34, sortOrder: 4 },
  { meal: "breakfast", name: "Poori (3)", price: 50, sortOrder: 5 },

  { meal: "lunch", name: "Variety Rice", price: 45, sortOrder: 1 },
  { meal: "lunch", name: "Meals", price: 70, sortOrder: 2 },
  { meal: "lunch", name: "Biriyani", price: 90, sortOrder: 3 },

  { meal: "dinner", name: "Dosa", price: 17, sortOrder: 1 },
  { meal: "dinner", name: "Egg Dosa", price: 27.5, sortOrder: 2 },
  { meal: "dinner", name: "Chapathi (2)", price: 37, sortOrder: 3 },
  { meal: "dinner", name: "Chapathi (3)", price: 55, sortOrder: 4 },
  { meal: "dinner", name: "Idly", price: 9, sortOrder: 5 },
];

const USERS_SEED = [
  { username: "admin", password: "admin123", role: "admin", displayName: "Admin" },
  { username: "user1", password: "user123", role: "user", displayName: "User One" },
];

export async function runSeed(log) {
  const write = (msg) => log && log(msg);

  // Menu — only seed if the collection is currently empty.
  const menuSnap = await getDocs(collection(db, COLLECTIONS.MENU));
  if (menuSnap.empty) {
    for (const item of MENU_SEED) {
      const ref = doc(collection(db, COLLECTIONS.MENU));
      await setDoc(ref, item);
    }
    write(`Seeded ${MENU_SEED.length} menu items.`);
  } else {
    write("Menu already has data — skipped.");
  }

  // Settings
  const settingsRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID);
  await setDoc(settingsRef, DEFAULT_CUTOFFS, { merge: true });
  write(`Settings ensured: breakfast cutoff ${DEFAULT_CUTOFFS.breakfastCutoff}, dinner cutoff ${DEFAULT_CUTOFFS.dinnerCutoff}.`);

  // Users — only seed if the collection is currently empty.
  const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
  if (usersSnap.empty) {
    for (const u of USERS_SEED) {
      const ref = doc(db, COLLECTIONS.USERS, u.username);
      await setDoc(ref, u);
    }
    write(`Seeded ${USERS_SEED.length} starter users (admin/admin123, user1/user123). Change these immediately.`);
  } else {
    write("Users already exist — skipped. Add the rest of your 10-12 users manually in Firestore.");
  }

  write("Seed complete.");
}

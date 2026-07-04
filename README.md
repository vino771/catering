# Tiffin Ledger — Food Order & Expense Management

A private, group-only food ordering and expense tracking site for ~10–12 people
(a mess, hostel floor, or office team). Built with plain HTML, CSS, and vanilla
JavaScript (ES modules) on top of **Firebase Firestore** — no frameworks, no
custom backend server.

---

## 1. Project structure

```
/
├── index.html          Redirects to login.html or dashboard.html
├── login.html           Username/password sign-in (checked against Firestore)
├── dashboard.html        User home: expenses, meal status
├── order.html            Place/edit Breakfast, Lunch, Dinner orders
├── reports.html          Daily / Monthly / Yearly reports + PDF/TXT export
├── admin.html             Admin console: daily summary, cutoffs, menu manager
├── seed.html              One-time helper to populate starter Firestore data
├── css/
│   ├── style.css          Shared design system (colors, type, components)
│   ├── login.css
│   ├── dashboard.css
│   ├── order.css
│   └── admin.css          (also used by reports.html)
├── js/
│   ├── firebase.js        Firebase app + Firestore initialization
│   ├── config.js          Collection names, meal keys, default cutoffs
│   ├── utils.js            Date math, formatting, session helpers
│   ├── data.js              Shared Firestore read/write helpers
│   ├── auth.js               Login page logic
│   ├── dashboard.js           Dashboard page logic
│   ├── order.js                Order page logic
│   ├── reports.js               Reports page logic
│   ├── admin.js                   Admin page logic
│   ├── pdf.js                      PDF (jsPDF) + TXT report generation
│   └── seed.js                      One-time starter data seed
└── assets/                 Static images/icons (empty by default)
```

---

## 2. Firebase setup

1. Go to the [Firebase Console](https://console.firebase.google.com) and create a new project.
2. Enable **Firestore Database** (Native mode). Start in **test mode** while
   developing, then lock it down with the security rules in section 6 before
   sharing the link with your group.
3. In **Project settings → General → Your apps**, add a **Web app** and copy
   the config object.
4. Paste those values into `js/firebase.js`:

```js
const firebaseConfig = {
  apiKey: "…",
  authDomain: "…",
  projectId: "…",
  storageBucket: "…",
  messagingSenderId: "…",
  appId: "…",
};
```

No other file needs to be touched to connect to Firebase.

---

## 3. Firestore collections

| Collection         | Doc ID pattern                    | Purpose |
|---------------------|-------------------------------------|---------|
| `users`              | `{username}`                        | Login credentials + role (`user`/`admin`) |
| `menu`                | auto-id                             | Food items: `{ name, price, meal, sortOrder }` |
| `orders`               | `{username}_{meal}_{expenseDate}`   | One order per user per meal per expense date (edits overwrite, never duplicate) |
| `dailyExpenses`         | `{username}_{date}`                 | Auto-recomputed total per user per day |
| `monthlyExpenses`        | `{username}_{YYYY-MM}`             | Auto-recomputed total per user per month |
| `settings`                | `general`                        | `{ breakfastCutoff: "21:30", dinnerCutoff: "17:00" }` |

You never need to write to `dailyExpenses` / `monthlyExpenses` yourself — they
are recalculated automatically every time an order is saved (`js/data.js →
recomputeDailyExpense` / `recomputeMonthlyExpense`).

---

## 4. First-time data seed

Rather than typing menu items and users into the Firestore console by hand,
open **`seed.html`** once in your browser after step 2 is done:

1. It creates the starter menu (Breakfast/Lunch/Dinner items exactly as
   specified in the brief).
2. It creates the `settings/general` document with the default cutoffs
   (21:30 for Breakfast & Lunch, 17:00 for Dinner).
3. It creates two starter accounts: `admin` / `admin123` (role: `admin`) and
   `user1` / `user123` (role: `user`).

**Change both passwords immediately**, then add your remaining ~10 users by
duplicating the `user1` document in the Firestore console (see section 8).
You can delete `seed.html` afterwards — it's not linked from anywhere else in
the app.

---

## 5. Deployment on Vercel

This is a fully static site, so Vercel needs no build step.

1. Push this folder to a GitHub repository.
2. In Vercel, click **New Project** → import the repo.
3. Framework preset: **Other** (or "Static").
4. Build command: *(leave blank)*. Output directory: `.` (project root).
5. Deploy. Vercel will serve `index.html`, `login.html`, etc. directly.

Because Firebase config lives in a checked-in JS file (not an env variable),
there is nothing else to configure on Vercel. If you'd rather not commit your
Firebase keys to a public repo, keep the repo private, or move the config
into a Vercel environment variable and inject it via a tiny build step.

---

## 6. Firestore security rules (recommended before going live)

Since there's no Firebase Authentication, rules can't check `request.auth`.
For a private group tool, the simplest safe approach is to restrict writes to
known collections/shapes and rely on the app being shared only within your
group (not indexed/public). A reasonable starting point:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;
      allow write: if false; // manage users from the Firebase console only
    }
    match /menu/{itemId} {
      allow read: if true;
      allow write: if true; // tighten further if needed
    }
    match /orders/{orderId} {
      allow read, write: if true;
    }
    match /dailyExpenses/{docId} {
      allow read, write: if true;
    }
    match /monthlyExpenses/{docId} {
      allow read, write: if true;
    }
    match /settings/{docId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

For real production hardening, pair this with Firebase App Check, or move to
Firebase Authentication with custom claims for roles.

---

## 7. How ordering & expense dates work

- **Breakfast** and **Lunch**, ordered *today*, are billed to **tomorrow's**
  expense date. Ordering closes at the `breakfastCutoff` time (default
  **9:30 PM**) today.
- **Dinner**, ordered *today*, is billed to **today's** expense date.
  Ordering closes at the `dinnerCutoff` time (default **5:00 PM**) today.
- The expense date is always computed automatically in `js/utils.js →
  expenseDateFor()`. Users are never asked to pick a date.
- Editing an order re-saves the same Firestore document (deterministic ID:
  `{username}_{meal}_{expenseDate}`), so there are never duplicate orders for
  the same user/meal/date.

---

## 8. How to add users

Firestore Console → `users` collection → **Add document**:

- Document ID: the username (e.g. `user2`)
- Fields:
  - `username` (string): same as the document ID
  - `password` (string): a plain-text password (see note below)
  - `role` (string): `user` or `admin`
  - `displayName` (string, optional): shown on the dashboard greeting

> **Note:** passwords are stored in plain text in Firestore because there is
> no backend server to hash them. This is acceptable only because the app is
> for a small, trusted private group with restricted Firestore rules — do
> not reuse these passwords elsewhere, and don't expose this project publicly
> without adding proper authentication.

---

## 9. How to change the menu

Two ways:

1. **Recommended:** Sign in as admin → **Admin Console → Menu Manager**. You
   can edit any item's price inline, or add a brand-new item with the small
   form at the bottom (choose which meal it belongs to).
2. **Manual:** Firestore Console → `menu` collection → edit/add a document
   with fields `{ name, price, meal, sortOrder }`, where `meal` is exactly
   `breakfast`, `lunch`, or `dinner`.

Prices are **never hardcoded** in JavaScript — every page loads them fresh
from Firestore via `js/data.js → getMenu()`.

---

## 10. How to change ordering cutoff times

Sign in as admin → **Admin Console → Ordering Cutoffs** → update the two time
fields → **Save Cutoffs**. This writes to `settings/general` in Firestore and
takes effect immediately for every user (no redeploy needed).

---

## 11. Reports & exports

- **Reports page** (`reports.html`): Daily / Monthly / Yearly tabs, each
  showing meal, food, quantity, price, and totals, with **PDF** and **TXT**
  export buttons (`js/pdf.js`, powered by jsPDF + jspdf-autotable).
- **Admin console** (`admin.html`): pick any date to see all orders grouped
  and aggregated by meal (e.g. "Dosa × 15"), with the same PDF/TXT export.

---

## 12. Notes on scale & performance

This app is designed for ~10–12 concurrent users, so it intentionally favors
simplicity over heavy caching or pagination. All Firestore queries are scoped
by `username` and/or `expenseDate`/`month` so reads stay small even as the
`orders` collection grows over months.
#   c a t e r i n g  
 
// js/auth.js
// Handles the login page only. Checks credentials directly against the
// "users" collection in Firestore. There is no Firebase Authentication,
// no signup, and no password reset — this is a private, pre-provisioned
// group of ~12 users.

import { db, collection, getDocs, query, where } from "./firebase.js";
import { COLLECTIONS } from "./config.js";
import { saveSession, getSession, showToast } from "./utils.js";

const form = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const errorBox = document.getElementById("login-error");
const submitBtn = document.getElementById("login-submit");

// If already logged in, skip straight to the dashboard.
(function redirectIfLoggedIn() {
  const session = getSession();
  if (session && session.username) {
    window.location.href = session.role === "admin" ? "admin.html" : "dashboard.html";
  }
})();

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.textContent = "";

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    errorBox.textContent = "Enter both username and password.";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Checking…";

  try {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where("username", "==", username));
    const snap = await getDocs(q);

    if (snap.empty) {
      errorBox.textContent = "No account found with that username.";
      return;
    }

    let matchedUser = null;
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.password === password) {
        matchedUser = { id: docSnap.id, ...data };
      }
    });

    if (!matchedUser) {
      errorBox.textContent = "Incorrect password.";
      return;
    }

    saveSession({
      username: matchedUser.username,
      role: matchedUser.role || "user",
      displayName: matchedUser.displayName || matchedUser.username,
    });

    showToast(`Welcome back, ${matchedUser.displayName || matchedUser.username}`, "success");

    setTimeout(() => {
      window.location.href = matchedUser.role === "admin" ? "admin.html" : "dashboard.html";
    }, 400);
  } catch (err) {
    console.error(err);
    errorBox.textContent = "Could not reach the server. Check your connection and try again.";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign in";
  }
});

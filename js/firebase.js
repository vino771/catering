// js/firebase.js
// Central Firebase initialization. Every other module imports { db } from here.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ------------------------------------------------------------------
// TODO: Replace with your own Firebase project credentials.
// Firebase Console -> Project Settings -> General -> Your apps -> SDK config
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyBvMZiZD__fq9oFN_PxAWQ9j_P97-SQUKI",
  authDomain: "catering-26.firebaseapp.com",
  projectId: "catering-26",
  storageBucket: "catering-26.firebasestorage.app",
  messagingSenderId: "1049710809895",
  appId: "1:1049710809895:web:05e6dcdf8680a4c42d0f02"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch,
};

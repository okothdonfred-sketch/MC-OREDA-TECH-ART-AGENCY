import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAPdyRe1LiDbul_ZYwZhWY9w3cBA_fKRq4",
  authDomain: "mc-oreda-agency.firebaseapp.com",
  projectId: "mc-oreda-agency",
  storageBucket: "mc-oreda-agency.appspot.com",
  messagingSenderId: "959261734806",
  appId: "1:959261734806:web:ff235540cc433fddd6cfb7",
  measurementId: "G-F9S4ERZF8F"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDlOtNopEAsbrNWdueTfmcyPapdMWAIAGQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "capstone-projects-bce84.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "capstone-projects-bce84",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "capstone-projects-bce84.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "70785631286",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:70785631286:web:133fc2abaee83492e80497",
  measurementId: "G-RJ9P7Z8D8D"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

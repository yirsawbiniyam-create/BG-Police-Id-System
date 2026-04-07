import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCM1WAt9B_9oq69F0N2Uhzz5gcV2w3PG40",
  authDomain: "bg-police-id-system.firebaseapp.com",
  projectId: "bg-police-id-system",
  storageBucket: "bg-police-id-system.firebasestorage.app",
  messagingSenderId: "754188638677",
  appId: "1:754188638677:web:d50e94dbc8a4aacdb9c55c",
  measurementId: "G-E4XG6QYRVR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;

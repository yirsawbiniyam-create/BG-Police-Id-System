import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const dbId = (firebaseConfig as any).firestoreDatabaseId || "(default)";
export const db = getFirestore(app, dbId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;

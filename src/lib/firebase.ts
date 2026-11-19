import { initializeApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const dbId = (firebaseConfig as any).firestoreDatabaseId || "(default)";

let firestoreDb: Firestore;
try {
  // Enable IndexedDB persistent offline cache so ID issuance, search, and UI never stall on slow internet
  firestoreDb = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    },
    dbId
  );
} catch {
  firestoreDb = getFirestore(app, dbId);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export default app;

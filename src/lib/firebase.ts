import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: env.VITE_FIREBASE_APP_ID as string,
};

/** Demo mode runs entirely in the browser with sample data, so the system can be tried before Firebase is set up. */
export const DEMO = env.VITE_DEMO === '1' || !firebaseConfig.apiKey;
export const API_URL = ((env.VITE_API_URL as string) || '').replace(/\/$/, '');
export const VAPID_KEY = env.VITE_FIREBASE_VAPID_KEY as string;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (!DEMO) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Offline cache: writes made with a bad connection are kept and sent when the phone is back online.
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  storage = getStorage(app);
}

export { app, auth, db, storage };

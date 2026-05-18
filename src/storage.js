import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyBqWyagklgd3nYbBq6fZFS5Ozp1pn6Oess',
  authDomain: 'snl-widm.firebaseapp.com',
  databaseURL: 'https://snl-widm-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'snl-widm',
  storageBucket: 'snl-widm.firebasestorage.app',
  messagingSenderId: '811518796638',
  appId: '1:811518796638:web:b49fc041eceddc314f65cf',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Firebase keys cannot contain '.', '#', '$', '[', ']', '/'.
// Our keys use ':' so we replace that too.
const toFirebaseKey = (key) => key.replace(/[.#$[\]:/]/g, '_');

// Reconstruct our original-style key for list results
const fromFirebaseKey = (fbKey, prefix) => {
  // widm-answer-v2_jan -> widm-answer-v2:jan
  return fbKey.replace(/^(widm-answer-v2)_/, '$1:');
};

export const storage = {
  async get(key) {
    const snapshot = await get(ref(db, toFirebaseKey(key)));
    if (!snapshot.exists()) throw new Error(`Key not found: ${key}`);
    return { key, value: snapshot.val(), shared: true };
  },

  async set(key, value) {
    await set(ref(db, toFirebaseKey(key)), value);
    return { key, value, shared: true };
  },

  async delete(key) {
    await remove(ref(db, toFirebaseKey(key)));
    return { key, deleted: true, shared: true };
  },

  async list(prefix) {
    // Read the root and filter by prefix (after key transformation)
    const safePrefix = toFirebaseKey(prefix);
    const snapshot = await get(ref(db, '/'));
    if (!snapshot.exists()) return { keys: [], prefix, shared: true };
    const all = snapshot.val();
    const keys = Object.keys(all)
      .filter((k) => k.startsWith(safePrefix))
      .map((k) => fromFirebaseKey(k, prefix));
    return { keys, prefix, shared: true };
  },
};

export const FIREBASE_IS_ACTIVE = true;

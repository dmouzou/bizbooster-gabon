const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k) env[k.trim()] = v.join('=').trim().replace(/^"(.*)"$/, '$1');
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const userIds = [
  'lynYFmfXS0UVY99A2zmM6J044h73',
  'JN5qzPB5xQcNdYpdi3OqKdbTeR72',
  'yR9QxHGKE1a7HtKCM8CQojDMbe02'
];

async function checkUsers() {
  for (const uid of userIds) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      console.log(`User ${uid}: exists = ${snap.exists()}`);
      if (snap.exists()) {
        console.log(`  data:`, snap.data());
      }
    } catch (e) {
      console.log(`User ${uid}: error = ${e.message}`);
    }
  }
}

checkUsers().then(() => process.exit(0));

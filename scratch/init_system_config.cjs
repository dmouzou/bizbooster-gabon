const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');
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

async function initConfig() {
  const config = {
    showTestAds: false,
    registeredUserIds: [
      'lynYFmfXS0UVY99A2zmM6J044h73',
      'JN5qzPB5xQcNdYpdi3OqKdbTeR72',
      'yR9QxHGKE1a7HtKCM8CQojDMbe02'
    ],
    registeredPhones: [
      '+24177905165',
      '+24177276895',
      '+24177874707',
      '24177905165',
      '24177276895',
      '24177874707',
      '77905165',
      '77276895',
      '77874707'
    ],
    updatedAt: new Date().toISOString()
  };

  await setDoc(doc(db, 'settings', 'system_config'), config, { merge: true });
  console.log('Successfully written system_config to Firestore!');
  const snap = await getDoc(doc(db, 'settings', 'system_config'));
  console.log('Verified system_config:', snap.data());
}

initConfig().then(() => process.exit(0)).catch(err => {
  console.error('Failed to init config:', err);
  process.exit(1);
});

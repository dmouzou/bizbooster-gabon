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

async function testSettingsRead() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'system_config'));
    console.log('SUCCESS! settings/system_config exists:', snap.exists());
    if (snap.exists()) {
      console.log('Data:', snap.data());
    } else {
      console.log('Doc does not exist yet (normal until first write). Read allowed!');
    }
  } catch (err) {
    console.error('READ FAILED:', err.code, err.message);
  }
}

testSettingsRead().then(() => process.exit(0));

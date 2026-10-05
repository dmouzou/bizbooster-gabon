const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');
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

async function checkActiveAds() {
  try {
    const q = query(collection(db, 'ads'), where('status', '==', 'ACTIVE'));
    const snap = await getDocs(q);
    console.log('Total ACTIVE ads in Firestore:', snap.size);
    snap.forEach(doc => {
      const d = doc.data();
      console.log('Ad ID:', doc.id, '| Title:', d.title, '| userId:', d.userId, '| contactName:', d.contactName, '| contactPhone:', d.contactPhone, '| isTest:', d.isTest);
    });
  } catch (err) {
    console.error('Error:', err.code, err.message);
  }
}

checkActiveAds().then(() => process.exit(0));

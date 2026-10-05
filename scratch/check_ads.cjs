const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k) env[k.trim()] = v.join('=').trim();
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

async function check() {
  const q = query(collection(db, 'ads'), where('status', '==', 'ACTIVE'));
  const snap = await getDocs(q);
  console.log('Total ACTIVE ads in Firestore:', snap.size);
  const ads = [];
  snap.forEach(doc => {
    ads.push({ id: doc.id, title: doc.data().title, isTest: doc.data().isTest, contactPhone: doc.data().contactPhone });
  });
  console.log('Ads:', JSON.stringify(ads, null, 2));
}

check().catch(console.error);

const admin = require('../functions/node_modules/firebase-admin');

try {
  admin.initializeApp({
    projectId: 'bizbooster-gabon'
  });
  const db = admin.firestore();
  db.collection('users').get().then(snap => {
    console.log('Total users in Firestore:', snap.size);
    snap.forEach(d => {
      console.log('User ID:', d.id, '| Name:', d.data().name, '| Phone:', d.data().contactPhone || d.data().phoneNumber, '| Role:', d.data().role);
    });
    process.exit(0);
  }).catch(e => {
    console.error('Admin SDK error:', e.message);
    process.exit(1);
  });
} catch (e) {
  console.error('Init error:', e.message);
  process.exit(1);
}


// ---- begin file: backend/scripts/createSuperAdmin.js ----
const admin = require('firebase-admin');

function getServiceAccount() {
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) {
    console.error('❌ FIREBASE_ADMIN_KEY is missing. Add your Service Account JSON to Replit Secrets.');
    process.exit(1);
  }
  let sa;
  try {
    sa = JSON.parse(raw);
  } catch (e) {
    console.error('❌ FIREBASE_ADMIN_KEY is not valid JSON. Paste the FULL JSON from Firebase Console.');
    process.exit(1);
  }
  if (!sa.private_key || !sa.client_email || !sa.project_id) {
    console.error('❌ FIREBASE_ADMIN_KEY JSON missing required fields (private_key, client_email, project_id).');
    process.exit(1);
  }
  // Fix escaped newlines in private_key (\\n -> \n)
  sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  return sa;
}

function initAdmin() {
  const sa = getServiceAccount();
  // Create a dedicated app instance to avoid any pre-initialized default app
  const app = admin.initializeApp(
    {
      credential: admin.credential.cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key,
      }),
      projectId: sa.project_id,
    },
    'superadmin-script'
  );
  return app;
}

(async () => {
  try {
    const app = initAdmin();
    const auth = app.auth();
    const db = app.firestore();

    const TARGET = {
      email: 'akaki.cincadze@gmail.com',
      password: '2Akakiviinaadzea3@',
      firstName: 'აკაკი',
      lastName: 'ცინცაძე',
      personalId: '01019062020',
      phoneNumber: '577241517',
      role: 'SUPER_ADMIN',
    };

    // Get or create Auth user
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(TARGET.email);
      await auth.updateUser(userRecord.uid, {
        password: TARGET.password,
        displayName: `${TARGET.firstName} ${TARGET.lastName}`,
        emailVerified: true,
      });
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email: TARGET.email,
          password: TARGET.password,
          displayName: `${TARGET.firstName} ${TARGET.lastName}`,
          emailVerified: true,
        });
      } else {
        throw e;
      }
    }

    // Set custom claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: TARGET.role,
      personalId: TARGET.personalId,
    });

    // Upsert Firestore user doc (no password)
    const userRef = db.collection('users').doc(userRecord.uid);
    const base = {
      id: userRecord.uid,
      email: TARGET.email,
      firstName: TARGET.firstName,
      lastName: TARGET.lastName,
      personalId: TARGET.personalId,
      phoneNumber: TARGET.phoneNumber,
      role: TARGET.role,
      isActive: true,
      registrationStatus: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const snap = await userRef.get();
    if (!snap.exists) base.createdAt = admin.firestore.FieldValue.serverTimestamp();
    await userRef.set(base, { merge: true });

    // Remove plaintext password fields for this email if any
    const q = await db.collection('users').where('email', '==', TARGET.email).get();
    for (const d of q.docs) {
      if (d.get('password') !== undefined) {
        await d.ref.update({ password: admin.firestore.FieldValue.delete() });
      }
    }

    console.log('✅ Super Admin ready:', {
      uid: userRecord.uid,
      email: TARGET.email,
      role: TARGET.role,
      firestoreDocId: userRef.id,
    });

    // Cleanly delete the app instance
    await app.delete();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to create SUPER_ADMIN:', err);
    process.exit(1);
  }
})();
// ---- end file ----

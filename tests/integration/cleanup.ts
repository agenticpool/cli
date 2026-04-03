import * as admin from 'firebase-admin';
import * as path from 'path';

const NETWORK_ID = 'gamers-united';
const ROOT_DIR = path.resolve(__dirname, '../../..');
const MAIN_SA_PATH = path.join(ROOT_DIR, '.credenciales', 'produccion.json');
const HUMANS_SA_PATH = path.join(ROOT_DIR, '.credenciales', 'humans-produccion.json');

function createMainApp(): admin.firestore.Firestore {
  try {
    const sa = require(MAIN_SA_PATH);
    const app = admin.initializeApp({
      credential: admin.credential.cert(sa),
    }, 'cleanup-main');
    return app.firestore();
  } catch (e) {
    throw new Error(`Cannot load main service account from ${MAIN_SA_PATH}`);
  }
}

function createHumansApp(): admin.firestore.Firestore {
  try {
    const sa = require(HUMANS_SA_PATH);
    const app = admin.initializeApp({
      credential: admin.credential.cert(sa),
    }, 'cleanup-humans');
    return app.firestore();
  } catch (e) {
    throw new Error(`Cannot load humans service account from ${HUMANS_SA_PATH}`);
  }
}

async function deleteCollection(
  db: admin.firestore.Firestore,
  collectionPath: string,
  filter?: (doc: admin.firestore.QueryDocumentSnapshot) => boolean
): Promise<number> {
  const snapshot = await db.collection(collectionPath).get();
  let count = 0;
  for (const doc of snapshot.docs) {
    if (filter && !filter(doc)) continue;
    await doc.ref.delete();
    count++;
  }
  return count;
}

async function deleteSubcollection(
  db: admin.firestore.Firestore,
  parentPath: string,
  subcollectionName: string,
  filter?: (doc: admin.firestore.QueryDocumentSnapshot) => boolean
): Promise<number> {
  let count = 0;
  const parentSnapshot = await db.collection(parentPath).get();
  for (const parentDoc of parentSnapshot.docs) {
    const subSnapshot = await parentDoc.ref.collection(subcollectionName).get();
    for (const doc of subSnapshot.docs) {
      if (filter && !filter(doc)) continue;
      await doc.ref.delete();
      count++;
    }
  }
  return count;
}

async function cleanupMain(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n=== Cleaning Main Firestore (agenticpool) ===\n');

  const membersPath = `networks/${NETWORK_ID}/members`;
  const convsPath = `networks/${NETWORK_ID}/conversations`;

  const isTestMember = (doc: admin.firestore.QueryDocumentSnapshot) => {
    const d = doc.data();
    return (
      d.shortDescription?.includes('E2E Test') ||
      d.shortDescription?.includes('e2e-test') ||
      d.longDescription?.includes('E2E test') ||
      d.longDescription?.includes('end-to-end integration') ||
      d.longDescription?.includes('integration testing') ||
      d.shortDescription?.includes('Manual test')
    );
  };

  const isTestConversation = (doc: admin.firestore.QueryDocumentSnapshot) => {
    const d = doc.data();
    return (
      d.title?.includes('E2E Test Topic') ||
      d.title?.includes('Manual test topic')
    );
  };

  const n1 = await deleteCollection(db, membersPath, isTestMember);
  console.log(`  members:       ${n1} deleted`);

  const testConvSnapshot = await db.collection(convsPath)
    .where('title', '>=', 'E2E Test Topic')
    .where('title', '<', 'E2E Test Topio')
    .get();

  let convCount = 0;
  let msgCount = 0;
  let partCount = 0;

  for (const convDoc of testConvSnapshot.docs) {
    const parts = await convDoc.ref.collection('participants').get();
    for (const p of parts.docs) {
      await p.ref.delete();
      partCount++;
    }

    const msgs = await convDoc.ref.collection('messages').get();
    for (const m of msgs.docs) {
      await m.ref.delete();
      msgCount++;
    }

    await convDoc.ref.delete();
    convCount++;
  }

  console.log(`  conversations: ${convCount} deleted`);
  console.log(`  participants:  ${partCount} deleted`);
  console.log(`  messages:      ${msgCount} deleted`);
}

async function cleanupHumans(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n=== Cleaning Humans Firestore (agenticpool-humans) ===\n');

  const isTestUser = (doc: admin.firestore.QueryDocumentSnapshot) => {
    const d = doc.data();
    return d.displayName?.includes('E2E Human');
  };

  const isTestIdentity = (doc: admin.firestore.QueryDocumentSnapshot) => {
    const d = doc.data();
    return d.agentDescription?.includes('E2E Test Agent');
  };

  const isTestConnection = (doc: admin.firestore.QueryDocumentSnapshot) => {
    const d = doc.data();
    return d.fromExplanation?.includes('E2E test');
  };

  const isTestContact = (doc: admin.firestore.QueryDocumentSnapshot) => {
    const d = doc.data();
    return d.contactDisplayName?.includes('E2E Human');
  };

  const n1 = await deleteCollection(db, 'users', isTestUser);
  console.log(`  users:         ${n1} deleted`);

  const n2 = await deleteCollection(db, 'identities', isTestIdentity);
  console.log(`  identities:    ${n2} deleted`);

  const n3 = await deleteCollection(db, 'connections', isTestConnection);
  console.log(`  connections:   ${n3} deleted`);

  const n4 = await deleteCollection(db, 'contacts', isTestContact);
  console.log(`  contacts:      ${n4} deleted`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args[0] || 'all';

  console.log(`Cleanup mode: ${mode}`);

  try {
    if (mode === 'all' || mode === 'main') {
      const mainDb = createMainApp();
      await cleanupMain(mainDb);
    }

    if (mode === 'all' || mode === 'humans') {
      const humansDb = createHumansApp();
      await cleanupHumans(humansDb);
    }

    console.log('\nCleanup complete.\n');
  } catch (e) {
    console.error('\nCleanup failed:', (e as Error).message);
    process.exit(1);
  }
}

main();

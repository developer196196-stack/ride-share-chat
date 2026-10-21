/**
 * Grants (or revokes) admin panel access.
 *
 *   pnpm --filter @workspace/api-nest run admin:grant -- admin@example.com 'a-strong-password'
 *   pnpm --filter @workspace/api-nest run admin:grant -- admin@example.com --revoke
 *
 * Creates the Firebase email/password account if it doesn't exist (or sets the new password if
 * one is given), then writes `admins/{uid}`. Needs the Email/Password sign-in provider enabled in
 * Firebase Console → Authentication → Sign-in method. Reads credentials from artifacts/api-nest/.env
 * and never prints secrets.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[m[1]] = value;
  }
  return out;
}

const args = process.argv.slice(2).filter((a) => a !== '--');
const revoke = args.includes('--revoke');
const [email, password] = args.filter((a) => !a.startsWith('--'));

if (!email || !email.includes('@')) {
  console.error('Usage: admin:grant -- <email> [password] [--revoke]');
  process.exit(1);
}
if (password != null && password.length < 8) {
  console.error('Use a password of at least 8 characters.');
  process.exit(1);
}

const env = { ...loadEnvFile(join(apiRoot, '.env')), ...process.env };
const admin = require(require.resolve('firebase-admin', { paths: [apiRoot] }));
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});
const auth = admin.auth();
const db = admin.firestore();

async function main() {
  let user = await auth.getUserByEmail(email).catch(() => null);

  if (revoke) {
    if (!user) return console.log(`No account for ${email}; nothing to revoke.`);
    await db.collection('admins').doc(user.uid).delete();
    await auth.revokeRefreshTokens(user.uid);
    return console.log(`Admin access revoked for ${email}.`);
  }

  if (!user) {
    if (!password) {
      console.error(`No account for ${email} yet — pass a password to create it.`);
      process.exit(1);
    }
    user = await auth.createUser({ email, password, emailVerified: true });
    console.log(`Created Firebase account for ${email}.`);
  } else if (password) {
    await auth.updateUser(user.uid, { password });
    console.log(`Updated the password for ${email}.`);
  }

  await db.collection('admins').doc(user.uid).set({ email, createdAt: admin.firestore.Timestamp.now() }, { merge: true });
  console.log(`Admin access granted to ${email}. Sign in to the admin panel with this email and password.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`Failed: ${error.message}`);
    process.exit(1);
  });

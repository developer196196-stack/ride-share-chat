/**
 * End-to-end smoke test against a running API (default http://localhost:<PORT from .env, else 5001>) and the real
 * Firebase / Redis / LiveKit / Google services configured in artifacts/api-nest/.env and
 * artifacts/mobile/.env. Prints PASS/FAIL per step and never prints secrets.
 *
 *   1. Start the API with simulated telemetry allowed:
 *        VALIDATION_ALLOW_SIMULATED=true pnpm --filter @workspace/api-nest run start
 *   2. node artifacts/api-nest/scripts/e2e-smoke.mjs
 *
 * Creates two temporary Firebase users and deletes them (and their Firestore data) at the end.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, '..');
const repoRoot = join(apiRoot, '..', '..');

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

const apiEnv = loadEnvFile(join(apiRoot, '.env'));
const mobileEnv = loadEnvFile(join(repoRoot, 'artifacts', 'mobile', '.env'));
const BASE = process.env.E2E_API_URL ?? `http://localhost:${apiEnv.PORT || 5001}`;
const WEB_API_KEY = mobileEnv.EXPO_PUBLIC_FIREBASE_API_KEY;

const admin = require(require.resolve('firebase-admin', { paths: [apiRoot] }));
const { io } = require(require.resolve('socket.io-client', { paths: [join(repoRoot, 'artifacts', 'mobile')] }));
const { RoomServiceClient } = require(require.resolve('livekit-server-sdk', { paths: [apiRoot] }));

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: apiEnv.FIREBASE_PROJECT_ID,
    clientEmail: apiEnv.FIREBASE_CLIENT_EMAIL,
    privateKey: (apiEnv.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});
const db = admin.firestore();

let failures = 0;
const results = [];
function report(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(token, method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

async function createTestUser(label) {
  const uid = `e2e-${label}-${Date.now().toString(36)}`;
  await admin.auth().createUser({ uid, displayName: `E2E ${label}` });
  const customToken = await admin.auth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(WEB_API_KEY)}`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) },
  );
  const json = await res.json();
  if (!json.idToken) throw new Error(`signInWithCustomToken failed: ${json.error?.message ?? res.status}`);
  return { uid, token: json.idToken };
}

const MPH = 0.44704;
function simulatedSample(state, scenario) {
  const now = Date.now();
  const cfg = {
    driving: { mph: 27, vib: 0.32, walking: 0, activity: { type: 'in_vehicle', confidence: 90 } },
    stopped_ev: { mph: 0, vib: 0.02, walking: 0, activity: { type: 'still', confidence: 80 } },
  }[scenario];
  const dt = state.t ? (now - state.t) / 1000 : 0;
  state.lat += (cfg.mph * MPH * dt) / 111320;
  state.t = now;
  return {
    simulated: true,
    preferredLanguage: state.lang,
    gps: { lat: state.lat, lng: state.lng, speedMps: cfg.mph * MPH, accuracyM: 6, timestamp: now, isMock: true },
    vibration: { vehicleBandRatio: cfg.vib, dominantHz: 15, rmsMps2: 0.2, walkingScore: cfg.walking, shakeScore: 0, sampleRateHz: 100 },
    activity: cfg.activity,
  };
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { path: '/api/v1/room/stream', transports: ['websocket'], auth: { token }, reconnection: false });
    const events = [];
    socket.onAny((event, payload) => events.push({ event, payload }));
    socket.on('connect', () => resolve({ socket, events }));
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('socket connect timeout')), 8000);
  });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(8000).emit(event, payload, (err, ack) => (err ? reject(err) : resolve(ack)));
  });
}

async function driveUntil(socket, simState, scenario, predicate, maxMs) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < maxMs) {
    const ack = await emitAck(socket, 'TELEMETRY', simulatedSample(simState, scenario));
    last = ack?.data ?? ack;
    if (last && predicate(last)) return last;
    await sleep(1000);
  }
  return last;
}

async function cleanup(uids, extra) {
  for (const uid of uids) {
    for (const sub of ['rides', 'trustedContacts']) {
      const snap = await db.collection('users').doc(uid).collection(sub).get().catch(() => null);
      for (const d of snap?.docs ?? []) await d.ref.delete().catch(() => undefined);
    }
    await db.collection('users').doc(uid).delete().catch(() => undefined);
    for (const col of ['shareLinks', 'safetyAlerts']) {
      const snap = await db.collection(col).where('uid', '==', uid).get().catch(() => null);
      for (const d of snap?.docs ?? []) await d.ref.delete().catch(() => undefined);
    }
    const reports = await db.collection('reports').where('reporterUid', '==', uid).get().catch(() => null);
    for (const d of reports?.docs ?? []) await d.ref.delete().catch(() => undefined);
    await admin.auth().deleteUser(uid).catch(() => undefined);
  }
  for (const s of extra) s.disconnect();
}

async function main() {
  console.log(`API: ${BASE}`);
  const health = await api(null, 'GET', '/healthz');
  report('healthz', health.status === 200, JSON.stringify(health.body));
  const h = health.body ?? {};
  report('Firebase configured', h.firebaseConfigured === true);
  report('Redis connected', h.redisConfigured === true);
  report('LiveKit configured', h.livekitConfigured === true);
  report('Google Roads configured', h.roadsConfigured === true);

  // Google Roads key works (real road in San Francisco, Market St).
  if (apiEnv.GOOGLE_ROADS_API_KEY) {
    const path = '37.7895,-122.4010|37.7887,-122.4021|37.7879,-122.4031|37.7871,-122.4041';
    const r = await fetch(`https://roads.googleapis.com/v1/snapToRoads?interpolate=false&path=${encodeURIComponent(path)}&key=${apiEnv.GOOGLE_ROADS_API_KEY}`);
    const j = await r.json();
    report('Google Roads API snapToRoads', r.ok && (j.snappedPoints?.length ?? 0) > 0, r.ok ? `${j.snappedPoints?.length} points` : j.error?.message);
  }

  // LiveKit credentials valid.
  if (apiEnv.LIVEKIT_URL) {
    try {
      const svc = new RoomServiceClient(apiEnv.LIVEKIT_URL.replace(/^wss:/, 'https:'), apiEnv.LIVEKIT_API_KEY, apiEnv.LIVEKIT_API_SECRET);
      const rooms = await svc.listRooms();
      report('LiveKit API credentials', Array.isArray(rooms), `${rooms.length} active rooms`);
    } catch (error) {
      report('LiveKit API credentials', false, error.message);
    }
  }

  if (h.redisConfigured !== true || !WEB_API_KEY) {
    console.log('Skipping user flow (needs Redis and EXPO_PUBLIC_FIREBASE_API_KEY).');
    return;
  }

  const a = await createTestUser('a');
  const b = await createTestUser('b');
  const sockets = [];
  try {
    for (const [u, name, lang] of [[a, 'e2e_alex', 'en'], [b, 'e2e_bea', 'es']]) {
      const boot = await api(u.token, 'POST', '/v1/auth/bootstrap', { countryCode: 'US' });
      report(`bootstrap ${name}`, boot.status === 200, `status ${boot.status}`);
      const prof = await api(u.token, 'PATCH', '/v1/auth/me', { displayName: name, homeCity: 'San Francisco, CA', rideStyle: 'party_tech', incognitoDropoff: true });
      report(`profile ${name}`, prof.status === 200 && prof.body?.profileComplete === true, `status ${prof.status}`);
      const prefs = await api(u.token, 'PUT', '/v1/me/preferences', { nativeLanguage: lang, autoTranslate: true, subtitleSize: 'md', subtitleStyle: 'bubble', promptShareOnVerified: false });
      report(`preferences ${name} (${lang})`, prefs.status === 200 && prefs.body?.nativeLanguage === lang);
    }

    const sa = await connectSocket(a.token);
    const sb = await connectSocket(b.token);
    sockets.push(sa.socket, sb.socket);
    report('WebSocket connect (both riders)', true);

    const simA = { lat: 37.77, lng: -122.42, t: 0, lang: 'en' };
    const simB = { lat: 37.78, lng: -122.41, t: 0, lang: 'es' };
    const vA = await driveUntil(sa.socket, simA, 'driving', (s) => s.state === 'VERIFIED', 25_000);
    report('rider A reaches VERIFIED (simulated drive)', vA?.state === 'VERIFIED', `state ${vA?.state}, score ${vA?.score}`);
    const vB = await driveUntil(sb.socket, simB, 'driving', (s) => s.state === 'VERIFIED', 25_000);
    report('rider B reaches VERIFIED', vB?.state === 'VERIFIED', `state ${vB?.state}, score ${vB?.score}`);

    const vibes = await api(a.token, 'GET', '/v1/rooms/vibes');
    report('list vibes', vibes.status === 200 && vibes.body?.length === 4);

    const joinA = await api(a.token, 'POST', '/v1/rooms/join', { vibe: 'party_mode' });
    report('rider A joins party_mode', joinA.status === 200, joinA.body?.roomId ?? JSON.stringify(joinA.body));
    report('LiveKit token issued', typeof joinA.body?.livekit?.token === 'string' && joinA.body.livekit.token.split('.').length === 3);
    const joinB = await api(b.token, 'POST', '/v1/rooms/join', { vibe: 'party_mode' });
    report('rider B lands in the same R.O.O.M.', joinB.status === 200 && joinB.body?.roomId === joinA.body?.roomId, `${joinB.body?.roomId}`);
    await sleep(500);
    report('A notified ROOM_MEMBER_JOINED', sa.events.some((e) => e.event === 'ROOM_MEMBER_JOINED' && e.payload?.member?.uid === b.uid));

    const chatAck = await emitAck(sa.socket, 'CHAT_MESSAGE_SENT', { text: 'Hello! How is your ride going today?' });
    report('chat send ack', chatAck?.ok === true, chatAck?.error?.message ?? '');
    await sleep(2500);
    const received = sb.events.find((e) => e.event === 'CHAT_MESSAGE_TRANSLATED' && e.payload?.senderId === a.uid);
    report('B receives the message', Boolean(received));
    report('…auto-translated to Spanish', received?.payload?.translated === true, received ? `"${received.payload.text}"` : '');

    const history = await api(b.token, 'GET', '/v1/rooms/current/messages');
    report('chat history', history.status === 200 && history.body?.length >= 1);

    const contact = await api(a.token, 'POST', '/v1/me/trusted-contacts', { name: 'E2E Contact', phone: '+15555550100', email: null, channel: 'sms' });
    report('add trusted contact', contact.status === 200, `status ${contact.status}`);
    const alert = await api(a.token, 'POST', '/v1/safety/alerts', { kind: 'share_status', location: { lat: simA.lat, lng: simA.lng, accuracyM: 6 } });
    report('safety alert + share link', alert.status === 200 && typeof alert.body?.shareUrl === 'string', alert.body?.message?.slice(0, 60));
    const token = alert.body?.shareUrl?.split('/').pop();
    const pub = await api(null, 'GET', `/v1/public/share/${token}`);
    report('public share status (no auth)', pub.status === 200 && pub.body?.active === true && pub.body?.location != null, `state ${pub.body?.state}`);
    const page = await fetch(`${BASE}/api/share/${token}`);
    report('public share HTML page', page.status === 200 && (page.headers.get('content-type') ?? '').includes('text/html'));

    const reportRes = await api(b.token, 'POST', '/v1/reports', { roomId: joinB.body?.roomId, reportedUid: a.uid, reason: 'spam', details: 'e2e test' });
    report('report participant', reportRes.status === 200);

    const next = await api(b.token, 'POST', '/v1/rooms/next');
    report('Next: B moved to a different R.O.O.M.', next.status === 200 && next.body?.roomId !== joinA.body?.roomId, next.body?.roomId);
    const joinAgain = await api(b.token, 'POST', '/v1/rooms/next');
    report('Next again: still never back with A (60-min block)', joinAgain.status === 200 && joinAgain.body?.roomId !== joinA.body?.roomId);

    console.log('…simulating an EV stop for ~17 s (grace needs 15 s below 5 mph)');
    const grace = await driveUntil(sa.socket, simA, 'stopped_ev', (s) => s.state === 'GRACE', 25_000);
    report('A enters GRACE at a stop (EV, no vibration)', grace?.state === 'GRACE', `remaining ${grace?.graceRemainingSec}s`);
    const recovered = await driveUntil(sa.socket, simA, 'driving', (s) => s.state === 'VERIFIED', 20_000);
    report('A recovers to VERIFIED when moving', recovered?.state === 'VERIFIED');

    const leave = await api(a.token, 'POST', '/v1/rooms/leave');
    report('A leaves → ride summary', leave.status === 200 && typeof leave.body?.durationSec === 'number', `peers ${leave.body?.peersMet}, grace ${leave.body?.graceCount}, ${leave.body?.distanceMiles} mi`);
    await sleep(800);
    const rides = await api(a.token, 'GET', '/v1/rides');
    report('ride saved to history', rides.status === 200 && rides.body?.length >= 1);
    await api(b.token, 'POST', '/v1/rooms/leave');
  } catch (error) {
    report('unexpected error', false, error.message);
  } finally {
    await cleanup([a.uid, b.uid], sockets);
    console.log('Cleaned up test users and their data.');
  }
}

main()
  .catch((error) => report('fatal', false, error.message))
  .finally(() => {
    console.log(`\n${results.length - failures}/${results.length} checks passed`);
    process.exit(failures > 0 ? 1 : 0);
  });

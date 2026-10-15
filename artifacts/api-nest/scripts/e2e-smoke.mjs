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
    walking: { mph: 3, vib: 0.05, walking: 0.85, activity: { type: 'walking', confidence: 85 } },
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
    for (const sub of ['rides', 'trustedContacts', 'following', 'followers']) {
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
    report('R.O.O.M. capacity is 9 (host included)', joinA.body?.capacity === 9, `capacity ${joinA.body?.capacity}`);
    report('LiveKit token issued', typeof joinA.body?.livekit?.token === 'string' && joinA.body.livekit.token.split('.').length === 3);
    report('quick-match opener hosts the new R.O.O.M.', joinA.body?.hostUid === a.uid && joinA.body?.members?.[0]?.isHost === true);

    const grid = await api(b.token, 'GET', '/v1/rooms/discover');
    const listed = grid.body?.rooms?.find((r) => r.roomId === joinA.body?.roomId);
    report('Discovery Grid lists A\'s R.O.O.M. for B', grid.status === 200 && Boolean(listed), `${grid.body?.rooms?.length ?? 0} rooms, ${grid.body?.liveRooms} live`);
    report('…with host preview and occupancy', listed?.host?.uid === a.uid && listed?.memberCount === 1 && listed?.capacity === 9, listed ? `${listed.host?.displayName} · ${listed.memberCount}/${listed.capacity}` : '');
    const missing = await api(b.token, 'POST', '/v1/rooms/ROOM-0000-00/join');
    report('joining a closed R.O.O.M. → 404 ROOM_NOT_FOUND', missing.status === 404 && missing.body?.code === 'ROOM_NOT_FOUND');
    const joinB = await api(b.token, 'POST', `/v1/rooms/${joinA.body?.roomId}/join`);
    report('rider B joins that R.O.O.M. from the grid', joinB.status === 200 && joinB.body?.roomId === joinA.body?.roomId, `${joinB.body?.roomId}`);
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

    const hostA = await api(a.token, 'POST', '/v1/rooms/host', { vibe: 'networking' });
    report('A hosts a new R.O.O.M.', hostA.status === 200 && hostA.body?.hostUid === a.uid && hostA.body?.roomId !== joinA.body?.roomId, hostA.body?.roomId);
    await sleep(800);
    const handover = sb.events.find((e) => e.event === 'ROOM_HOST_CHANGED' && e.payload?.roomId === joinA.body?.roomId);
    report('B becomes host of the old R.O.O.M. (ROOM_HOST_CHANGED)', handover?.payload?.hostUid === b.uid);
    const joinHosted = await api(b.token, 'POST', `/v1/rooms/${hostA.body?.roomId}/join`);
    report('B joins A\'s hosted R.O.O.M. by id', joinHosted.status === 200 && joinHosted.body?.hostUid === a.uid && joinHosted.body?.members?.length === 2);

    // Host Moderation Toolkit
    const hostedId = hostA.body?.roomId;
    const notHost = await api(b.token, 'POST', `/v1/rooms/current/members/${a.uid}/mute`);
    report('non-host cannot moderate (403 NOT_HOST)', notHost.status === 403 && notHost.body?.code === 'NOT_HOST');
    const mute = await api(a.token, 'POST', `/v1/rooms/current/members/${b.uid}/mute`);
    await sleep(600);
    report('host force-mutes B', mute.status === 200 && mute.body?.ok === true);
    report('…B gets FORCE_MUTED notice', sb.events.some((e) => e.event === 'FORCE_MUTED' && e.payload?.roomId === hostedId));
    const flag = await api(a.token, 'POST', `/v1/rooms/current/members/${b.uid}/flag`, { note: 'e2e silent flag' });
    const flagDoc = flag.body?.id ? await db.collection('reports').doc(flag.body.id).get() : null;
    report('host silently flags B (report source host_flag)', flag.status === 200 && flagDoc?.data()?.source === 'host_flag' && flagDoc?.data()?.reportedUid === b.uid);
    report('…B is not told', !sb.events.some((e) => JSON.stringify(e.payload ?? '').includes('flag')));
    const settings = await api(a.token, 'PATCH', '/v1/rooms/current/settings', { vibe: 'deep_talks', locked: true });
    await sleep(600);
    report('mood shift + privacy lock', settings.status === 200 && settings.body?.vibe === 'deep_talks' && settings.body?.locked === true);
    report('…everyone gets ROOM_SETTINGS_CHANGED', sb.events.some((e) => e.event === 'ROOM_SETTINGS_CHANGED' && e.payload?.vibe === 'deep_talks' && e.payload?.locked === true));
    const lockedGrid = await api(a.token, 'GET', '/v1/rooms/discover');
    const listedLocked = (await api(b.token, 'GET', '/v1/rooms/discover')).body?.rooms?.some((r) => r.roomId === hostedId);
    report('locked R.O.O.M. is off the Discovery Grid', lockedGrid.status === 200 && !listedLocked);
    const badSettings = await api(a.token, 'PATCH', '/v1/rooms/current/settings', {});
    report('empty settings update → 422', badSettings.status === 422);
    const eject = await api(a.token, 'POST', `/v1/rooms/current/members/${b.uid}/eject`);
    await sleep(600);
    report('host ejects B', eject.status === 200);
    report('…B gets ROOM_EJECTED', sb.events.some((e) => e.event === 'ROOM_EJECTED' && e.payload?.roomId === hostedId));
    const afterEject = await api(b.token, 'GET', '/v1/rooms/current');
    report('…B is out of the R.O.O.M.', afterEject.status === 200 && afterEject.body?.room === null);
    await api(a.token, 'PATCH', '/v1/rooms/current/settings', { locked: false });
    // B's phone keeps sending telemetry (otherwise the server moves B to GRACE after 60 s of silence).
    await driveUntil(sb.socket, simB, 'driving', (st) => st.state === 'VERIFIED', 20_000);
    const rejoin = await api(b.token, 'POST', `/v1/rooms/${hostedId}/join`);
    report('…and cannot rejoin it (ROOM_UNAVAILABLE)', rejoin.status === 409 && rejoin.body?.code === 'ROOM_UNAVAILABLE', `${rejoin.status} ${rejoin.body?.code}`);
    const backIn = await api(b.token, 'POST', '/v1/rooms/join', { vibe: 'party_mode' });
    report('ejected rider keeps riding: quick match elsewhere', backIn.status === 200 && backIn.body?.roomId !== hostedId);

    // Follow system, friends riding now, join requests and invites
    const followAB = await api(b.token, 'POST', `/v1/users/${a.uid}/follow`);
    report('B follows A', followAB.status === 200 && followAB.body?.following === true && followAB.body?.followerCount === 1);
    const oneWay = await api(b.token, 'GET', `/v1/users/${a.uid}`);
    report('one-way follow: profile without live room', oneWay.status === 200 && oneWay.body?.isFollowing === true && oneWay.body?.followsYou === false && oneWay.body?.live === null);
    // A's phone keeps sending telemetry so A is still VERIFIED (60 s of silence moves a rider to GRACE).
    await driveUntil(sa.socket, simA, 'driving', (st) => st.state === 'VERIFIED', 20_000);
    const aRoomRes = await api(a.token, 'POST', '/v1/rooms/host', { vibe: 'just_chilling' });
    const aRoom = aRoomRes.body?.roomId;
    report('A hosts a room for friends', aRoomRes.status === 200, `${aRoomRes.status} ${aRoomRes.body?.code ?? aRoom}`);
    await api(a.token, 'PATCH', '/v1/rooms/current/settings', { matching: 'manual' });
    const notFriends = await api(b.token, 'POST', `/v1/rooms/${aRoom}/requests`);
    report('non-friend cannot request to join (403 NOT_FRIENDS)', notFriends.status === 403 && notFriends.body?.code === 'NOT_FRIENDS');
    const followBA = await api(a.token, 'POST', `/v1/users/${b.uid}/follow`);
    report('A follows back → friends', followBA.status === 200);
    const following = await api(b.token, 'GET', '/v1/me/following');
    const aLive = following.body?.users?.find((u) => u.uid === a.uid)?.live;
    report('friends riding now: B sees A\'s private room', aLive?.roomId === aRoom && aLive?.isHost === true && aLive?.open === false);
    const followers = await api(a.token, 'GET', '/v1/me/followers');
    report('A\'s followers list has B', followers.body?.users?.some((u) => u.uid === b.uid && u.isFollowing && u.followsYou));
    const privateJoin = await api(b.token, 'POST', `/v1/rooms/${aRoom}/join`);
    report('manual room: joining without invite → 409 ROOM_PRIVATE', privateJoin.status === 409 && privateJoin.body?.code === 'ROOM_PRIVATE');
    await driveUntil(sb.socket, simB, 'driving', (st) => st.state === 'VERIFIED', 20_000);
    const req1 = await api(b.token, 'POST', `/v1/rooms/${aRoom}/requests`);
    await sleep(600);
    report('friend requests a seat', req1.status === 200);
    report('…host gets ROOM_JOIN_REQUEST', sa.events.some((e) => e.event === 'ROOM_JOIN_REQUEST' && e.payload?.requester?.uid === b.uid));
    const pending = await api(a.token, 'GET', '/v1/rooms/current/requests');
    report('…and sees it in pending requests', pending.body?.requests?.some((r) => r.user.uid === b.uid));
    await api(a.token, 'POST', `/v1/rooms/current/requests/${b.uid}/decline`);
    await sleep(600);
    report('decline → requester gets ROOM_REQUEST_DECLINED', sb.events.some((e) => e.event === 'ROOM_REQUEST_DECLINED' && e.payload?.roomId === aRoom));
    await api(b.token, 'POST', `/v1/rooms/${aRoom}/requests`);
    const accept = await api(a.token, 'POST', `/v1/rooms/current/requests/${b.uid}/accept`);
    await sleep(600);
    report('accept → requester gets ROOM_INVITE', accept.status === 200 && sb.events.some((e) => e.event === 'ROOM_INVITE' && e.payload?.roomId === aRoom && e.payload?.viaRequest === true));
    const invitedJoin = await api(b.token, 'POST', `/v1/rooms/${aRoom}/join`);
    report('invite lets B into the manual room', invitedJoin.status === 200 && invitedJoin.body?.roomId === aRoom && invitedJoin.body?.matching === 'manual');
    const reinvite = await api(a.token, 'POST', '/v1/rooms/current/invites', { uid: b.uid });
    report('inviting someone already inside → 409 ALREADY_IN_ROOM', reinvite.status === 409 && reinvite.body?.code === 'ALREADY_IN_ROOM');
    // Back to auto-fill so the Instant Escape checks below see a public room.
    await api(a.token, 'PATCH', '/v1/rooms/current/settings', { matching: 'auto' });

    const next = await api(b.token, 'POST', '/v1/rooms/next');
    report('Next: B moved to a different R.O.O.M.', next.status === 200 && next.body?.roomId !== aRoom, next.body?.roomId);
    const joinAgain = await api(b.token, 'POST', '/v1/rooms/next');
    report('Next again: still never back with A (60-min block)', joinAgain.status === 200 && joinAgain.body?.roomId !== aRoom);
    const hiddenGrid = await api(b.token, 'GET', '/v1/rooms/discover');
    report('Discovery Grid hides A\'s R.O.O.M. from B after Next', hiddenGrid.status === 200 && !hiddenGrid.body?.rooms?.some((r) => r.roomId === aRoom));
    const blockedJoin = await api(b.token, 'POST', `/v1/rooms/${aRoom}/join`);
    report('…and blocks joining it by id (ROOM_UNAVAILABLE)', blockedJoin.status === 409 && blockedJoin.body?.code === 'ROOM_UNAVAILABLE');

    console.log('…simulating an EV stop for ~17 s (grace needs 15 s below 5 mph)');
    const grace = await driveUntil(sa.socket, simA, 'stopped_ev', (s) => s.state === 'GRACE', 25_000);
    report('A enters GRACE at a stop (EV, no vibration)', grace?.state === 'GRACE', `remaining ${grace?.graceRemainingSec}s`);
    const recovered = await driveUntil(sa.socket, simA, 'driving', (s) => s.state === 'VERIFIED', 20_000);
    report('A recovers to VERIFIED when moving', recovered?.state === 'VERIFIED');

    console.log('…simulating A getting out and walking for ~22 s (exit needs 20 s of walking)');
    const postRide = await driveUntil(sa.socket, simA, 'walking', (s) => s.state === 'POST_RIDE', 35_000);
    report('A enters POST_RIDE after leaving the vehicle', postRide?.state === 'POST_RIDE', `remaining ${postRide?.postRideRemainingSec}s of ${postRide?.thresholds?.postRideDurationSec}s`);
    const stillIn = await api(a.token, 'GET', '/v1/rooms/current');
    report('A keeps the R.O.O.M. during the post-ride extension', stillIn.status === 200 && stillIn.body?.room != null);

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

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import type { PreferencesService } from '../preferences/preferences.service';
import { PushService } from './push.service';

/** Just enough Firestore for `pushTokens`: doc set/get/delete and `where('uid', 'in', ids)`. */
function fakeFirestore() {
  const docs = new Map<string, Record<string, unknown>>();
  const col = {
    doc: (id: string) => ({
      set: async (data: Record<string, unknown>) => void docs.set(id, data),
      get: async () => ({ exists: docs.has(id), data: () => docs.get(id) }),
      delete: async () => void docs.delete(id),
    }),
    where: (_field: string, _op: string, ids: string[]) => ({
      get: async () => ({ docs: [...docs.values()].filter((d) => ids.includes(d.uid as string)).map((d) => ({ data: () => d })) }),
    }),
  };
  return { docs, firestore: { collection: () => col } as unknown as Firestore };
}

const prefs = (off: Record<string, boolean> = {}) =>
  ({ get: async (uid: string) => ({ notifyNewFollowers: off[uid] !== true }) }) as unknown as PreferencesService;

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(tickets: (to: string) => unknown) {
  const sent: { to: string; data: Record<string, unknown>; channelId: string }[] = [];
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const messages = JSON.parse(init.body) as typeof sent;
    sent.push(...messages);
    return new Response(JSON.stringify({ data: messages.map((m) => tickets(m.to)) }), { status: 200 });
  }) as typeof fetch;
  return sent;
}

test('sends to every device of riders who allow the notification', async () => {
  const { firestore } = fakeFirestore();
  const push = new PushService(firestore, null, prefs({ bob: true }));
  await push.register('amy', 'ExponentPushToken[amy-phone]', 'ios');
  await push.register('amy', 'ExponentPushToken[amy-tablet]', 'android');
  await push.register('bob', 'ExponentPushToken[bob-phone]', 'android');
  const sent = stubFetch(() => ({ status: 'ok', id: 'r1' }));

  await push.sendToUsers(['amy', 'bob'], { kind: 'new_follower', title: 'New follower', body: 'Cal followed you', data: { uid: 'cal' } });

  assert.deepEqual(sent.map((m) => m.to).sort(), ['ExponentPushToken[amy-phone]', 'ExponentPushToken[amy-tablet]']);
  assert.equal(sent[0]!.data.type, 'new_follower');
  assert.equal(sent[0]!.channelId, 'social');
});

test('a device that changes account notifies only the new rider', async () => {
  const { firestore } = fakeFirestore();
  const push = new PushService(firestore, null, prefs());
  await push.register('amy', 'ExponentPushToken[shared]', 'ios');
  await push.register('bob', 'ExponentPushToken[shared]', 'ios');
  const sent = stubFetch(() => ({ status: 'ok', id: 'r1' }));

  await push.sendToUser('amy', { kind: 'room_invite', title: 't', body: 'b' });
  assert.equal(sent.length, 0);
  await push.unregister('amy', 'ExponentPushToken[shared]'); // not amy's any more: kept
  await push.sendToUser('bob', { kind: 'room_invite', title: 't', body: 'b' });
  assert.equal(sent.length, 1);
});

test('uninstalled devices are forgotten', async () => {
  const { firestore, docs } = fakeFirestore();
  const push = new PushService(firestore, null, prefs());
  await push.register('amy', 'ExponentPushToken[gone]', 'android');
  stubFetch(() => ({ status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }));

  await push.sendToUser('amy', { kind: 'join_request', title: 't', body: 'b' });
  await new Promise((r) => setImmediate(r));
  assert.equal(docs.size, 0);
});

test('only Expo push tokens are accepted', async () => {
  const { firestore } = fakeFirestore();
  const push = new PushService(firestore, null, prefs());
  await assert.rejects(() => push.register('amy', 'not-a-token', 'ios'));
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { DevicesService, deviceKey, readDevice } from './devices.service';

/** Just enough Firestore for `devices`: doc get/set/update and `where('uids', 'array-contains', uid)`. */
function fakeFirestore() {
  const docs = new Map<string, Record<string, unknown>>();
  // FieldValue.arrayUnion / arrayRemove sentinels aren't plain values; resolve the ones we use.
  const apply = (current: Record<string, unknown> | undefined, data: Record<string, unknown>) => {
    const next = { ...(current ?? {}) };
    for (const [k, v] of Object.entries(data)) {
      const op = v as { elements?: unknown[]; constructor?: { name?: string } };
      if (op?.elements && op.constructor?.name?.includes('ArrayUnion')) {
        next[k] = [...new Set([...((next[k] as unknown[]) ?? []), ...op.elements])];
      } else if (op?.elements && op.constructor?.name?.includes('ArrayRemove')) {
        next[k] = ((next[k] as unknown[]) ?? []).filter((x) => !op.elements!.includes(x));
      } else next[k] = v;
    }
    return next;
  };
  const ref = (id: string) => ({
    id,
    get: async () => ({ exists: docs.has(id), data: () => docs.get(id) }),
    set: async (data: Record<string, unknown>) => void docs.set(id, apply(undefined, data)),
    update: async (data: Record<string, unknown>) => void docs.set(id, apply(docs.get(id), data)),
  });
  const col = {
    doc: ref,
    where: (field: string, op: string, value: unknown) => {
      const run = async () => ({
        docs: [...docs.entries()]
          .filter(([, d]) => (op === 'array-contains' ? (d[field] as unknown[]).includes(value) : d[field] === value))
          .map(([id, d]) => ({ id, ref: ref(id), data: () => d })),
      });
      return { get: run, select: () => ({ get: run }) };
    },
  };
  return { docs, firestore: { collection: () => col } as unknown as Firestore };
}

const lastSeen = { toDate: () => new Date() };

test('only device IDs in the app format are read', () => {
  assert.deepEqual(readDevice('android:9774d56d682e549c', ' Pixel 8 '), { id: 'android:9774d56d682e549c', name: 'Pixel 8' });
  assert.equal(readDevice('ios:abcd', null)?.name, null);
  assert.equal(readDevice('web:abcd', null), null);
  assert.equal(readDevice('android:bad id!', null), null);
  assert.equal(readDevice(undefined, null), null);
});

test('a blocked phone is refused for every account, and unblocking lets it back in', async () => {
  const { firestore, docs } = fakeFirestore();
  const devices = new DevicesService(firestore, null);
  const phone = { id: 'android:9774d56d682e549c', name: 'Pixel 8' };
  await devices.record('amy', phone);
  await devices.record('bob', phone);
  const key = deviceKey(phone.id);
  docs.set(key, { ...docs.get(key), lastSeenAt: lastSeen });

  assert.equal(await devices.isBlocked(phone.id), false);
  const users = await devices.setBlocked(key, true, 'admin@example.com', 'fraud');
  assert.deepEqual(users.sort(), ['amy', 'bob']);
  assert.equal(await devices.isBlocked(phone.id), true);

  const [listed] = await devices.listForUser('amy');
  assert.equal(listed!.blocked, true);
  assert.equal(listed!.blockedReason, 'fraud');
  assert.equal(listed!.otherRiders, 1);

  await devices.setBlocked(key, false, 'admin@example.com');
  assert.equal(await devices.isBlocked(phone.id), false);
});

test('the raw device ID is never stored', async () => {
  const { firestore, docs } = fakeFirestore();
  await new DevicesService(firestore, null).record('amy', { id: 'ios:3f2a9c', name: null });
  assert.ok(!JSON.stringify([...docs.entries()]).includes('3f2a9c'));
});

test('deleting an account keeps the block on the phone', async () => {
  const { firestore, docs } = fakeFirestore();
  const devices = new DevicesService(firestore, null);
  const phone = { id: 'android:1234abcd', name: null };
  await devices.record('amy', phone);
  const key = deviceKey(phone.id);
  await devices.setBlocked(key, true, null);
  await devices.forgetUser('amy');
  assert.deepEqual(docs.get(key)!.uids, []);
  assert.equal(await devices.isBlocked(phone.id), true);
  // Still listed, so it can be unblocked from the panel.
  docs.set(key, { ...docs.get(key), lastSeenAt: lastSeen });
  assert.deepEqual((await devices.listBlocked()).map((d) => d.key), [key]);
});

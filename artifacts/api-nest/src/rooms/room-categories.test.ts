import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CatalogSchema, catalogProblems, DEFAULT_CATALOG, type CategoryCatalog } from './room-categories';

const clone = (): CategoryCatalog => structuredClone(DEFAULT_CATALOG);

test('the default catalog is valid: 4 groups × 3 room types', () => {
  assert.ok(CatalogSchema.safeParse(DEFAULT_CATALOG).success);
  assert.deepEqual(catalogProblems(DEFAULT_CATALOG, DEFAULT_CATALOG), []);
  assert.equal(DEFAULT_CATALOG.groups.length, 4);
  assert.equal(DEFAULT_CATALOG.types.length, 12);
});

test('adding, editing and hiding are allowed', () => {
  const next = clone();
  next.types[0]!.label = 'The Hustle';
  next.types[1]!.active = false;
  next.groups[3]!.active = false;
  next.types.push({ ...next.types[0]!, id: 'founders_corner', label: 'Founders Corner' });
  assert.deepEqual(catalogProblems(next, DEFAULT_CATALOG), []);
});

test('deleting a group or room type is refused', () => {
  const next = clone();
  next.types = next.types.filter((t) => t.id !== 'local_recs');
  assert.match(catalogProblems(next, DEFAULT_CATALOG).join(' '), /Local Recs.*hide it instead/);
});

test('duplicate ids, unknown groups and old mood ids are refused', () => {
  const next = clone();
  next.types.push({ ...next.types[0]!, label: 'Copy' });
  next.types.push({ ...next.types[0]!, id: 'orphan', groupId: 'nope' });
  next.types.push({ ...next.types[0]!, id: 'party_mode' });
  const problems = catalogProblems(next, DEFAULT_CATALOG).join(' ');
  assert.match(problems, /used twice/);
  assert.match(problems, /unknown group/);
  assert.match(problems, /reserved/);
});

test('at least one room type must stay visible', () => {
  const next = clone();
  for (const g of next.groups) g.active = false;
  assert.match(catalogProblems(next, DEFAULT_CATALOG).join(' '), /at least one visible/);
});

test('icons and colours must come from the app’s presets', () => {
  const next = clone();
  next.types[0]!.icon = 'mdiUnicorn';
  next.groups[0]!.color = '#123456';
  assert.equal(CatalogSchema.safeParse(next).success, false);
});

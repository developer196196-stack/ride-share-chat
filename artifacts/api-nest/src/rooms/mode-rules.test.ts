import assert from 'node:assert/strict';
import { test } from 'node:test';
import { minTripRemainingMs, placeMatches, roomClosesAt } from './mode-rules';

const mode = (over: Partial<Parameters<typeof placeMatches>[0] & object> = {}) => ({
  matching: 'global' as const,
  localRadiusMiles: 15,
  minTripMinutes: 0,
  maxRoomMinutes: 0,
  ...over,
});
const austin = { lat: 30.2672, lng: -97.7431, country: 'US' };
const roundRock = { lat: 30.5083, lng: -97.6789, country: 'US' }; // ~17 miles north
const pflugerville = { lat: 30.4394, lng: -97.62, country: 'US' }; // ~14 miles
const london = { lat: 51.5072, lng: -0.1276, country: 'GB' };
const unknown = { lat: null, lng: null, country: null };

test('global matches anyone', () => {
  assert.ok(placeMatches(mode(), austin, london));
});

test('nationwide matches the same country only', () => {
  const m = mode({ matching: 'nationwide' });
  assert.ok(placeMatches(m, austin, roundRock));
  assert.ok(!placeMatches(m, austin, london));
  assert.ok(placeMatches(m, austin, unknown), 'unknown country is allowed');
});

test('local matches within the mode radius', () => {
  const m = mode({ matching: 'local', localRadiusMiles: 15 });
  assert.ok(placeMatches(m, austin, pflugerville));
  assert.ok(!placeMatches(m, austin, roundRock));
  assert.ok(placeMatches(mode({ matching: 'local', localRadiusMiles: 20 }), austin, roundRock));
  assert.ok(placeMatches(m, austin, unknown), 'no GPS (desktop tester) is allowed');
  assert.ok(placeMatches(m, unknown, austin), 'rooms without a position are allowed');
});

test('min trip counts verified riding time', () => {
  const t0 = 1_700_000_000_000;
  assert.equal(minTripRemainingMs(mode(), t0, t0), 0);
  const m = mode({ minTripMinutes: 15 });
  assert.equal(minTripRemainingMs(m, t0, t0 + 5 * 60_000), 10 * 60_000);
  assert.equal(minTripRemainingMs(m, t0, t0 + 16 * 60_000), 0);
});

test('max room sets the closing time', () => {
  const t0 = 1_700_000_000_000;
  assert.equal(roomClosesAt(mode(), t0), null);
  assert.equal(roomClosesAt(mode({ maxRoomMinutes: 20 }), t0), t0 + 20 * 60_000);
});

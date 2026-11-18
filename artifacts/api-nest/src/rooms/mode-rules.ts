/**
 * Transit mode rules (Trip Validation & Modes in the admin panel): who can be matched into a
 * room, how long a rider rides before joining, and when a room closes. Pure functions so they
 * are easy to test; RoomsService supplies the data.
 */
import { haversineM } from '../validation/validation.engine';
import type { CategoryGroup } from './room-categories';

const METERS_PER_MILE = 1609.344;
/** Riders get a notice this long before a room reaches its time limit. */
export const ROOM_ENDING_NOTICE_MS = 2 * 60_000;

export type Place = { lat: number | null; lng: number | null; country: string | null };
type Mode = Pick<CategoryGroup, 'matching' | 'localRadiusMiles' | 'minTripMinutes' | 'maxRoomMinutes'>;

/**
 * Whether a rider may be matched into a room of this mode.
 * - global: anyone.
 * - nationwide: same country (from the phone number's country). Unknown on either side = allowed.
 * - local: within the mode's radius of where the room opened. Unknown position = allowed, so
 *   riders without GPS (desktop testers) and rooms from before this setting still match.
 */
export function placeMatches(mode: Mode | null, room: Place, rider: Place): boolean {
  if (!mode || mode.matching === 'global') return true;
  if (mode.matching === 'nationwide') {
    return !room.country || !rider.country || room.country === rider.country;
  }
  if (room.lat == null || room.lng == null || rider.lat == null || rider.lng == null) return true;
  const meters = haversineM({ lat: room.lat, lng: room.lng }, { lat: rider.lat, lng: rider.lng });
  return meters <= mode.localRadiusMiles * METERS_PER_MILE;
}

/** Milliseconds of verified riding still needed before joining this mode's rooms (0 = can join). */
export function minTripRemainingMs(mode: Mode | null, verifiedAt: number | null, now: number): number {
  if (!mode || mode.minTripMinutes <= 0) return 0;
  const since = verifiedAt ?? now;
  return Math.max(0, since + mode.minTripMinutes * 60_000 - now);
}

/** When a room opened at `createdAt` closes (null = no limit). */
export function roomClosesAt(mode: Mode | null, createdAt: number): number | null {
  if (!mode || mode.maxRoomMinutes <= 0 || !createdAt) return null;
  return createdAt + mode.maxRoomMinutes * 60_000;
}

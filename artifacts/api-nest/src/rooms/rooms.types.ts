/** Keep in sync with OpenAPI `Vibe`, `RoomSession`, `RideSummary`. */
export const VIBES = ['party_mode', 'networking', 'deep_talks', 'just_chilling'] as const;
export type Vibe = (typeof VIBES)[number];

/** 9 seats including the rider. */
export const ROOM_CAPACITY = 9;

/** auto = matchmaking fills open seats; manual = the host curates (off the Discovery Grid). */
export type RoomMatching = 'auto' | 'manual';

export type RoomMemberDto = {
  uid: string;
  displayName: string;
  homeCity: string | null;
  photoUrl: string | null;
  isSelf: boolean;
  isHost: boolean;
};

export type RoomSessionDto = {
  roomId: string;
  vibe: Vibe;
  capacity: number;
  hostUid: string | null;
  matching: RoomMatching;
  /** Privacy Lock: closed to new riders until the host unlocks it. */
  locked: boolean;
  members: RoomMemberDto[];
  livekit: { url: string; token: string } | null;
  joinedAt: string;
};

export type RoomHostDto = {
  uid: string;
  displayName: string;
  homeCity: string | null;
  photoUrl: string | null;
};

export type DiscoverRoomDto = {
  roomId: string;
  vibe: Vibe;
  memberCount: number;
  capacity: number;
  host: RoomHostDto | null;
  createdAt: string;
};

/** Where a friend is riding right now (Follow system). */
export type LiveRoomDto = {
  roomId: string;
  vibe: Vibe;
  isHost: boolean;
  memberCount: number;
  capacity: number;
  /** Public with a free seat: join directly; otherwise ask the host. */
  open: boolean;
};

/** Discovery Grid size (3×3). */
export const DISCOVER_LIMIT = 9;

export type RideSummaryDto = {
  rideId: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  roomDurationSec: number;
  distanceMiles: number;
  avgMph: number;
  peersMet: number;
  graceCount: number;
  graceSeconds: number;
  vibe: Vibe | null;
  endReason: string;
};

/** Keep in sync with OpenAPI `Vibe`, `RoomSession`, `RideSummary`. */
export const VIBES = ['party_mode', 'networking', 'deep_talks', 'just_chilling'] as const;
export type Vibe = (typeof VIBES)[number];

/** 9 seats including the rider. */
export const ROOM_CAPACITY = 9;

export type RoomMemberDto = {
  uid: string;
  displayName: string;
  homeCity: string | null;
  photoUrl: string | null;
  isSelf: boolean;
};

export type RoomSessionDto = {
  roomId: string;
  vibe: Vibe;
  capacity: number;
  members: RoomMemberDto[];
  livekit: { url: string; token: string } | null;
  joinedAt: string;
};

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

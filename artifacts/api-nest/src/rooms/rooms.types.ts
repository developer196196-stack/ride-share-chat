/** Keep in sync with OpenAPI `Vibe`, `RoomSession`, `RideSummary`. */
export const VIBES = ['party_mode', 'networking', 'deep_talks', 'just_chilling'] as const;
export type Vibe = (typeof VIBES)[number];

/** You plus 9 other riders. */
export const ROOM_CAPACITY = 10;

/** How long "Next" keeps skipped riders apart. */
export const SKIP_BLOCK_SEC = 60 * 60;

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

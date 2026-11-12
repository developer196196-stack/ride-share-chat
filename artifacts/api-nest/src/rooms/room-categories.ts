/**
 * R.O.O.M. category catalog: groups and room types, managed from the admin panel and stored in
 * Firestore `appConfig/roomCategories`. Until the panel saves one, DEFAULT_CATALOG applies (the
 * client's 4 groups × 3 room types, Nov 2026). Types are never deleted, only hidden, so older rooms
 * and rides keep a label.
 */
import { z } from 'zod';

/** Icons the app has built in (keys of artifacts/mobile/constants/icons.ts). */
export const CATEGORY_ICONS: Record<string, string> = {
  mdiBriefcase: 'Briefcase',
  solarRunning2Bold: 'Running',
  solarSofa2Bold: 'Sofa',
  solarHourglassLineBold: 'Hourglass',
  solarUsersGroupRoundedBold: 'Group',
  solarUsersGroupTwoRoundedBold: 'People',
  solarCupMusicBold: 'Party cup',
  solarPlainBold: 'Plane',
  solarMoonStarsBold: 'Moon & stars',
  solarVideocameraBold: 'Video camera',
  solarTrafficBold: 'Traffic light',
  solarMapPointBold: 'Map pin',
  solarFireBold: 'Flame',
  solarCarBold: 'Car',
  solarCompassBold: 'Compass',
  solarRocketBold: 'Rocket',
  solarMicrophoneLargeBold: 'Microphone',
  solarHomeSmileBold: 'Home',
  solarShieldCheckBold: 'Shield',
};

/** Brand palette (client brief) plus two extra accents. */
export const CATEGORY_COLORS: Record<string, string> = {
  '#E32424': 'Racing Red',
  '#4A69FF': 'Trust Blue',
  '#F59E0B': 'Amber',
  '#10B981': 'Emerald',
  '#0F172A': 'Midnight Navy',
  '#DB2777': 'Pink',
  '#3B82F6': 'Sky Blue',
  '#475569': 'Slate',
};

const ID = /^[a-z][a-z0-9_]{1,39}$/;

const GroupSchema = z.object({
  id: z.string().regex(ID, 'Group ids use lowercase letters, numbers and _ (2–40 characters).'),
  label: z.string().trim().min(1).max(40),
  description: z.string().trim().max(80),
  icon: z.string().refine((v) => v in CATEGORY_ICONS, 'Unknown icon.'),
  color: z.string().refine((v) => v in CATEGORY_COLORS, 'Pick a colour from the palette.'),
  active: z.boolean(),
});

const TypeSchema = z.object({
  id: z.string().regex(ID, 'Room type ids use lowercase letters, numbers and _ (2–40 characters).'),
  groupId: z.string(),
  label: z.string().trim().min(1).max(30),
  headline: z.string().trim().min(1).max(60),
  description: z.string().trim().max(140),
  tag: z.string().trim().max(30),
  icon: z.string().refine((v) => v in CATEGORY_ICONS, 'Unknown icon.'),
  active: z.boolean(),
});

export const CatalogSchema = z.object({
  groups: z.array(GroupSchema).min(1).max(12),
  types: z.array(TypeSchema).min(1).max(60),
});

export type CategoryGroup = z.infer<typeof GroupSchema>;
export type CategoryType = z.infer<typeof TypeSchema>;
export type CategoryCatalog = z.infer<typeof CatalogSchema>;

const group = (id: string, label: string, description: string, icon: string, color: string): CategoryGroup => ({
  id,
  label,
  description,
  icon,
  color,
  active: true,
});

const type = (
  id: string,
  groupId: string,
  label: string,
  headline: string,
  description: string,
  tag: string,
  icon: string,
): CategoryType => ({ id, groupId, label, headline, description, tag, icon, active: true });

export const DEFAULT_CATALOG: CategoryCatalog = {
  groups: [
    group('corporate', 'Corporate & Commuter', 'Regional rail, Amtrak and corporate shuttles', 'mdiBriefcase', '#4A69FF'),
    group('university', 'University & College', 'Campus buses and local transit', 'solarUsersGroupTwoRoundedBold', '#F59E0B'),
    group('long_haul', 'Long-Haul Travelers', 'Intercity buses, Megabus and Amtrak', 'solarPlainBold', '#10B981'),
    group('general', 'General Transit', 'City buses, taxis, rideshares and carpools', 'solarCarBold', '#E32424'),
  ],
  types: [
    type('business_networking', 'corporate', 'Business Networking', 'The Hustle: Business Networking', 'Pitch ideas, swap LinkedIns and meet people in your industry.', '💼 Professional', 'mdiBriefcase'),
    type('morning_grind', 'corporate', 'Morning Grind', 'The Morning Grind', 'Coffee-fuelled small talk and a quick plan for the day ahead.', '☕ Rise & shine', 'solarRunning2Bold'),
    type('after_work_unwind', 'corporate', 'After-Work Unwind', 'After-Work Unwind & WFH Vent', 'Shake off the workday, vent about meetings and switch off.', '🌆 Decompress', 'solarSofa2Bold'),
    type('study_break', 'university', 'Study Break', 'Study Break', 'Exams, classes and study tips — or a well-earned break from them.', '📚 Students', 'solarHourglassLineBold'),
    type('campus_connect', 'university', 'Campus Connect', 'Campus Connect', 'Meet students on your route: clubs, events and campus life.', '🎓 Campus', 'solarUsersGroupRoundedBold'),
    type('pre_game', 'university', 'The Pre-Game', 'The Pre-Game', 'Night-out energy, music and plans before the party starts.', '⚡ High energy', 'solarCupMusicBold'),
    type('travel_stories', 'long_haul', 'Travel Stories', 'Travel Stories & Wanderlust', 'Trips, destinations and stories from the road.', '🌍 Wanderlust', 'solarPlainBold'),
    type('deep_conversations', 'long_haul', 'Deep Conversations', 'Deep Conversations', 'Big questions, honest advice and meaningful dialogue for the long ride.', '🌌 Chill & real', 'solarMoonStarsBold'),
    type('pop_culture', 'long_haul', 'Pop Culture', 'Pop Culture & Binge-Watchers', 'Shows, movies, music and what everyone is watching right now.', '🍿 Binge mode', 'solarVideocameraBold'),
    type('traffic_venting', 'general', 'Traffic Venting', 'Traffic Venting', 'Stuck in traffic? Laugh about it with riders in the same jam.', '🚦 Stuck together', 'solarTrafficBold'),
    type('local_recs', 'general', 'Local Recs', 'Local Recs', 'Best food, hidden spots and things to do around the city.', '📍 Local', 'solarMapPointBold'),
    type('singles_meetup', 'general', 'Singles Meetup', 'Blind Date & Singles Meetup', 'Meet other singles on the move — friendly, respectful, fun.', '💘 Singles', 'solarFireBold'),
  ],
};

/** The 4 moods used before the room categories; stored rooms and rides may still carry them. */
export const LEGACY_VIBES: Record<string, string> = {
  party_mode: 'pre_game',
  networking: 'business_networking',
  deep_talks: 'deep_conversations',
  just_chilling: 'local_recs',
};

/**
 * Rules a saved catalog must follow on top of the schema. `previous` is the catalog it replaces:
 * nothing it contained may disappear (hide instead).
 */
export function catalogProblems(next: CategoryCatalog, previous: CategoryCatalog): string[] {
  const problems: string[] = [];
  const groupIds = new Set<string>();
  for (const g of next.groups) {
    if (groupIds.has(g.id)) problems.push(`Group id "${g.id}" is used twice.`);
    groupIds.add(g.id);
  }
  const typeIds = new Set<string>();
  for (const t of next.types) {
    if (typeIds.has(t.id)) problems.push(`Room type id "${t.id}" is used twice.`);
    if (LEGACY_VIBES[t.id]) problems.push(`"${t.id}" is reserved for older rides; pick another id.`);
    if (!groupIds.has(t.groupId)) problems.push(`Room type "${t.label}" belongs to an unknown group.`);
    typeIds.add(t.id);
  }
  for (const g of previous.groups) {
    if (!groupIds.has(g.id)) problems.push(`Group "${g.label}" can’t be deleted — hide it instead.`);
  }
  for (const t of previous.types) {
    if (!typeIds.has(t.id)) problems.push(`Room type "${t.label}" can’t be deleted — hide it instead.`);
  }
  const live = next.types.filter((t) => t.active && next.groups.some((g) => g.id === t.groupId && g.active));
  if (live.length === 0) problems.push('Keep at least one visible room type in a visible group.');
  return problems;
}

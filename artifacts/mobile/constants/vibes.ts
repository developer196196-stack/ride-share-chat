/**
 * R.O.O.M. categories: groups and room types, managed from the admin panel
 * (`GET /v1/rooms/categories`). Components read them through `useRoomCatalog()`. Until the API
 * answers, the last catalog saved on the phone is used, and before that the built-in default
 * (the client's 4 groups × 3 room types, Nov 2026).
 */
import { useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getGetRoomCategoriesQueryKey,
  useGetRoomCategories,
  type RideStyle,
  type RoomCategories,
  type Vibe,
} from '@workspace/api-client-react';
import { useAuthStore } from '@/stores/auth.store';
import { colors } from './colors';
import { icons, type IconName } from './icons';

export type VibeGroup = {
  id: string;
  label: string;
  /** Who the group is for, shown under the group name. */
  riders: string;
  icon: IconName;
  color: string;
};

export type VibeOption = {
  value: Vibe;
  group: string;
  label: string;
  headline: string;
  icon: IconName;
  description: string;
  tag: string;
  /** Mood accent, e.g. the speaking border in a R.O.O.M. (the group colour). */
  color: string;
};

const g = (id: string, label: string, description: string, icon: string, color: string) => ({
  id,
  label,
  description,
  icon,
  color,
  active: true,
});
const t = (id: string, groupId: string, label: string, headline: string, description: string, tag: string, icon: string) => ({
  id,
  groupId,
  label,
  headline,
  description,
  tag,
  icon,
  active: true,
});

/** Same as the API's DEFAULT_CATALOG (artifacts/api-nest/src/rooms/room-categories.ts). */
const BUILT_IN: RoomCategories = {
  updatedAt: null,
  groups: [
    g('corporate', 'Corporate & Commuter', 'Regional rail, Amtrak and corporate shuttles', 'mdiBriefcase', colors.trust),
    g('university', 'University & College', 'Campus buses and local transit', 'solarUsersGroupTwoRoundedBold', colors.warning),
    g('long_haul', 'Long-Haul Travelers', 'Intercity buses, Megabus and Amtrak', 'solarPlainBold', colors.accent),
    g('general', 'General Transit', 'City buses, taxis, rideshares and carpools', 'solarCarBold', colors.primary),
  ],
  types: [
    t('business_networking', 'corporate', 'Business Networking', 'The Hustle: Business Networking', 'Pitch ideas, swap LinkedIns and meet people in your industry.', '💼 Professional', 'mdiBriefcase'),
    t('morning_grind', 'corporate', 'Morning Grind', 'The Morning Grind', 'Coffee-fuelled small talk and a quick plan for the day ahead.', '☕ Rise & shine', 'solarRunning2Bold'),
    t('after_work_unwind', 'corporate', 'After-Work Unwind', 'After-Work Unwind & WFH Vent', 'Shake off the workday, vent about meetings and switch off.', '🌆 Decompress', 'solarSofa2Bold'),
    t('study_break', 'university', 'Study Break', 'Study Break', 'Exams, classes and study tips — or a well-earned break from them.', '📚 Students', 'solarHourglassLineBold'),
    t('campus_connect', 'university', 'Campus Connect', 'Campus Connect', 'Meet students on your route: clubs, events and campus life.', '🎓 Campus', 'solarUsersGroupRoundedBold'),
    t('pre_game', 'university', 'The Pre-Game', 'The Pre-Game', 'Night-out energy, music and plans before the party starts.', '⚡ High energy', 'solarCupMusicBold'),
    t('travel_stories', 'long_haul', 'Travel Stories', 'Travel Stories & Wanderlust', 'Trips, destinations and stories from the road.', '🌍 Wanderlust', 'solarPlainBold'),
    t('deep_conversations', 'long_haul', 'Deep Conversations', 'Deep Conversations', 'Big questions, honest advice and meaningful dialogue for the long ride.', '🌌 Chill & real', 'solarMoonStarsBold'),
    t('pop_culture', 'long_haul', 'Pop Culture', 'Pop Culture & Binge-Watchers', 'Shows, movies, music and what everyone is watching right now.', '🍿 Binge mode', 'solarVideocameraBold'),
    t('traffic_venting', 'general', 'Traffic Venting', 'Traffic Venting', 'Stuck in traffic? Laugh about it with riders in the same jam.', '🚦 Stuck together', 'solarTrafficBold'),
    t('local_recs', 'general', 'Local Recs', 'Local Recs', 'Best food, hidden spots and things to do around the city.', '📍 Local', 'solarMapPointBold'),
    t('singles_meetup', 'general', 'Singles Meetup', 'Blind Date & Singles Meetup', 'Meet other singles on the move — friendly, respectful, fun.', '💘 Singles', 'solarFireBold'),
  ],
};

/** Old moods still found on older rides. */
const LEGACY: Record<string, Vibe> = {
  party_mode: 'pre_game',
  networking: 'business_networking',
  deep_talks: 'deep_conversations',
  just_chilling: 'local_recs',
};

/** The profile ride style suggests a starting room type. */
const STYLE_TO_VIBE: Record<RideStyle, Vibe> = {
  party_tech: 'pre_game',
  networking: 'business_networking',
  deep_talks: 'deep_conversations',
  just_chilling: 'local_recs',
};

const toIcon = (name: string, fallback: IconName): IconName => (name in icons ? (name as IconName) : fallback);

export type RoomCatalog = ReturnType<typeof buildCatalog>;

export function buildCatalog(data: RoomCategories) {
  const allGroups: (VibeGroup & { active: boolean })[] = data.groups.map((group) => ({
    id: group.id,
    label: group.label,
    riders: group.description,
    icon: toIcon(group.icon, 'solarUsersGroupRoundedBold'),
    color: group.color,
    active: group.active,
  }));
  const groupById = new Map(allGroups.map((group) => [group.id, group]));
  const allTypes: (VibeOption & { active: boolean })[] = data.types.map((type) => {
    const group = groupById.get(type.groupId);
    return {
      value: type.id,
      group: type.groupId,
      label: type.label,
      headline: type.headline,
      icon: toIcon(type.icon, group?.icon ?? 'solarUsersGroupRoundedBold'),
      description: type.description,
      tag: type.tag,
      color: group?.color ?? colors.primary,
      active: type.active && group?.active === true,
    };
  });
  const typeById = new Map(allTypes.map((type) => [type.value, type]));
  /** Pickers: visible groups that have at least one visible room type. */
  const groups = allGroups.filter((group) => group.active && allTypes.some((type) => type.group === group.id && type.active));
  const active = allTypes.filter((type) => type.active);

  const option = (value: Vibe | null | undefined): VibeOption => {
    const found = value ? (typeById.get(value) ?? typeById.get(LEGACY[value] ?? '')) : undefined;
    if (found) return found;
    // Unknown id (catalog not loaded yet): a neutral label rather than another room's name.
    return value
      ? { ...(active[0] ?? allTypes[0]!), value, label: 'R.O.O.M.', headline: 'R.O.O.M.', tag: '', description: '' }
      : (active[0] ?? allTypes[0]!);
  };
  const group = (id: string): VibeGroup => groupById.get(id) ?? allGroups[0]!;

  return {
    groups,
    option,
    group,
    groupOf: (value: Vibe | null | undefined) => group(option(value).group),
    /** Visible room types in a group, in admin order. */
    vibesInGroup: (id: string) => active.filter((type) => type.group === id),
    isActive: (value: Vibe) => typeById.get(value)?.active === true,
    /** The ride style's room type if visible, else the first visible type. */
    forRideStyle: (style: RideStyle | null | undefined): Vibe => {
      const preferred = style ? STYLE_TO_VIBE[style] : undefined;
      return preferred && typeById.get(preferred)?.active ? preferred : (active[0]?.value ?? allTypes[0]!.value);
    },
  };
}

const STORAGE_KEY = 'rsc:roomCategories';
let saved: RoomCategories | null = null;
void AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (raw) saved = JSON.parse(raw) as RoomCategories;
  })
  .catch(() => undefined);

const builtInCatalog = buildCatalog(BUILT_IN);

/** The room catalog for rendering: live from the API, else the copy saved on the phone, else built in. */
export function useRoomCatalog(): RoomCatalog {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const query = useGetRoomCategories({
    query: {
      queryKey: getGetRoomCategoriesQueryKey(),
      enabled: isAuthenticated,
      staleTime: 5 * 60_000,
      placeholderData: saved ?? undefined,
    },
  });
  const data = query.data;
  const fresh = data && !query.isPlaceholderData ? data : null;
  useEffect(() => {
    if (!fresh || JSON.stringify(fresh) === JSON.stringify(saved)) return;
    saved = fresh;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)).catch(() => undefined);
  }, [fresh]);
  return useMemo(() => (data ? buildCatalog(data) : builtInCatalog), [data]);
}

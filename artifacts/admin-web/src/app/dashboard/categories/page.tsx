"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Car,
  Check,
  Compass,
  EyeOff,
  Flame,
  Footprints,
  Hourglass,
  House,
  MapPin,
  Mic,
  MoonStar,
  PartyPopper,
  Pencil,
  Plane,
  Plus,
  Rocket,
  Save,
  Shapes,
  ShieldCheck,
  Sofa,
  TrafficCone,
  Users,
  UsersRound,
  Video,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminQuery } from "@/hooks/use-admin-query";
import { adminApi, formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ErrorAlert, PageHeader, StatusBadge } from "@/components/page-header";

type Group = {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  active: boolean;
};
type RoomType = {
  id: string;
  groupId: string;
  label: string;
  headline: string;
  description: string;
  tag: string;
  icon: string;
  active: boolean;
};
type CatalogResponse = {
  groups: Group[];
  types: RoomType[];
  updatedAt: string | null;
  /** Icon key → name, for the icons built into the app. */
  icons: Record<string, string>;
  /** Hex → colour name. */
  colors: Record<string, string>;
};

/** Draft rows carry a local key; new rows get their id from the name when saved. */
type DraftGroup = Group & { key: string; isNew: boolean };
type DraftType = RoomType & { key: string; groupKey: string; isNew: boolean };
type Draft = { groups: DraftGroup[]; types: DraftType[] };
type Editing = { kind: "group" | "type"; key: string } | null;

/** Closest lucide look-alikes of the app's built-in icons, so the admin can see what riders see. */
const ICON_PREVIEW: Record<string, LucideIcon> = {
  mdiBriefcase: Briefcase,
  solarRunning2Bold: Footprints,
  solarSofa2Bold: Sofa,
  solarHourglassLineBold: Hourglass,
  solarUsersGroupRoundedBold: Users,
  solarUsersGroupTwoRoundedBold: UsersRound,
  solarCupMusicBold: PartyPopper,
  solarPlainBold: Plane,
  solarMoonStarsBold: MoonStar,
  solarVideocameraBold: Video,
  solarTrafficBold: TrafficCone,
  solarMapPointBold: MapPin,
  solarFireBold: Flame,
  solarCarBold: Car,
  solarCompassBold: Compass,
  solarRocketBold: Rocket,
  solarMicrophoneLargeBold: Mic,
  solarHomeSmileBold: House,
  solarShieldCheckBold: ShieldCheck,
};

let nextKey = 0;
const newKey = () => `new-${++nextKey}`;

function toDraft(data: CatalogResponse): Draft {
  return {
    groups: data.groups.map((g) => ({ ...g, key: g.id, isNew: false })),
    types: data.types.map((t) => ({
      ...t,
      key: t.id,
      groupKey: t.groupId,
      isNew: false,
    })),
  };
}

/** "After-Work Unwind" → "after_work_unwind", unique among `taken`. */
function makeId(label: string, taken: Set<string>): string {
  const base = (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "room"
  )
    .replace(/^(\d)/, "r_$1")
    .slice(0, 36);
  let id = base.length >= 2 ? base : `${base}_room`;
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
  taken.add(id);
  return id;
}

function move<T>(list: T[], index: number, by: -1 | 1): T[] {
  const target = index + by;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** Rounded tile with the icon in the group colour. */
function IconTile({
  icon,
  color,
  size = "md",
  muted,
}: {
  icon: string;
  color: string;
  size?: "sm" | "md" | "lg";
  muted?: boolean;
}) {
  const Icon = ICON_PREVIEW[icon] ?? Shapes;
  const box = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" }[size];
  const glyph = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" }[size];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        box,
        muted && "grayscale",
      )}
      style={{ backgroundColor: `${color}1F`, color }}
    >
      <Icon className={glyph} />
    </span>
  );
}

function OrderButtons({
  onUp,
  onDown,
  label,
}: {
  onUp?: () => void;
  onDown?: () => void;
  label: string;
}) {
  return (
    <div className="flex">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label={`Move ${label} up`}
        disabled={!onUp}
        onClick={onUp}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label={`Move ${label} down`}
        disabled={!onDown}
        onClick={onDown}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  );
}

function Field({
  label,
  hint,
  count,
  max,
  children,
}: {
  label: string;
  hint?: string;
  count?: number;
  max?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {max != null ? (
          <span
            className={cn(
              "text-xs tabular-nums",
              (count ?? 0) > max * 0.9
                ? "text-amber-600"
                : "text-muted-foreground",
            )}
          >
            {count ?? 0}/{max}
          </span>
        ) : null}
      </div>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function IconPicker({
  value,
  color,
  icons,
  onChange,
}: {
  value: string;
  color: string;
  icons: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(icons).map(([key, name]) => {
        const Icon = ICON_PREVIEW[key] ?? Shapes;
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={selected}
            onClick={() => onChange(key)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-muted",
              selected ? "border-2" : "border-border text-muted-foreground",
            )}
            style={
              selected
                ? { borderColor: color, color, backgroundColor: `${color}14` }
                : undefined
            }
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );
}

function ColorPicker({
  value,
  colors,
  onChange,
}: {
  value: string;
  colors: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(colors).map(([hex, name]) => {
        const selected = hex === value;
        return (
          <button
            key={hex}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={selected}
            onClick={() => onChange(hex)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition",
              selected ? "ring-2" : "hover:scale-110",
            )}
            style={{ backgroundColor: hex, ["--tw-ring-color" as string]: hex }}
          >
            {selected ? <Check className="h-4 w-4 text-white" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Roughly how the room type card looks in the app's Pick a Vibe carousel. */
function AppPreview({ type, color }: { type: DraftType; color: string }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: `${color}55`,
        background: `linear-gradient(160deg, ${color}1A, transparent 70%)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <IconTile icon={type.icon} color={color} size="lg" />
        {type.tag ? (
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ backgroundColor: `${color}1F`, color }}
          >
            {type.tag}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-lg font-semibold leading-tight">
        {type.headline || "Headline"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {type.description || "Description"}
      </p>
    </div>
  );
}

function VisibleRow({
  id,
  checked,
  onChange,
  help,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  help: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          Visible in the app
        </Label>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function RoomCategoriesPage() {
  const { data, error, loading, reload } = useAdminQuery<CatalogResponse>(
    "/settings/room-categories",
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);

  useEffect(() => setDraft(data ? toDraft(data) : null), [data]);

  const dirty = useMemo(
    () =>
      data != null &&
      draft != null &&
      JSON.stringify(toDraft(data)) !== JSON.stringify(draft),
    [data, draft],
  );

  const setGroup = (key: string, patch: Partial<Group>) =>
    setDraft(
      (d) =>
        d && {
          ...d,
          groups: d.groups.map((g) => (g.key === key ? { ...g, ...patch } : g)),
        },
    );
  const setType = (key: string, patch: Partial<DraftType>) =>
    setDraft(
      (d) =>
        d && {
          ...d,
          types: d.types.map((t) => (t.key === key ? { ...t, ...patch } : t)),
        },
    );

  const moveType = (type: DraftType, by: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      // Swap with the neighbour in the same group; other groups keep their positions.
      const siblings = d.types.filter((t) => t.groupKey === type.groupKey);
      const moved = move(
        siblings,
        siblings.findIndex((t) => t.key === type.key),
        by,
      );
      let i = 0;
      return {
        ...d,
        types: d.types.map((t) =>
          t.groupKey === type.groupKey ? moved[i++]! : t,
        ),
      };
    });

  const addGroup = () => {
    if (!draft || !data) return;
    const key = newKey();
    const group: DraftGroup = {
      key,
      isNew: true,
      id: "",
      label: "New group",
      description: "",
      icon: Object.keys(data.icons)[0]!,
      color: Object.keys(data.colors)[0]!,
      active: false,
    };
    setDraft({ ...draft, groups: [...draft.groups, group] });
    setEditing({ kind: "group", key });
  };

  const addType = (group: DraftGroup) => {
    if (!draft) return;
    const key = newKey();
    const type: DraftType = {
      key,
      groupKey: group.key,
      isNew: true,
      id: "",
      groupId: group.id,
      label: "New room",
      headline: "New room",
      description: "",
      tag: "",
      icon: group.icon,
      active: true,
    };
    setDraft({ ...draft, types: [...draft.types, type] });
    setEditing({ kind: "type", key });
  };

  const save = async () => {
    if (!draft) return;
    const groupIds = new Set(
      draft.groups.filter((g) => !g.isNew).map((g) => g.id),
    );
    const typeIds = new Set(
      draft.types.filter((t) => !t.isNew).map((t) => t.id),
    );
    const idByKey = new Map<string, string>();
    const groups = draft.groups.map(({ key, isNew, ...g }) => {
      const id = isNew ? makeId(g.label, groupIds) : g.id;
      idByKey.set(key, id);
      return { ...g, id };
    });
    const types = draft.types.map(({ key: _key, groupKey, isNew, ...t }) => ({
      ...t,
      id: isNew ? makeId(t.label, typeIds) : t.id,
      groupId: idByKey.get(groupKey) ?? t.groupId,
    }));
    setSaving(true);
    try {
      await adminApi("/settings/room-categories", {
        method: "PUT",
        body: { groups, types },
      });
      toast.success(
        "Saved. The app shows the new room categories within a few minutes.",
      );
      setEditing(null);
      await reload();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not save the room categories.",
      );
    } finally {
      setSaving(false);
    }
  };

  const groupByKey = new Map(draft?.groups.map((g) => [g.key, g]) ?? []);
  const editGroup =
    editing?.kind === "group" ? groupByKey.get(editing.key) : undefined;
  const editType =
    editing?.kind === "type"
      ? draft?.types.find((t) => t.key === editing.key)
      : undefined;
  const editTypeGroup = editType
    ? groupByKey.get(editType.groupKey)
    : undefined;

  // Discard can remove the row being edited (a new one); close the editor then.
  useEffect(() => {
    if (editing && draft && !editGroup && !editType) setEditing(null);
  }, [editing, draft, editGroup, editType]);

  const visibleTypes =
    draft?.types.filter((t) => t.active && groupByKey.get(t.groupKey)?.active)
      .length ?? 0;

  return (
    <div className="max-w-4xl space-y-6 pb-24">
      <PageHeader
        title="Room Categories"
        description="The groups and room types riders pick from in the app. Click a row to edit it. Changes reach the app within a few minutes, with no app update."
        actions={
          data?.updatedAt ? (
            <StatusBadge tone="info">
              Updated {formatDate(data.updatedAt)}
            </StatusBadge>
          ) : data ? (
            <StatusBadge tone="outline">Default categories</StatusBadge>
          ) : null
        }
      />
      {error ? (
        <ErrorAlert message={error} onRetry={() => void reload()} />
      ) : null}
      {loading && !draft
        ? Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))
        : null}

      {draft ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span>
              <strong className="tabular-nums">{draft.groups.length}</strong>{" "}
              <span className="text-muted-foreground">groups</span>
            </span>
            <span>
              <strong className="tabular-nums">{draft.types.length}</strong>{" "}
              <span className="text-muted-foreground">room types</span>
            </span>
            <span>
              <strong className="tabular-nums">{visibleTypes}</strong>{" "}
              <span className="text-muted-foreground">visible to riders</span>
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <EyeOff className="h-3.5 w-3.5" /> Nothing is deleted. Hide it
            instead, so older rides keep their label.
          </span>
        </div>
      ) : null}

      {draft
        ? draft.groups.map((group, gi) => {
            const types = draft.types.filter((t) => t.groupKey === group.key);
            const shown = types.filter((t) => t.active).length;
            return (
              <Card key={group.key} className="overflow-hidden">
                {/* Group header */}
                <div
                  className="flex items-center gap-3 border-b px-4 py-3"
                  style={{ borderTop: `3px solid ${group.color}` }}
                >
                  <IconTile
                    icon={group.icon}
                    color={group.color}
                    muted={!group.active}
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      setEditing({ kind: "group", key: group.key })
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={cn(
                          "truncate text-base font-semibold",
                          !group.active && "text-muted-foreground",
                        )}
                      >
                        {group.label || "Untitled group"}
                      </p>
                      {group.active ? null : (
                        <StatusBadge tone="outline">Hidden</StatusBadge>
                      )}
                      {group.isNew ? (
                        <StatusBadge tone="warning">New</StatusBadge>
                      ) : null}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {group.description || "No description"} · {shown} of{" "}
                      {types.length} visible
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch
                      aria-label={`Show ${group.label} in the app`}
                      checked={group.active}
                      onCheckedChange={(active) =>
                        setGroup(group.key, { active })
                      }
                    />
                    <OrderButtons
                      label={group.label}
                      onUp={
                        gi > 0
                          ? () =>
                              setDraft(
                                (d) =>
                                  d && { ...d, groups: move(d.groups, gi, -1) },
                              )
                          : undefined
                      }
                      onDown={
                        gi < draft.groups.length - 1
                          ? () =>
                              setDraft(
                                (d) =>
                                  d && { ...d, groups: move(d.groups, gi, 1) },
                              )
                          : undefined
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditing({ kind: "group", key: group.key })
                      }
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                  </div>
                </div>

                {/* Room types */}
                <CardContent className="p-0">
                  {types.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No room types yet. Add one below.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {types.map((type, ti) => {
                        const hidden = !type.active || !group.active;
                        return (
                          <li
                            key={type.key}
                            className="group/row flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                          >
                            <IconTile
                              icon={type.icon}
                              color={group.color}
                              size="sm"
                              muted={hidden}
                            />
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() =>
                                setEditing({ kind: "type", key: type.key })
                              }
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "font-medium",
                                    hidden && "text-muted-foreground",
                                  )}
                                >
                                  {type.label || "Untitled room"}
                                </span>
                                {type.tag ? (
                                  <span className="text-xs text-muted-foreground">
                                    {type.tag}
                                  </span>
                                ) : null}
                                {type.active ? null : (
                                  <StatusBadge tone="outline">
                                    Hidden
                                  </StatusBadge>
                                )}
                                {type.isNew ? (
                                  <StatusBadge tone="warning">New</StatusBadge>
                                ) : null}
                              </div>
                              <p className="truncate text-sm text-muted-foreground">
                                {type.description || type.headline}
                              </p>
                            </button>
                            <div className="flex shrink-0 items-center gap-1">
                              <Switch
                                aria-label={`Show ${type.label} in the app`}
                                checked={type.active}
                                onCheckedChange={(active) =>
                                  setType(type.key, { active })
                                }
                              />
                              <div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
                                <OrderButtons
                                  label={type.label}
                                  onUp={
                                    ti > 0
                                      ? () => moveType(type, -1)
                                      : undefined
                                  }
                                  onDown={
                                    ti < types.length - 1
                                      ? () => moveType(type, 1)
                                      : undefined
                                  }
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Edit ${type.label}`}
                                onClick={() =>
                                  setEditing({ kind: "type", key: type.key })
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => addType(group)}
                    className="flex w-full items-center gap-2 border-t px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" /> Add room type to{" "}
                    {group.label || "this group"}
                  </button>
                </CardContent>
              </Card>
            );
          })
        : null}

      {draft ? (
        <button
          type="button"
          onClick={addGroup}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed py-5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Add group
        </button>
      ) : null}

      {/* Editor */}
      <Dialog
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          {editGroup ? (
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>
                {editGroup.isNew ? "New group" : "Edit group"}
              </DialogTitle>
              <DialogDescription>
                {editGroup.isNew
                  ? "New groups start hidden. Add room types, then make it visible."
                  : `ID: ${editGroup.id}`}
              </DialogDescription>
            </DialogHeader>
          ) : null}
          {editType ? (
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle>
                {editType.isNew ? "New room type" : "Edit room type"}
              </DialogTitle>
              <DialogDescription>
                {editType.isNew
                  ? "The ID is created from the name when you save."
                  : `ID: ${editType.id}`}
              </DialogDescription>
            </DialogHeader>
          ) : null}

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {editGroup && data ? (
              <div className="space-y-6">
                <div
                  className="flex items-center gap-3 rounded-xl border p-3"
                  style={{ borderLeft: `4px solid ${editGroup.color}` }}
                >
                  <IconTile
                    icon={editGroup.icon}
                    color={editGroup.color}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {editGroup.label || "Group name"}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {editGroup.description || "Who it’s for"}
                    </p>
                  </div>
                </div>
                <Field
                  label="Group name"
                  count={editGroup.label.length}
                  max={40}
                >
                  <Input
                    value={editGroup.label}
                    maxLength={40}
                    onChange={(e) =>
                      setGroup(editGroup.key, { label: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Who it’s for"
                  hint="Shown under the group name, e.g. “Campus buses and local transit”."
                  count={editGroup.description.length}
                  max={80}
                >
                  <Input
                    value={editGroup.description}
                    maxLength={80}
                    onChange={(e) =>
                      setGroup(editGroup.key, { description: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Colour"
                  hint="Used by every room type in this group."
                >
                  <ColorPicker
                    value={editGroup.color}
                    colors={data.colors}
                    onChange={(color) => setGroup(editGroup.key, { color })}
                  />
                </Field>
                <Field label="Icon" hint={data.icons[editGroup.icon]}>
                  <IconPicker
                    value={editGroup.icon}
                    color={editGroup.color}
                    icons={data.icons}
                    onChange={(icon) => setGroup(editGroup.key, { icon })}
                  />
                </Field>
                <VisibleRow
                  id="edit-group-visible"
                  checked={editGroup.active}
                  onChange={(active) => setGroup(editGroup.key, { active })}
                  help="Hiding a group hides all of its room types."
                />
              </div>
            ) : null}

            {editType && editTypeGroup && draft && data ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Preview in the app
                  </p>
                  <AppPreview type={editType} color={editTypeGroup.color} />
                </div>
                <Field
                  label="Name"
                  hint="Short name on room pills, invites and the ride summary."
                  count={editType.label.length}
                  max={30}
                >
                  <Input
                    value={editType.label}
                    maxLength={30}
                    onChange={(e) =>
                      setType(editType.key, { label: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Headline"
                  hint="Large title on the Pick a Vibe card."
                  count={editType.headline.length}
                  max={60}
                >
                  <Input
                    value={editType.headline}
                    maxLength={60}
                    onChange={(e) =>
                      setType(editType.key, { headline: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Description"
                  count={editType.description.length}
                  max={140}
                >
                  <Textarea
                    rows={3}
                    value={editType.description}
                    maxLength={140}
                    onChange={(e) =>
                      setType(editType.key, { description: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Tag"
                  hint="An emoji and a word or two, e.g. “⚡ High energy”."
                  count={editType.tag.length}
                  max={30}
                >
                  <Input
                    value={editType.tag}
                    maxLength={30}
                    onChange={(e) =>
                      setType(editType.key, { tag: e.target.value })
                    }
                  />
                </Field>
                <Field label="Group">
                  <Select
                    value={editType.groupKey}
                    onValueChange={(groupKey) =>
                      setType(editType.key, { groupKey })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {draft.groups.map((g) => (
                        <SelectItem key={g.key} value={g.key}>
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: g.color }}
                            />
                            {g.label || "Untitled group"}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Icon" hint={data.icons[editType.icon]}>
                  <IconPicker
                    value={editType.icon}
                    color={editTypeGroup.color}
                    icons={data.icons}
                    onChange={(icon) => setType(editType.key, { icon })}
                  />
                </Field>
                <VisibleRow
                  id="edit-type-visible"
                  checked={editType.active}
                  onChange={(active) => setType(editType.key, { active })}
                  help={
                    editTypeGroup.active
                      ? "Riders can pick, host and join this room type."
                      : "Its group is hidden, so riders won’t see it yet."
                  }
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-4 border-t bg-muted/30 px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Kept as a draft until you click Save changes.
            </p>
            <Button onClick={() => setEditing(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {dirty ? (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
          <Card className="shadow-lg">
            <CardContent className="flex items-center gap-4 px-4 py-3">
              <span className="text-sm">Unsaved changes</span>
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => data && setDraft(toDraft(data))}
              >
                Discard
              </Button>
              <Button size="sm" disabled={saving} onClick={() => void save()}>
                <Save className="mr-1.5 h-4 w-4" />{" "}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

import {
  type AccessRule,
  bool,
  int,
  num,
  type PlacePed,
  readAccess,
  readBlipStyle,
  readPlacePed,
  record,
  str,
  type VehicleProps,
} from "@aicore-fivem/lib/shared";

/** ai-mechanic's contracts, panel content and the tuning change rules (both sides). No natives. */

export const EVENTS = {
  /** Callback: (netId, change: Change, base: VehicleProps) -> { ok } buys one change at the shop the player is in. */
  buy: "ai-mechanic:buy",
  /** Callback: (netId) -> { ok } repairs the vehicle at a shop. */
  repair: "ai-mechanic:repair",
  /** Callback: (shopId) -> { ok } opens a job shop's stash. */
  stash: "ai-mechanic:stash",
  /** Callback: (netId) -> { ok } washes the vehicle at a car wash. */
  wash: "ai-mechanic:wash",
  /** Server -> entity owner: (netId, engine | null) fix the body (engine null) or set the engine health; (netId, -1) wash. */
  fix: "ai-mechanic:client:fix",
} as const;

type Point = { x: number; y: number; z: number };
const point = (v: unknown): Point => {
  const p = record(v);
  return { x: num(p.x, 0), y: num(p.y, 0), z: num(p.z, 0) };
};

export interface Settings {
  accounts: string[];
  /** Dollars per health point repaired (engine + body, 2000 points). */
  repairPoint: number;
  performance: number;
  turbo: number;
  xenon: number;
  cosmetic: number;
  wheels: number;
  paint: number;
  tint: number;
  plate: number;
  washPrice: number;
  washSeconds: number;
  kitEngine: number;
  kitSeconds: number;
  /** The usable repair kit item. */
  kitItem: string;
  /** Job shops' stash size. */
  stashSlots: number;
  stashWeight: number;
  /** Map blips: public shops, job shops, car washes. */
  shopBlip: BlipStyle;
  jobShopBlip: BlipStyle;
  washBlip: BlipStyle;
}

export interface BlipStyle {
  sprite: number;
  color: number;
  scale: number;
}

export function readSettings(raw: unknown): Settings {
  const v = record(raw);
  const accounts = Array.isArray(v.accounts)
    ? v.accounts.filter((a): a is string => typeof a === "string")
    : [];
  return {
    accounts: accounts.length > 0 ? accounts : ["cash", "bank"],
    repairPoint: num(v.repairPoint, 2),
    performance: int(v.performance, 2500, 0),
    turbo: int(v.turbo, 15000, 0),
    xenon: int(v.xenon, 2000, 0),
    cosmetic: int(v.cosmetic, 750, 0),
    wheels: int(v.wheels, 1500, 0),
    paint: int(v.paint, 1000, 0),
    tint: int(v.tint, 500, 0),
    plate: int(v.plate, 300, 0),
    washPrice: int(v.washPrice, 20, 0),
    washSeconds: int(v.washSeconds, 6, 1, 60),
    kitEngine: int(v.kitEngine, 750, 100, 1000),
    kitSeconds: int(v.kitSeconds, 10, 1, 60),
    kitItem: str(v.kitItem, "repairkit", 48),
    stashSlots: int(v.stashSlots, 50, 1, 200),
    stashWeight: int(v.stashWeight, 250_000, 1000, 10_000_000),
    shopBlip: readBlipStyle(v.shopBlip, { sprite: 72, color: 46, scale: 0.6 }),
    jobShopBlip: readBlipStyle(v.jobShopBlip, {
      sprite: 72,
      color: 46,
      scale: 0.6,
    }),
    washBlip: readBlipStyle(v.washBlip, {
      sprite: 100,
      color: 37,
      scale: 0.75,
    }),
  };
}

export interface Shop {
  /** NPC standing at the place (panel), null for none. */
  ped: PlacePed | null;
  id: string;
  label: string;
  /** Empty: anyone, paid by the driver; otherwise on-duty members of this job, paid from the job's account. */
  job: string;
  /** Who may use it: everyone, or `job`'s on-duty members (lib `allows` / `online.allows`). */
  access: AccessRule;
  coords: Point;
  radius: number;
  blip: boolean;
  repair: boolean;
  tuning: boolean;
  multiplier: number;
  /** Job shops' stash; (0, 0, 0) = none. */
  stash: Point | null;
}

/** One shop record (`panel.records` / `world.records`). */
export function readShop(id: string, v: Record<string, unknown>): Shop {
  const stash = point(v.stash);
  const job = str(v.job, "", 32);
  return {
    ped: readPlacePed(v.ped),
    id,
    label: str(v.label, id, 48),
    job,
    access: readAccess({ jobs: job ? [job] : [], onDuty: true }),
    coords: point(v.coords),
    radius: num(v.radius, 8),
    blip: bool(v.blip, true),
    repair: bool(v.repair, true),
    tuning: bool(v.tuning, true),
    multiplier: num(v.multiplier, 1),
    stash: stash.x === 0 && stash.y === 0 ? null : stash,
  };
}

export interface Wash {
  id: string;
  label: string;
  coords: Point;
}

/** One car wash record (`panel.records` / `world.records`). */
export function readWash(id: string, v: Record<string, unknown>): Wash {
  return { id, label: str(v.label, id, 48), coords: point(v.coords) };
}

/** Mod slots by price group; turbo (18) and xenon (22) are on / off. */
export const PERFORMANCE_MODS = [11, 12, 13, 15, 16] as const;
export const COSMETIC_MODS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34,
  35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 48,
] as const;
export const TOGGLE_MODS = [18, 22] as const;
export const WHEEL_MOD = 23;
/** GTA colour indices offered as paint. */
export const PAINTS = [
  0, 1, 4, 112, 27, 30, 38, 89, 92, 53, 64, 70, 145, 135, 96, 158, 120,
] as const;

/** One purchase: a mod level, a wheel, a paint, the window tint or the plate style. */
export type Change =
  | { kind: "mod"; type: number; index: number }
  | { kind: "wheels"; wheelType: number; index: number }
  | { kind: "paint"; slot: 0 | 1; color: number }
  | { kind: "tint"; value: number }
  | { kind: "plate"; value: number };

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const MOD_TYPES = new Set<number>([
  ...PERFORMANCE_MODS,
  ...COSMETIC_MODS,
  ...TOGGLE_MODS,
]);

export function toChange(v: unknown): Change | null {
  const c = record(v);
  switch (c.kind) {
    case "mod":
      return isInt(c.type, 0, 48) &&
        MOD_TYPES.has(c.type) &&
        isInt(c.index, -1, 250)
        ? { kind: "mod", type: c.type, index: c.index }
        : null;
    case "wheels":
      return isInt(c.wheelType, 0, 12) && isInt(c.index, -1, 250)
        ? { kind: "wheels", wheelType: c.wheelType, index: c.index }
        : null;
    case "paint":
      return (c.slot === 0 || c.slot === 1) &&
        isInt(c.color, 0, 160) &&
        (PAINTS as readonly number[]).includes(c.color)
        ? { kind: "paint", slot: c.slot, color: c.color }
        : null;
    case "tint":
      return isInt(c.value, 0, 6) ? { kind: "tint", value: c.value } : null;
    case "plate":
      return isInt(c.value, 0, 5) ? { kind: "plate", value: c.value } : null;
    default:
      return null;
  }
}

/** The change's price before the shop multiplier; going back to stock is free. */
export function priceOf(change: Change, s: Settings): number {
  switch (change.kind) {
    case "mod":
      if (change.index < 0) return 0;
      if (change.type === 18) return s.turbo;
      if (change.type === 22) return s.xenon;
      return (PERFORMANCE_MODS as readonly number[]).includes(change.type)
        ? s.performance * (change.index + 1)
        : s.cosmetic;
    case "wheels":
      return change.index < 0 ? 0 : s.wheels;
    case "paint":
      return s.paint;
    case "tint":
      return change.value === 0 ? 0 : s.tint;
    case "plate":
      return s.plate;
    default: {
      const _exhaustive: never = change;
      return _exhaustive;
    }
  }
}

/** The props with the change applied (a new object). */
export function applyChange(props: VehicleProps, change: Change): VehicleProps {
  const next: VehicleProps = {
    ...props,
    mods: { ...props.mods },
    colors: [...props.colors],
  };
  switch (change.kind) {
    case "mod":
      next.mods[change.type] = (TOGGLE_MODS as readonly number[]).includes(
        change.type,
      )
        ? change.index >= 0
          ? 1
          : 0
        : change.index;
      break;
    case "wheels":
      next.wheelType = change.wheelType;
      next.mods[WHEEL_MOD] = change.index;
      break;
    case "paint":
      next.colors[change.slot] = change.color;
      if (change.slot === 0) next.customPrimary = null;
      else next.customSecondary = null;
      break;
    case "tint":
      next.windowTint = change.value;
      break;
    case "plate":
      next.plateIndex = change.value;
      break;
  }
  return next;
}

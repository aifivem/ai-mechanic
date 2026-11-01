import { record, type VehicleProps } from "@aicore-fivem/lib/shared";
import type { Settings } from "./settings";

/** The tuning change rules: price and props of one purchase, the same on both sides. No natives. */

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

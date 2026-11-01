import type { VehicleProps } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { PAINTS, WHEEL_MOD, type Change } from "common/tuning";
import { text } from "./labels";

export interface Option {
  id: string;
  label: string;
  change: Change;
  /** The option matches what the vehicle has now. */
  installed: boolean;
}

/** The levels of one mod slot (turbo and xenon: off / on). */
export function modOptions(
  vehicle: number,
  props: VehicleProps,
  type: number,
): Option[] {
  const current = props.mods[type] ?? -1;
  if (type === 18 || type === 22)
    return [0, 1].map((on) => ({
      id: String(on),
      label: Locale(on ? "MECH_ON" : "MECH_OFF"),
      change: { kind: "mod", type, index: on ? 0 : -1 },
      installed: (current === 1) === (on === 1),
    }));
  const count = GetNumVehicleMods(vehicle, type);
  return Array.from({ length: count + 1 }, (_, i) => {
    const index = i - 1;
    const label =
      index < 0
        ? Locale("MECH_STOCK")
        : GetLabelText(GetModTextLabel(vehicle, type, index));
    return {
      id: String(index),
      label:
        index < 0 || label === "NULL"
          ? index < 0
            ? label
            : Locale("MECH_LEVEL", index + 1)
          : label,
      change: { kind: "mod", type, index },
      installed: current === index,
    };
  });
}

/** The wheels of one wheel type (`count` read after the type was set on the vehicle). */
export function wheelOptions(
  vehicle: number,
  props: VehicleProps,
  wheelType: number,
  count: number,
): Option[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const index = i - 1;
    const label =
      index < 0
        ? Locale("MECH_STOCK")
        : GetLabelText(GetModTextLabel(vehicle, WHEEL_MOD, index));
    const installed =
      props.wheelType === wheelType && (props.mods[WHEEL_MOD] ?? -1) === index;
    return {
      id: String(index),
      label: label === "NULL" ? Locale("MECH_LEVEL", index + 1) : label,
      change: { kind: "wheels", wheelType, index },
      installed,
    };
  });
}

export function paintOptions(props: VehicleProps, slot: 0 | 1): Option[] {
  return PAINTS.map((color) => ({
    id: String(color),
    label: text(`MECH_PAINT_${color}`, `#${color}`),
    change: { kind: "paint", slot, color },
    installed: props.colors[slot] === color,
  }));
}

export function tintOptions(props: VehicleProps): Option[] {
  return [0, 1, 2, 3, 4, 5, 6].map((value) => ({
    id: String(value),
    label: text(`MECH_TINT_${value}`, `#${value}`),
    change: { kind: "tint", value },
    installed: props.windowTint === value,
  }));
}

export function plateOptions(props: VehicleProps): Option[] {
  return [0, 1, 2, 3, 4, 5].map((value) => ({
    id: String(value),
    label: text(`MECH_PLATE_${value}`, `#${value}`),
    change: { kind: "plate", value },
    installed: props.plateIndex === value,
  }));
}

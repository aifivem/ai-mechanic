import {
  coordsOf,
  onClientCallback,
  progressFor,
} from "@aicore-fivem/lib/server";
import { distance, fail, oneArg, readId } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/mechanic";
import { content, pay } from "./content";
import { driven } from "./driven";

/** The vehicle the player drives at a car wash, or a refusal. */
function washable(source: number, netId: number): number | string {
  const p = coordsOf(source);
  if (![...content.washes.values()].some((w) => distance(p, w.coords) <= 10))
    return "MECH_ERR_FAR";
  const vehicle = driven(source, netId);
  if (!vehicle) return "MECH_ERR_DRIVER";
  if (GetVehicleDirtLevel(vehicle) < 0.1) return "MECH_ERR_CLEAN";
  return vehicle;
}

onClientCallback(
  EVENTS.wash,
  { args: oneArg(readId), lock: true },
  async (source, netId) => {
    const first = washable(source, netId);
    if (typeof first === "string") return fail(first);
    const { washPrice, washSeconds } = content.settings;
    const done = await progressFor(source, {
      label: Locale("MECH_WASHING"),
      duration: washSeconds * 1000,
      allowVehicle: true,
    });
    // A cancelled bar ends quietly.
    if (!done) return { ok: true };
    const vehicle = washable(source, netId);
    if (typeof vehicle === "string") return fail(vehicle);
    if (!pay(source, null, "player", washPrice, "carwash"))
      return fail("MECH_ERR_MONEY");
    SetVehicleDirtLevel(vehicle, 0);
    const owner = NetworkGetEntityOwner(vehicle);
    if (owner > 0)
      emitNet(EVENTS.fix, owner, NetworkGetNetworkIdFromEntity(vehicle), -1);
    return { ok: true };
  },
);

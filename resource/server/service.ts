import {
  aiLog,
  inventory,
  notify,
  onClientCallback,
  optionalExport,
} from "@aicore-fivem/lib/server";
import { asArgs } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/mechanic";
import {
  canUse,
  content,
  distance,
  fail,
  ownedId,
  panel,
  pos,
} from "./content";

/** Job shops' stashes (registered again when shops change; ai-core hands them to an inventory that starts later). */
const stashName = (shopId: string) => `mechanic_${shopId}`;
function registerStashes(): void {
  for (const shop of content.shops.values())
    if (shop.job && shop.stash)
      inventory.registerStash(stashName(shop.id), shop.label, 50, 250_000, [
        shop.job,
      ]);
}

onClientCallback(
  EVENTS.stash,
  { args: ([id]) => asArgs(typeof id === "string" ? id : null) },
  (source, id) => {
    const shop = content.shops.get(id);
    if (!shop?.job || !shop.stash) return fail("MECH_ERR_FAR");
    if (!canUse(source, shop)) return fail("MECH_ERR_JOB");
    if (distance(pos(source), shop.stash) > 3) return fail("MECH_ERR_FAR");
    return inventory.openInventory(source, stashName(shop.id))
      ? { ok: true }
      : fail("MECH_ERR_FAR");
  },
);

/** Repair kits waiting for their progress bar: checked against the time they need. */
const kits = new Map<
  number,
  { token: number; vehicle: number; startedAt: number; seconds: number }
>();
let nextToken = 0;

/** The repair kit: on foot next to a vehicle, brings its engine up to the panel's value. */
function useKit(source: number): boolean {
  const ped = GetPlayerPed(String(source));
  if (GetVehiclePedIsIn(ped, false)) {
    notify(source, Locale("MECH_KIT_OUTSIDE"), "warning");
    return false;
  }
  const p = pos(source);
  const vehicle = (GetAllVehicles() as number[]).find((v) => {
    const [x = 0, y = 0, z = 0] = GetEntityCoords(v);
    return distance(p, { x, y, z }) <= 4;
  });
  if (vehicle === undefined) {
    notify(source, Locale("MECH_KIT_NO_VEHICLE"), "warning");
    return false;
  }
  if (GetVehicleEngineHealth(vehicle) >= content.settings.kitEngine) {
    notify(source, Locale("MECH_KIT_NOT_NEEDED"), "info");
    return false;
  }
  const token = ++nextToken;
  kits.set(source, {
    token,
    vehicle,
    startedAt: Date.now(),
    seconds: content.settings.kitSeconds,
  });
  emitNet(
    EVENTS.kitStart,
    source,
    token,
    content.settings.kitSeconds,
    NetworkGetNetworkIdFromEntity(vehicle),
  );
  // The kit is spent in kitFinish, after the progress.
  return false;
}

onClientCallback(
  EVENTS.kitFinish,
  {
    args: ([token]) => asArgs(typeof token === "number" ? token : null),
    lock: true,
  },
  (source, token) => {
    const kit = kits.get(source);
    if (!kit || kit.token !== token) return fail("MECH_ERR_FAR");
    kits.delete(source);
    if (
      Date.now() - kit.startedAt < kit.seconds * 800 ||
      !DoesEntityExist(kit.vehicle)
    )
      return fail("MECH_ERR_FAR");
    const [x = 0, y = 0, z = 0] = GetEntityCoords(kit.vehicle);
    if (distance(pos(source), { x, y, z }) > 5) return fail("MECH_ERR_FAR");
    if (!inventory.removeItem(source, "repairkit", 1))
      return fail("MECH_ERR_FAR");
    const engine = content.settings.kitEngine;
    const owner = NetworkGetEntityOwner(kit.vehicle);
    if (owner > 0)
      emitNet(
        EVENTS.fix,
        owner,
        NetworkGetNetworkIdFromEntity(kit.vehicle),
        engine,
      );
    const id = ownedId(kit.vehicle);
    if (id !== null) optionalExport("ai-vehicles")?.SaveVehicle(id, { engine });
    notify(source, Locale("MECH_KIT_DONE"), "success");
    aiLog("repairs", "repair kit", { source });
    return { ok: true };
  },
);

inventory.registerUsableItem("repairkit", (source: number) => useKit(source));
registerStashes();
panel.onChange("shops", registerStashes);
on("playerDropped", () => kits.delete(Number(globalThis.source)));

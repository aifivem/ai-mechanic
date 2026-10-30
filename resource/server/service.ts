import {
  aiLog,
  entityCoords,
  inventory,
  isNear,
  nearestVehicleTo,
  notify,
  onClientCallback,
  optionalExport,
  PendingActions,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readId, readText } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/mechanic";
import { canUse, content, ownedId, panel } from "./content";

/** Job shops' stashes (registered again when shops or the stash size change; ai-core keeps them for later inventories). */
const stashName = (shopId: string) => `mechanic_${shopId}`;
function registerStashes(): void {
  const { stashSlots, stashWeight } = content.settings;
  for (const shop of content.shops.values())
    if (shop.job && shop.stash)
      inventory.registerStash(
        stashName(shop.id),
        shop.label,
        stashSlots,
        stashWeight,
        [shop.job],
      );
}

onClientCallback(
  EVENTS.stash,
  { args: oneArg((v) => readText(v, 64)) },
  (source, id) => {
    const shop = content.shops.get(id);
    if (!shop?.job || !shop.stash) return fail("MECH_ERR_FAR");
    if (!canUse(source, shop)) return fail("MECH_ERR_JOB");
    if (!isNear(source, shop.stash, 3)) return fail("MECH_ERR_FAR");
    return inventory.openInventory(source, stashName(shop.id))
      ? { ok: true }
      : fail("MECH_ERR_FAR");
  },
);

/** Repair kits waiting for their progress bar (lib `PendingActions`: token, 80% of the time, freed on drop). */
const kits = new PendingActions<number>();

/** The repair kit: on foot next to a vehicle, brings its engine up to the panel's value. */
function useKit(source: number): boolean {
  if (GetVehiclePedIsIn(GetPlayerPed(String(source)), false)) {
    notify(source, Locale("MECH_KIT_OUTSIDE"), "warning");
    return false;
  }
  const vehicle = nearestVehicleTo(source, 4);
  if (!vehicle) {
    notify(source, Locale("MECH_KIT_NO_VEHICLE"), "warning");
    return false;
  }
  if (GetVehicleEngineHealth(vehicle) >= content.settings.kitEngine) {
    notify(source, Locale("MECH_KIT_NOT_NEEDED"), "info");
    return false;
  }
  const seconds = content.settings.kitSeconds;
  emitNet(
    EVENTS.kitStart,
    source,
    kits.start(source, vehicle, seconds * 1000),
    seconds,
    NetworkGetNetworkIdFromEntity(vehicle),
  );
  // The kit is spent in kitFinish, after the progress.
  return false;
}

onClientCallback(
  EVENTS.kitFinish,
  { args: oneArg(readId), lock: true },
  (source, token) => {
    const vehicle = kits.take(source, token);
    if (
      vehicle === null ||
      !DoesEntityExist(vehicle) ||
      !isNear(source, entityCoords(vehicle), 5)
    )
      return fail("MECH_ERR_FAR");
    if (!inventory.removeItem(source, content.settings.kitItem, 1))
      return fail("MECH_ERR_FAR");
    const engine = content.settings.kitEngine;
    const owner = NetworkGetEntityOwner(vehicle);
    if (owner > 0)
      emitNet(
        EVENTS.fix,
        owner,
        NetworkGetNetworkIdFromEntity(vehicle),
        engine,
      );
    const id = ownedId(vehicle);
    if (id !== null) optionalExport("ai-vehicles")?.SaveVehicle(id, { engine });
    notify(source, Locale("MECH_KIT_DONE"), "success");
    aiLog("repairs", "repair kit", { source });
    return { ok: true };
  },
);

/** Registers the panel's kit item as usable (once per name; a renamed kit leaves the old name doing nothing). */
const kitItems = new Set<string>();
function registerKit(): void {
  const item = content.settings.kitItem;
  if (kitItems.has(item)) return;
  kitItems.add(item);
  inventory.registerUsableItem(item, (source: number) =>
    item === content.settings.kitItem ? useKit(source) : false,
  );
}

registerKit();
registerStashes();
panel.onChange("shops", registerStashes);
panel.onChange("settings", () => {
  registerKit();
  registerStashes();
});

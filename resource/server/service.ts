import {
  aiLog,
  entityCoords,
  inventory,
  isNear,
  nearestVehicleTo,
  notify,
  onClientCallback,
  optionalExport,
  progressFor,
  SourceLock,
  vehicleOf,
} from "@aicore-fivem/lib/server";
import {
  fail,
  oneArg,
  readText,
  RecordObjects,
} from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readShop } from "common/mechanic";
import { canUse, content, ownedId, panel } from "./content";

/**
 * Job shops' stashes: an edited shop registers only its own again, a stash size change all of them (ai-core keeps
 * them for later inventories; a stash has no unregister).
 */
const stashName = (shopId: string) => `mechanic_${shopId}`;
const stashes = new RecordObjects(panel, "shops", readShop, (id, shop) => {
  if (!shop.job || !shop.stash) return;
  const { stashSlots, stashWeight } = content.settings;
  inventory.registerStash(stashName(id), shop.label, stashSlots, stashWeight, [
    shop.job,
  ]);
});

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

/** One repair kit at a time per player. */
const repairing = new SourceLock();

/** The kit's work: the server-timed progress bar facing the vehicle, then the engine value if still next to it. */
async function repair(source: number, vehicle: number): Promise<void> {
  const done = await progressFor(source, {
    label: Locale("MECH_KIT_WORKING"),
    duration: content.settings.kitSeconds * 1000,
    anim: { dict: "mini@repair", clip: "fixing_a_ped" },
    face: entityCoords(vehicle),
  });
  if (
    !done ||
    !DoesEntityExist(vehicle) ||
    !isNear(source, entityCoords(vehicle), 5)
  )
    return;
  if (!inventory.removeItem(source, content.settings.kitItem, 1)) return;
  const engine = content.settings.kitEngine;
  const owner = NetworkGetEntityOwner(vehicle);
  if (owner > 0)
    emitNet(EVENTS.fix, owner, NetworkGetNetworkIdFromEntity(vehicle), engine);
  const id = ownedId(vehicle);
  if (id !== null) optionalExport("ai-vehicles")?.SaveVehicle(id, { engine });
  notify(source, Locale("MECH_KIT_DONE"), "success");
  aiLog("repairs", "repair kit", { source });
}

/** The repair kit: on foot next to a vehicle, brings its engine up to the panel's value. */
function useKit(source: number): boolean {
  if (vehicleOf(source)) {
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
  void repairing.run(source, undefined, () => repair(source, vehicle));
  // The kit is spent in repair, after the progress.
  return false;
}

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
panel.onChange("settings", () => {
  registerKit();
  stashes.rebuildAll();
});

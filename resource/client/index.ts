import {
  AdminWorld,
  allows,
  cache,
  callAction,
  notify,
  onMembershipChange,
  onServerEvent,
  Points,
  progress,
} from "@aicore-fivem/lib/client";
import { readFinite, readId, RecordObjects } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import {
  EVENTS,
  readSettings,
  readShop,
  readWash,
  type Shop,
} from "common/mechanic";
import { Customs, FALLBACK } from "./customs";

const world = new AdminWorld(["settings", "shops", "washes"]);
const settings = world.view("settings", readSettings);

const driving = (): number | null =>
  cache.vehicle !== false && cache.seat === -1 ? cache.vehicle : null;
/** Shop, stash and car wash points with their blips, one record at a time. */
const points = new Points();
const shops = new RecordObjects(world, "shops", readShop, (id, shop) => {
  const s = settings.value;
  // Job shops and their stash show only to that job's on-duty members (the server checks the same rule).
  const canShow = () => allows(shop.access);
  points.add(`shop:${id}`, {
    ped: shop.ped ?? undefined,
    coords: shop.coords,
    label: Locale("MECH_PROMPT_SHOP", shop.label),
    icon: "screwdriver-wrench",
    radius: shop.radius,
    targetRadius: 2,
    interval: 400,
    canShow,
    blip: shop.blip
      ? { ...(shop.job ? s.jobShopBlip : s.shopBlip), label: shop.label }
      : undefined,
    onPressed: () => openShop(shop),
  });
  if (shop.job && shop.stash)
    points.add(`stash:${id}`, {
      coords: shop.stash,
      label: Locale("MECH_PROMPT_STASH"),
      icon: "box-open",
      radius: 1.5,
      interval: 400,
      canShow,
      onPressed: () => openStash(id),
    });
  return () => {
    points.remove(`shop:${id}`);
    points.remove(`stash:${id}`);
  };
});
const washes = new RecordObjects(world, "washes", readWash, (id, at) => {
  points.add(`wash:${id}`, {
    coords: at.coords,
    label: Locale("MECH_PROMPT_WASH", settings.value.washPrice),
    icon: "droplet",
    radius: 7.5,
    promptOnly: true,
    interval: 400,
    blip: { ...settings.value.washBlip, label: at.label },
    onPressed: () => wash(),
  });
  return () => points.remove(`wash:${id}`);
});
// Blip looks and the wash price are settings every record reads.
world.onChange("settings", () => {
  shops.rebuildAll();
  washes.rebuildAll();
});
onMembershipChange(() => points.refresh());

async function openShop(shop: Shop): Promise<void> {
  const vehicle = driving();
  if (vehicle === null) return notify(Locale("MECH_ERR_DRIVER"), "warning");
  await new Customs(vehicle, shop, settings.value).run();
}

async function wash(): Promise<void> {
  const vehicle = driving();
  if (vehicle === null) return notify(Locale("MECH_ERR_DRIVER"), "warning");
  if (!(await callAction(EVENTS.wash, [VehToNet(vehicle)], FALLBACK))) return;
  await progress({
    label: Locale("MECH_WASHING"),
    duration: settings.value.washSeconds * 1000,
    allowVehicle: true,
  });
}

async function openStash(shopId: string): Promise<void> {
  await callAction(EVENTS.stash, [shopId], FALLBACK);
}

/** The vehicle's owner applies what only it can change: health, deformation, dirt. */
onServerEvent(
  EVENTS.fix,
  {
    args: ([netId, engine]): [number, number | null] | null => {
      const id = readId(netId);
      const value = engine == null ? null : readFinite(engine);
      return id !== null && (engine == null || value !== null)
        ? [id, value]
        : null;
    },
  },
  (netId, engine) => {
    if (!NetworkDoesEntityExistWithNetworkId(netId)) return;
    const vehicle = NetToVeh(netId);
    if (engine === -1) {
      SetVehicleDirtLevel(vehicle, 0);
      WashDecalsFromVehicle(vehicle, 1.0);
    } else if (engine === null) {
      SetVehicleFixed(vehicle);
      SetVehicleDeformationFixed(vehicle);
      SetVehicleEngineHealth(vehicle, 1000);
      SetVehicleBodyHealth(vehicle, 1000);
      SetVehicleUndriveable(vehicle, false);
    } else {
      SetVehicleEngineHealth(vehicle, engine);
      SetVehicleUndriveable(vehicle, false);
    }
  },
);

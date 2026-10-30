import {
  AdminWorld,
  cache,
  notify,
  onServerEvent,
  Points,
  progress,
  triggerServerCallback,
} from "@aicore-fivem/lib/client";
import { record } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import {
  EVENTS,
  readSettings,
  readShops,
  readWashes,
  type Shop,
} from "common/mechanic";
import { Customs, errorText } from "./customs";

const world = new AdminWorld(["settings", "shops", "washes"]);
const content = {
  settings: readSettings(world.get("settings")),
  shops: readShops(world.get("shops")),
  washes: readWashes(world.get("washes")),
};

const driving = (): number | null =>
  cache.vehicle !== false &&
  GetPedInVehicleSeat(cache.vehicle, -1) === cache.ped
    ? cache.vehicle
    : null;

/** Shop, stash and car wash points with their blips, built again when the panel changes them. */
const points = new Points();
function rebuild(): void {
  points.clear();
  for (const shop of content.shops.values()) {
    points.add(`shop:${shop.id}`, {
      ped: shop.ped ?? undefined,
      coords: shop.coords,
      label: Locale("MECH_PROMPT_SHOP", shop.label),
      icon: "screwdriver-wrench",
      radius: shop.radius,
      targetRadius: 2,
      interval: 400,
      blip: shop.blip
        ? {
            sprite: shop.job ? 446 : 72,
            color: 0,
            scale: 0.7,
            label: shop.label,
          }
        : undefined,
      onPressed: () => openShop(shop),
    });
    if (shop.job && shop.stash)
      points.add(`stash:${shop.id}`, {
        coords: shop.stash,
        label: Locale("MECH_PROMPT_STASH"),
        icon: "box-open",
        radius: 1.5,
        interval: 400,
        onPressed: () => openStash(shop.id),
      });
  }
  for (const at of content.washes)
    points.add(`wash:${at.id}`, {
      coords: at.coords,
      label: Locale("MECH_PROMPT_WASH", content.settings.washPrice),
      icon: "droplet",
      radius: 7.5,
      promptOnly: true,
      interval: 400,
      blip: { sprite: 100, color: 0, scale: 0.7, label: at.label },
      onPressed: () => wash(),
    });
}

rebuild();
world.onChange("settings", () => {
  content.settings = readSettings(world.get("settings"));
  rebuild();
});
world.onChange("shops", () => {
  content.shops = readShops(world.get("shops"));
  rebuild();
});
world.onChange("washes", () => {
  content.washes = readWashes(world.get("washes"));
  rebuild();
});

async function openShop(shop: Shop): Promise<void> {
  const vehicle = driving();
  if (vehicle === null) return notify(Locale("MECH_ERR_DRIVER"), "warning");
  await new Customs(vehicle, shop, content.settings).run();
}

async function wash(): Promise<void> {
  const vehicle = driving();
  if (vehicle === null) return notify(Locale("MECH_ERR_DRIVER"), "warning");
  const result = record(
    await triggerServerCallback(EVENTS.wash, [VehToNet(vehicle)]).catch(
      () => null,
    ),
  );
  if (result.ok !== true)
    return notify(errorText(result, "MECH_ERR_FAR"), "error");
  await progress({
    label: Locale("MECH_WASHING"),
    duration: content.settings.washSeconds * 1000,
    allowVehicle: true,
  });
}

async function openStash(shopId: string): Promise<void> {
  const result = record(
    await triggerServerCallback(EVENTS.stash, [shopId]).catch(() => null),
  );
  if (result.ok !== true) notify(errorText(result, "MECH_ERR_FAR"), "error");
}

/** The vehicle's owner applies what only it can change: health, deformation, dirt. */
onServerEvent(
  EVENTS.fix,
  {
    args: ([netId, engine]): [number, number | null] | null =>
      typeof netId === "number" &&
      (engine == null || typeof engine === "number")
        ? [netId, engine ?? null]
        : null,
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

onServerEvent(
  EVENTS.kitStart,
  {
    args: ([token, seconds, netId]): [number, number, number] | null =>
      typeof token === "number" &&
      typeof seconds === "number" &&
      typeof netId === "number"
        ? [token, seconds, netId]
        : null,
  },
  async (token, seconds, netId) => {
    if (NetworkDoesEntityExistWithNetworkId(netId))
      TaskTurnPedToFaceEntity(cache.ped, NetToVeh(netId), 1000);
    const done = await progress({
      label: Locale("MECH_KIT_WORKING"),
      duration: seconds * 1000,
      anim: { dict: "mini@repair", clip: "fixing_a_ped" },
    });
    if (!done) return;
    const result = record(
      await triggerServerCallback(EVENTS.kitFinish, [token]).catch(() => null),
    );
    if (result.ok !== true) notify(errorText(result, "MECH_ERR_FAR"), "error");
  },
);

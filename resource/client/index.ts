import {
  AdminWorld,
  cache,
  callAction,
  getPlayerData,
  notify,
  onPlayerData,
  onServerEvent,
  Points,
  progress,
} from "@aicore-fivem/lib/client";
import { readFinite, readId } from "@aicore-fivem/lib/shared";
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
const content = {
  shops: world.records("shops", readShop),
  washes: world.records("washes", readWash),
};

const driving = (): number | null =>
  cache.vehicle !== false && cache.seat === -1 ? cache.vehicle : null;
/** Job shops and their stash show only to that job's on-duty members (the server checks again). */
const onDutyFor = (shop: Shop) =>
  !shop.job || getPlayerData("duty") === shop.job;

/** Shop, stash and car wash points with their blips, built again when the panel changes them. */
const points = new Points();
function rebuild(): void {
  points.clear();
  const s = settings.value;
  for (const shop of content.shops.values()) {
    points.add(`shop:${shop.id}`, {
      ped: shop.ped ?? undefined,
      coords: shop.coords,
      label: Locale("MECH_PROMPT_SHOP", shop.label),
      icon: "screwdriver-wrench",
      radius: shop.radius,
      targetRadius: 2,
      interval: 400,
      canShow: () => onDutyFor(shop),
      blip: shop.blip
        ? { ...(shop.job ? s.jobShopBlip : s.shopBlip), label: shop.label }
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
        canShow: () => onDutyFor(shop),
        onPressed: () => openStash(shop.id),
      });
  }
  for (const at of content.washes.values())
    points.add(`wash:${at.id}`, {
      coords: at.coords,
      label: Locale("MECH_PROMPT_WASH", s.washPrice),
      icon: "droplet",
      radius: 7.5,
      promptOnly: true,
      interval: 400,
      blip: { ...s.washBlip, label: at.label },
      onPressed: () => wash(),
    });
}

rebuild();
world.onChange("settings", rebuild);
world.onChange("shops", rebuild);
world.onChange("washes", rebuild);
onPlayerData("duty", () => points.refresh());

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

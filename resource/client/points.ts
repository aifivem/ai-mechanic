import {
  allows,
  callAction,
  drivenVehicle,
  notify,
  onMembershipChange,
  Points,
  radial,
} from "@aicore-fivem/lib/client";
import { RecordObjects } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS } from "common/mechanic";
import { readShop, readWash, type Shop } from "common/shop";
import { Customs } from "./customs/customs";
import { settings, world } from "./content";
import { FALLBACK } from "./fallback";

/** Shop, stash and car wash points with their blips, one record at a time. */
const points = new Points();
export const shops = new RecordObjects(world, "shops", readShop, (id, shop) => {
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
onMembershipChange(() => {
  points.refresh();
  radial.refresh();
});

async function openShop(shop: Shop): Promise<void> {
  const vehicle = drivenVehicle();
  if (vehicle === false) return notify(Locale("MECH_ERR_DRIVER"), "warning");
  await new Customs(vehicle, shop, settings.value).run();
}

async function wash(): Promise<void> {
  const vehicle = drivenVehicle();
  if (vehicle === false) return notify(Locale("MECH_ERR_DRIVER"), "warning");
  // The server runs the progress bar, then charges and washes.
  await callAction(EVENTS.wash, [VehToNet(vehicle)], {
    ...FALLBACK,
    timeout: settings.value.washSeconds * 1000 + 30_000,
  });
}

async function openStash(shopId: string): Promise<void> {
  await callAction(EVENTS.stash, [shopId], FALLBACK);
}

import { AdminWorld, cache, hidePrompt, notify, onPromptPressed, onServerEvent, progress, showPrompt, triggerServerCallback, Zones } from "@aicore-fivem/lib/client";
import { record } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readSettings, readShops, readWashes, type Shop } from "common/mechanic";
import { Customs, errorText } from "./customs";

const world = new AdminWorld(["settings", "shops", "washes"]);
const content = { settings: readSettings(world.get("settings")), shops: readShops(world.get("shops")), washes: readWashes(world.get("washes")) };
const BLIP_TEXT = "AIMECH_BLIP";
AddTextEntry(BLIP_TEXT, "~a~");

const driving = (): number | null => (cache.vehicle !== false && GetPedInVehicleSeat(cache.vehicle, -1) === cache.ped ? cache.vehicle : null);

/** Shop, stash and car wash zones with their prompts and blips, built again when the panel changes them. */
class Places {
  private readonly zones = new Zones();
  private blips: number[] = [];
  busy = false;

  rebuild(): void {
    this.zones.clear();
    for (const blip of this.blips) RemoveBlip(blip);
    this.blips = [];
    for (const shop of content.shops.values()) {
      this.add(`shop:${shop.id}`, shop.coords, shop.radius, () => Locale("MECH_PROMPT_SHOP", shop.label));
      if (shop.job && shop.stash) this.add(`stash:${shop.id}`, shop.stash, 1.5, () => Locale("MECH_PROMPT_STASH"));
      if (shop.blip) this.blip(shop.coords, shop.job ? 446 : 72, shop.label);
    }
    for (const wash of content.washes) {
      this.add(`wash:${wash.id}`, wash.coords, 7.5, () => Locale("MECH_PROMPT_WASH", content.settings.washPrice));
      this.blip(wash.coords, 100, wash.label);
    }
  }

  private add(id: string, center: { x: number; y: number; z: number }, radius: number, label: () => string): void {
    this.zones.add(id, { shape: { type: "sphere", center, radius }, interval: 400, onEnter: () => showPrompt(id, label()), onExit: () => hidePrompt(id) });
  }

  private blip(at: { x: number; y: number; z: number }, sprite: number, label: string): void {
    const blip = AddBlipForCoord(at.x, at.y, at.z);
    SetBlipSprite(blip, sprite);
    SetBlipScale(blip, 0.7);
    SetBlipAsShortRange(blip, true);
    BeginTextCommandSetBlipName(BLIP_TEXT);
    AddTextComponentSubstringPlayerName(label);
    EndTextCommandSetBlipName(blip);
    this.blips.push(blip);
  }
}

const places = new Places();
places.rebuild();
world.onChange("settings", () => (content.settings = readSettings(world.get("settings"))));
world.onChange("shops", () => {
  content.shops = readShops(world.get("shops"));
  places.rebuild();
});
world.onChange("washes", () => {
  content.washes = readWashes(world.get("washes"));
  places.rebuild();
});

async function openShop(shop: Shop): Promise<void> {
  const vehicle = driving();
  if (vehicle === null) return notify(Locale("MECH_ERR_DRIVER"), "warning");
  await new Customs(vehicle, shop, content.settings).run();
}

async function wash(): Promise<void> {
  const vehicle = driving();
  if (vehicle === null) return notify(Locale("MECH_ERR_DRIVER"), "warning");
  const result = record(await triggerServerCallback(EVENTS.wash, [VehToNet(vehicle)]).catch(() => null));
  if (result.ok !== true) return notify(errorText(result, "MECH_ERR_FAR"), "error");
  await progress({ label: Locale("MECH_WASHING"), duration: content.settings.washSeconds * 1000, allowVehicle: true });
}

async function openStash(shopId: string): Promise<void> {
  const result = record(await triggerServerCallback(EVENTS.stash, [shopId]).catch(() => null));
  if (result.ok !== true) notify(errorText(result, "MECH_ERR_FAR"), "error");
}

onPromptPressed((id) => {
  if (places.busy) return;
  const [kind, key = ""] = id.split(":");
  const shop = content.shops.get(key);
  const run = kind === "shop" && shop ? openShop(shop) : kind === "stash" ? openStash(key) : kind === "wash" ? wash() : null;
  if (!run) return;
  places.busy = true;
  void run.finally(() => (places.busy = false));
});

/** The vehicle's owner applies what only it can change: health, deformation, dirt. */
onServerEvent(
  EVENTS.fix,
  { args: ([netId, engine]): [number, number | null] | null => (typeof netId === "number" && (engine == null || typeof engine === "number") ? [netId, engine ?? null] : null) },
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
  { args: ([token, seconds, netId]): [number, number, number] | null => (typeof token === "number" && typeof seconds === "number" && typeof netId === "number" ? [token, seconds, netId] : null) },
  async (token, seconds, netId) => {
    if (NetworkDoesEntityExistWithNetworkId(netId)) TaskTurnPedToFaceEntity(cache.ped, NetToVeh(netId), 1000);
    const done = await progress({ label: Locale("MECH_KIT_WORKING"), duration: seconds * 1000, anim: { dict: "mini@repair", clip: "fixing_a_ped" } });
    if (!done) return;
    const result = record(await triggerServerCallback(EVENTS.kitFinish, [token]).catch(() => null));
    if (result.ok !== true) notify(errorText(result, "MECH_ERR_FAR"), "error");
  },
);

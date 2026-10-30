import {
  AdminPanel,
  optionalExport,
  resourceExport,
} from "@aicore-fivem/lib/server";
import {
  readSettings,
  readShops,
  readWashes,
  type Shop,
} from "common/mechanic";
import { mechanicSchema } from "./schema";

export const core = resourceExport("ai-core");
export const panel = new AdminPanel(mechanicSchema);
/** Panel content, parsed again after every change. */
export const content = {
  settings: readSettings(panel.get("settings")),
  shops: readShops(panel.get("shops")),
  washes: readWashes(panel.get("washes")),
};
panel.onChange(
  "settings",
  () => (content.settings = readSettings(panel.get("settings"))),
);
panel.onChange("shops", () => (content.shops = readShops(panel.get("shops"))));
panel.onChange(
  "washes",
  () => (content.washes = readWashes(panel.get("washes"))),
);

export const fail = (error: string) => ({ ok: false as const, error });

export function pos(source: number): { x: number; y: number; z: number } {
  const [x = 0, y = 0, z = 0] = GetEntityCoords(GetPlayerPed(String(source)));
  return { x, y, z };
}

export const distance = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** The shop the player stands in (with the feature turned on), or null. */
export function shopAt(
  source: number,
  feature: "repair" | "tuning",
): Shop | null {
  const p = pos(source);
  for (const shop of content.shops.values())
    if (shop[feature] && distance(p, shop.coords) <= shop.radius + 2)
      return shop;
  return null;
}

/** Job shops serve that job's on-duty members only. */
export const canUse = (source: number, shop: Shop) =>
  !shop.job || core.GetDutyJob(source) === shop.job;

/** The vehicle behind `netId` when the player drives it, or null. */
export function drivenVehicle(source: number, netId: number): number | null {
  const vehicle = NetworkGetEntityFromNetworkId(netId);
  if (!vehicle || !DoesEntityExist(vehicle) || GetEntityType(vehicle) !== 2)
    return null;
  return GetPedInVehicleSeat(vehicle, -1) === GetPlayerPed(String(source))
    ? vehicle
    : null;
}

/** Pays at a shop: a job shop from the job's account, a public one from the driver's accounts in panel order. */
export function pay(
  source: number,
  shop: Shop | null,
  amount: number,
  reason: string,
): boolean {
  if (amount <= 0) return true;
  if (shop?.job)
    return core.RemoveSharedMoney("job", shop.job, "bank", amount, reason);
  return content.settings.accounts.some((a) =>
    core.RemoveMoney(source, a, amount, reason),
  );
}

/** ai-vehicles' id of an owned vehicle (its changes are saved), or null. */
export const ownedId = (vehicle: number): number | null =>
  optionalExport("ai-vehicles")?.GetVehicleIdByEntity(vehicle) ?? null;

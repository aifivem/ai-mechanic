import {
  AdminPanel,
  coordsOf,
  online,
  optionalExport,
  resourceExport,
} from "@aicore-fivem/lib/server";
import { distance, record } from "@aicore-fivem/lib/shared";
import { readSettings, readShop, readWash, type Shop } from "common/mechanic";
import { mechanicSchema } from "./schema";

export const core = resourceExport("ai-core");
export const panel = new AdminPanel(mechanicSchema);
panel.rule("settings", (_key, next) => {
  const v = record(next);
  return typeof v.billMin === "number" &&
    typeof v.billMax === "number" &&
    v.billMin > v.billMax
    ? "ADMIN_ERR_BILL_RANGE"
    : null;
});
const settings = panel.view("settings", readSettings);
/** Panel content, kept current by the panel's views. */
export const content = {
  get settings() {
    return settings.value;
  },
  shops: panel.records("shops", readShop),
  washes: panel.records("washes", readWash),
};

/** The shop the player stands in (with the feature turned on), or null. */
export function shopAt(
  source: number,
  feature: "repair" | "tuning",
): Shop | null {
  const p = coordsOf(source);
  for (const shop of content.shops.values())
    if (shop[feature] && distance(p, shop.coords) <= shop.radius + 2)
      return shop;
  return null;
}

/** Job shops serve that job's on-duty members only (the client's `canShow` reads the same rule). */
export const canUse = (source: number, shop: Shop) =>
  online.allows(source, shop.access);

/** ai-vehicles' id of an owned vehicle (its changes are saved), or null. */
export const ownedId = (vehicle: number): number | null =>
  optionalExport("ai-vehicles")?.GetVehicleIdByEntity(vehicle) ?? null;

/** The player's character owns the vehicle in ai-vehicles. */
function ownsVehicle(source: number, vehicle: number): boolean {
  const id = ownedId(vehicle);
  const owner =
    id === null ? null : optionalExport("ai-vehicles")?.GetVehicle(id)?.owner;
  const charId = online.charId(source);
  return (
    owner?.type === "character" &&
    charId !== undefined &&
    owner.id === String(charId)
  );
}

/**
 * Who pays a shop's bill: a job shop's account for customers' and fleet vehicles, the member's own accounts (panel
 * order) for a car the member owns and in public shops.
 */
export function payerOf(
  source: number,
  shop: Shop | null,
  vehicle: number | null,
): "job" | "player" {
  return shop?.job && (vehicle === null || !ownsVehicle(source, vehicle))
    ? "job"
    : "player";
}

/** Pays at a shop for `payerOf`'s payer. */
export function pay(
  source: number,
  shop: Shop | null,
  payer: "job" | "player",
  amount: number,
  reason: string,
): boolean {
  if (amount <= 0) return true;
  if (payer === "job" && shop?.job)
    return core.RemoveSharedMoney("job", shop.job, "bank", amount, reason);
  return content.settings.accounts.some((a) =>
    core.RemoveMoney(source, a, amount, reason),
  );
}

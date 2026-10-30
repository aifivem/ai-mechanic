import {
  aiLog,
  aiLogChannels,
  EntityState,
  notify,
  onClientCallback,
  optionalExport,
} from "@aicore-fivem/lib/server";
import { asArgs, toVehicleProps } from "@aicore-fivem/lib/shared";
import { VEHICLE_BAGS } from "@aicore-fivem/shared";
import { Locale } from "common";
import {
  applyChange,
  EVENTS,
  priceOf,
  toChange,
  type Change,
} from "common/mechanic";
import {
  canUse,
  content,
  distance,
  drivenVehicle,
  fail,
  ownedId,
  pay,
  pos,
  shopAt,
} from "./content";
import "./service";

const propsState = new EntityState(
  VEHICLE_BAGS.props,
  (v) => toVehicleProps(v) ?? undefined,
);

aiLogChannels({ tuning: { active: false }, repairs: { active: false } });

const netIdOk = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

/**
 * One tuning purchase. The base is the vehicle's props bag (owned vehicles) or what the client read; plate, health
 * and dirt always come from the server so a purchase cannot change them.
 */
onClientCallback(
  EVENTS.buy,
  {
    args: ([netId, raw, base]): [number, Change, unknown] | null => {
      const change = toChange(raw);
      return netIdOk(netId) && change ? [netId, change, base] : null;
    },
    lock: true,
  },
  (source, netId, change, base) => {
    const shop = shopAt(source, "tuning");
    if (!shop) return fail("MECH_ERR_FAR");
    if (!canUse(source, shop)) return fail("MECH_ERR_JOB");
    const vehicle = drivenVehicle(source, netId);
    if (vehicle === null) return fail("MECH_ERR_DRIVER");
    const current = propsState.get(vehicle) ?? toVehicleProps(base);
    if (!current || current.model !== GetEntityModel(vehicle))
      return fail("MECH_ERR_DRIVER");
    const price = Math.round(
      priceOf(change, content.settings) * shop.multiplier,
    );
    if (!pay(source, shop, price, `tuning:${shop.id}`))
      return fail("MECH_ERR_MONEY");
    const next = {
      ...applyChange(current, change),
      plate: GetVehicleNumberPlateText(vehicle),
      engineHealth: GetVehicleEngineHealth(vehicle),
      bodyHealth: GetVehicleBodyHealth(vehicle),
      dirt: GetVehicleDirtLevel(vehicle),
    };
    propsState.set(vehicle, next);
    const id = ownedId(vehicle);
    if (id !== null)
      optionalExport("ai-vehicles")?.SaveVehicle(id, { props: next });
    if (price > 0) notify(source, Locale("MECH_PAID", price), "success", 2500);
    aiLog("tuning", `bought ${change.kind}`, {
      source,
      metadata: { shop: shop.id, price, change },
    });
    return { ok: true };
  },
);

/** Sends a fix to the vehicle's owner client (the only one that can change its health). */
function fixOn(vehicle: number, engine: number | null): void {
  const owner = NetworkGetEntityOwner(vehicle);
  if (owner > 0)
    emitNet(EVENTS.fix, owner, NetworkGetNetworkIdFromEntity(vehicle), engine);
}

onClientCallback(
  EVENTS.repair,
  { args: ([netId]) => asArgs(netIdOk(netId) ? netId : null), lock: true },
  (source, netId) => {
    const shop = shopAt(source, "repair");
    if (!shop) return fail("MECH_ERR_FAR");
    if (!canUse(source, shop)) return fail("MECH_ERR_JOB");
    const vehicle = drivenVehicle(source, netId);
    if (vehicle === null) return fail("MECH_ERR_DRIVER");
    const damage =
      Math.max(0, 1000 - GetVehicleEngineHealth(vehicle)) +
      Math.max(0, 1000 - GetVehicleBodyHealth(vehicle));
    if (damage < 1) return fail("MECH_ERR_NOT_DAMAGED");
    const price = Math.round(
      damage * content.settings.repairPoint * shop.multiplier,
    );
    if (!pay(source, shop, price, `repair:${shop.id}`))
      return fail("MECH_ERR_MONEY");
    fixOn(vehicle, null);
    const bag = propsState.get(vehicle);
    if (bag)
      propsState.set(vehicle, { ...bag, engineHealth: 1000, bodyHealth: 1000 });
    const id = ownedId(vehicle);
    if (id !== null)
      optionalExport("ai-vehicles")?.SaveVehicle(id, {
        engine: 1000,
        body: 1000,
      });
    notify(source, Locale("MECH_REPAIRED", price), "success");
    aiLog("repairs", "shop repair", {
      source,
      metadata: { shop: shop.id, price },
    });
    return { ok: true };
  },
);

/** Washes in progress: one per player; the dirt goes when the wash time is over. */
const washing = new Set<number>();

onClientCallback(
  EVENTS.wash,
  { args: ([netId]) => asArgs(netIdOk(netId) ? netId : null), lock: true },
  (source, netId) => {
    if (washing.has(source)) return fail("MECH_ERR_BUSY");
    const p = pos(source);
    if (!content.washes.some((w) => distance(p, w.coords) <= 10))
      return fail("MECH_ERR_FAR");
    const vehicle = drivenVehicle(source, netId);
    if (vehicle === null) return fail("MECH_ERR_DRIVER");
    if (GetVehicleDirtLevel(vehicle) < 0.1) return fail("MECH_ERR_CLEAN");
    if (!pay(source, null, content.settings.washPrice, "carwash"))
      return fail("MECH_ERR_MONEY");
    washing.add(source);
    setTimeout(() => {
      washing.delete(source);
      if (!DoesEntityExist(vehicle)) return;
      SetVehicleDirtLevel(vehicle, 0);
      const owner = NetworkGetEntityOwner(vehicle);
      if (owner > 0)
        emitNet(EVENTS.fix, owner, NetworkGetNetworkIdFromEntity(vehicle), -1);
    }, content.settings.washSeconds * 1000);
    return { ok: true, seconds: content.settings.washSeconds };
  },
);

on("playerDropped", () => washing.delete(Number(globalThis.source)));

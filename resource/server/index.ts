import {
  aiLog,
  aiLogChannels,
  coordsOf,
  Cooldowns,
  EntityState,
  notify,
  onClientCallback,
  optionalExport,
  vehicleNearPlayer,
} from "@aicore-fivem/lib/server";
import {
  distance,
  fail,
  oneArg,
  readId,
  toVehicleProps,
  type VehicleProps,
} from "@aicore-fivem/lib/shared";
import { VEHICLE_BAGS } from "@aicore-fivem/shared";
import { Locale } from "common";
import {
  applyChange,
  EVENTS,
  priceOf,
  toChange,
  type Change,
} from "common/mechanic";
import { canUse, content, ownedId, pay, payerOf, shopAt } from "./content";
import "./service";

const propsState = new EntityState(
  VEHICLE_BAGS.props,
  (v) => toVehicleProps(v) ?? undefined,
);

aiLogChannels({ tuning: { active: false }, repairs: { active: false } });

/** The vehicle the player drives behind a client's net id, or 0. */
const driven = (source: number, netId: number) =>
  vehicleNearPlayer(source, netId, { driver: true });

/**
 * One tuning purchase. The base is the vehicle's props bag (owned vehicles) or what the client read; plate, health
 * and dirt always come from the server so a purchase cannot change them.
 */
onClientCallback(
  EVENTS.buy,
  {
    args: ([netId, raw, base]):
      [number, Change, VehicleProps | null] | null => {
      const id = readId(netId);
      const change = toChange(raw);
      const props = base == null ? null : toVehicleProps(base);
      return id !== null && change && (base == null || props)
        ? [id, change, props]
        : null;
    },
    lock: true,
  },
  (source, netId, change, base) => {
    const shop = shopAt(source, "tuning");
    if (!shop) return fail("MECH_ERR_FAR");
    if (!canUse(source, shop)) return fail("MECH_ERR_JOB");
    const vehicle = driven(source, netId);
    if (!vehicle) return fail("MECH_ERR_DRIVER");
    const current = propsState.get(vehicle) ?? base;
    if (!current || current.model !== GetEntityModel(vehicle))
      return fail("MECH_ERR_DRIVER");
    const price = Math.round(
      priceOf(change, content.settings) * shop.multiplier,
    );
    const payer = payerOf(source, shop, vehicle);
    if (!pay(source, shop, payer, price, `tuning:${shop.id}`))
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
      metadata: { shop: shop.id, price, payer, vehicle: id, change },
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
  { args: oneArg(readId), lock: true },
  (source, netId) => {
    const shop = shopAt(source, "repair");
    if (!shop) return fail("MECH_ERR_FAR");
    if (!canUse(source, shop)) return fail("MECH_ERR_JOB");
    const vehicle = driven(source, netId);
    if (!vehicle) return fail("MECH_ERR_DRIVER");
    const damage =
      Math.max(0, 1000 - GetVehicleEngineHealth(vehicle)) +
      Math.max(0, 1000 - GetVehicleBodyHealth(vehicle));
    if (damage < 1) return fail("MECH_ERR_NOT_DAMAGED");
    const price = Math.round(
      damage * content.settings.repairPoint * shop.multiplier,
    );
    const payer = payerOf(source, shop, vehicle);
    if (!pay(source, shop, payer, price, `repair:${shop.id}`))
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
      metadata: { shop: shop.id, price, payer, vehicle: id },
    });
    return { ok: true };
  },
);

/** Washes in progress: one per player for the wash time; the dirt goes when it is over. */
const washing = new Cooldowns();

onClientCallback(
  EVENTS.wash,
  { args: oneArg(readId), lock: true },
  (source, netId) => {
    if (!washing.ready(source)) return fail("MECH_ERR_BUSY");
    const p = coordsOf(source);
    if (![...content.washes.values()].some((w) => distance(p, w.coords) <= 10))
      return fail("MECH_ERR_FAR");
    const vehicle = driven(source, netId);
    if (!vehicle) return fail("MECH_ERR_DRIVER");
    if (GetVehicleDirtLevel(vehicle) < 0.1) return fail("MECH_ERR_CLEAN");
    const { washPrice, washSeconds } = content.settings;
    if (!pay(source, null, "player", washPrice, "carwash"))
      return fail("MECH_ERR_MONEY");
    washing.start(source, washSeconds * 1000);
    setTimeout(() => {
      if (!DoesEntityExist(vehicle)) return;
      SetVehicleDirtLevel(vehicle, 0);
      const owner = NetworkGetEntityOwner(vehicle);
      if (owner > 0)
        emitNet(EVENTS.fix, owner, NetworkGetNetworkIdFromEntity(vehicle), -1);
    }, washSeconds * 1000);
    return { ok: true, seconds: washSeconds };
  },
);

import { entityFromNetId, onServerEvent } from "@aicore-fivem/lib/client";
import { readFinite, readId } from "@aicore-fivem/lib/shared";
import { EVENTS } from "common/mechanic";

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
    const vehicle = entityFromNetId(netId, 2);
    if (!vehicle) return;
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

import { cache, menu, notify } from "@aicore-fivem/lib/client";
import type { MenuItem } from "@aicore-fivem/shared";
import { Locale } from "common";
import type { Settings } from "common/settings";
import type { Shop } from "common/shop";
import { COSMETIC_MODS, PERFORMANCE_MODS, WHEEL_MOD } from "common/tuning";
import { text } from "./labels";
import {
  modOptions,
  paintOptions,
  plateOptions,
  tintOptions,
  wheelOptions,
} from "./options";
import { CustomsVisit } from "./visit";

const WHEEL_TYPES = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12];

/**
 * The customs menus of one visit: every list previews the hovered option on the vehicle, a pick buys it (the server
 * writes the props bag, ai-vehicles applies it), closing a list puts the vehicle back as it is.
 */
export class Customs {
  private readonly visit: CustomsVisit;

  constructor(vehicle: number, shop: Shop, settings: Settings) {
    this.visit = new CustomsVisit(vehicle, shop, settings);
  }

  async run(): Promise<void> {
    const { vehicle, shop } = this.visit;
    for (;;) {
      const items: MenuItem[] = [];
      if (shop.repair)
        items.push({
          id: "repair",
          label: Locale("MECH_MENU_REPAIR"),
          icon: "wrench",
          description: Locale("MECH_PRICE", this.visit.repairPrice()),
        });
      if (shop.tuning)
        items.push(
          {
            id: "performance",
            label: Locale("MECH_MENU_PERFORMANCE"),
            icon: "gauge",
          },
          { id: "body", label: Locale("MECH_MENU_BODY"), icon: "car" },
          {
            id: "wheels",
            label: Locale("MECH_MENU_WHEELS"),
            icon: "circle-dot",
          },
          { id: "paint", label: Locale("MECH_MENU_PAINT"), icon: "spray-can" },
          { id: "extras", label: Locale("MECH_MENU_EXTRAS"), icon: "sliders" },
        );
      const pick = await menu({ title: shop.label, items });
      if (
        pick === null ||
        !DoesEntityExist(vehicle) ||
        cache.vehicle !== vehicle
      )
        return this.visit.restore();
      if (pick === "repair") return this.visit.repair();
      if (pick === "performance")
        await this.slots(Locale("MECH_MENU_PERFORMANCE"), [
          ...PERFORMANCE_MODS,
          18,
        ]);
      else if (pick === "body")
        await this.slots(Locale("MECH_MENU_BODY"), [...COSMETIC_MODS]);
      else if (pick === "wheels") await this.wheels();
      else if (pick === "paint") await this.paint();
      else if (pick === "extras") await this.extras();
    }
  }

  private async slots(title: string, types: number[]): Promise<void> {
    const visit = this.visit;
    for (;;) {
      const available = types.filter(
        (t) => t === 18 || GetNumVehicleMods(visit.vehicle, t) > 0,
      );
      if (available.length === 0) return notify(Locale("MECH_NOTHING"), "info");
      const items = available.map((t) => ({
        id: String(t),
        label: text(`MECH_MOD_${t}`, `#${t}`),
      }));
      const pick = await menu({ title, items });
      if (pick === null) return;
      const type = Number(pick);
      await visit.choose(text(`MECH_MOD_${type}`, pick), () =>
        modOptions(visit.vehicle, visit.props, type),
      );
    }
  }

  private async wheels(): Promise<void> {
    const visit = this.visit;
    const types = IsThisModelABike(GetEntityModel(visit.vehicle))
      ? [6]
      : WHEEL_TYPES;
    for (;;) {
      const pick = await menu({
        title: Locale("MECH_MENU_WHEELS"),
        items: types.map((t) => ({
          id: String(t),
          label: text(`MECH_WHEELS_${t}`, `#${t}`),
        })),
      });
      if (pick === null) return;
      const wheelType = Number(pick);
      SetVehicleWheelType(visit.vehicle, wheelType);
      const count = GetNumVehicleMods(visit.vehicle, WHEEL_MOD);
      await visit.choose(text(`MECH_WHEELS_${wheelType}`, pick), () =>
        wheelOptions(visit.vehicle, visit.props, wheelType, count),
      );
    }
  }

  private async paint(): Promise<void> {
    const visit = this.visit;
    for (;;) {
      const pick = await menu({
        title: Locale("MECH_MENU_PAINT"),
        items: [
          { id: "0", label: Locale("MECH_PRIMARY") },
          { id: "1", label: Locale("MECH_SECONDARY") },
        ],
      });
      if (pick === null) return;
      const slot = pick === "1" ? 1 : 0;
      await visit.choose(Locale(slot ? "MECH_SECONDARY" : "MECH_PRIMARY"), () =>
        paintOptions(visit.props, slot),
      );
    }
  }

  private async extras(): Promise<void> {
    const visit = this.visit;
    for (;;) {
      const items = [
        { id: "tint", label: Locale("MECH_TINT") },
        { id: "plate", label: Locale("MECH_PLATE") },
        { id: "xenon", label: Locale("MECH_XENON") },
      ];
      const pick = await menu({ title: Locale("MECH_MENU_EXTRAS"), items });
      if (pick === null) return;
      if (pick === "xenon")
        await visit.choose(Locale("MECH_XENON"), () =>
          modOptions(visit.vehicle, visit.props, 22),
        );
      else if (pick === "tint")
        await visit.choose(Locale("MECH_TINT"), () => tintOptions(visit.props));
      else
        await visit.choose(Locale("MECH_PLATE"), () =>
          plateOptions(visit.props),
        );
    }
  }
}

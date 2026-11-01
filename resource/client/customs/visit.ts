import {
  callAction,
  getVehicleProps,
  menu,
  setVehicleProps,
} from "@aicore-fivem/lib/client";
import type { VehicleProps } from "@aicore-fivem/lib/shared";
import type { MenuItem } from "@aicore-fivem/shared";
import { Locale } from "common";
import { EVENTS } from "common/mechanic";
import type { Settings } from "common/settings";
import type { Shop } from "common/shop";
import { applyChange, priceOf, type Change } from "common/tuning";
import { FALLBACK } from "../fallback";
import type { Option } from "./options";

const PAGE = 36;

/** One customs visit: the vehicle, its last bought props, prices, and the option list with live preview and purchase. */
export class CustomsVisit {
  props: VehicleProps;

  constructor(
    readonly vehicle: number,
    readonly shop: Shop,
    private readonly settings: Settings,
  ) {
    SetVehicleModKit(vehicle, 0);
    this.props = getVehicleProps(vehicle);
  }

  repairPrice(): number {
    const damage =
      Math.max(0, 1000 - GetVehicleEngineHealth(this.vehicle)) +
      Math.max(0, 1000 - GetVehicleBodyHealth(this.vehicle));
    return Math.round(
      damage * this.settings.repairPoint * this.shop.multiplier,
    );
  }

  restore(): void {
    if (DoesEntityExist(this.vehicle))
      setVehicleProps(this.vehicle, {
        ...this.props,
        engineHealth: GetVehicleEngineHealth(this.vehicle),
        bodyHealth: GetVehicleBodyHealth(this.vehicle),
      });
  }

  async repair(): Promise<void> {
    await callAction(EVENTS.repair, [VehToNet(this.vehicle)], FALLBACK);
  }

  private price(change: Change): number {
    return Math.round(priceOf(change, this.settings) * this.shop.multiplier);
  }

  /** A list of options with live preview; a pick buys and the list stays open. */
  async choose(title: string, build: () => Option[]): Promise<void> {
    let page = 0;
    for (;;) {
      const options = build();
      const pages = Math.max(1, Math.ceil(options.length / PAGE));
      page = Math.min(page, pages - 1);
      const shown = options.slice(page * PAGE, page * PAGE + PAGE);
      const items: MenuItem[] = shown.map((o) => ({
        id: o.id,
        label: o.label,
        description: o.installed
          ? Locale("MECH_INSTALLED")
          : Locale("MECH_PRICE", this.price(o.change)),
        disabled: o.installed,
      }));
      if (page > 0)
        items.push({
          id: "prev",
          label: Locale("MECH_PREV_PAGE"),
          icon: "list",
        });
      if (page < pages - 1)
        items.push({
          id: "next",
          label: Locale("MECH_NEXT_PAGE"),
          icon: "list",
        });
      const pick = await menu(
        { title: pages > 1 ? `${title} ${page + 1}/${pages}` : title, items },
        (id) => {
          const option = shown.find((o) => o.id === id);
          if (option)
            setVehicleProps(
              this.vehicle,
              applyChange(this.props, option.change),
            );
        },
      );
      if (pick === "prev" || pick === "next") {
        page += pick === "next" ? 1 : -1;
        continue;
      }
      const option = shown.find((o) => o.id === pick);
      if (!option || !DoesEntityExist(this.vehicle)) return this.restore();
      const bought = await callAction(
        EVENTS.buy,
        [VehToNet(this.vehicle), option.change, this.props],
        FALLBACK,
      );
      if (bought) this.props = applyChange(this.props, option.change);
      else this.restore();
    }
  }
}

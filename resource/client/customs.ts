import {
  cache,
  getVehicleProps,
  loadLocaleTexts,
  menu,
  notify,
  setVehicleProps,
  triggerServerCallback,
} from "@aicore-fivem/lib/client"
import { record, type VehicleProps } from "@aicore-fivem/lib/shared"
import type { MenuItem } from "@aicore-fivem/shared"
import { Locale } from "common"
import {
  applyChange,
  COSMETIC_MODS,
  EVENTS,
  PAINTS,
  PERFORMANCE_MODS,
  priceOf,
  WHEEL_MOD,
  type Change,
  type Settings,
  type Shop,
} from "common/mechanic"

const texts = loadLocaleTexts()
const text = (key: string, fallback: string) => texts[key] ?? fallback
export const errorText = (v: unknown, fallback: string): string => {
  const key =
    typeof record(v).error === "string" ? String(record(v).error) : fallback
  return texts[key] ?? key
}
const PAGE = 36
const WHEEL_TYPES = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]

interface Option {
  id: string
  label: string
  change: Change
  /** The option matches what the vehicle has now. */
  installed: boolean
}

/**
 * The customs menus of one visit: every list previews the hovered option on the vehicle, a pick buys it (the server
 * writes the props bag, ai-vehicles applies it), closing a list puts the vehicle back as it is.
 */
export class Customs {
  private props: VehicleProps

  constructor(
    private readonly vehicle: number,
    private readonly shop: Shop,
    private readonly settings: Settings
  ) {
    SetVehicleModKit(vehicle, 0)
    this.props = getVehicleProps(vehicle)
  }

  async run(): Promise<void> {
    for (;;) {
      const items: MenuItem[] = []
      if (this.shop.repair)
        items.push({
          id: "repair",
          label: Locale("MECH_MENU_REPAIR"),
          icon: "wrench",
          description: `$${this.repairPrice()}`,
        })
      if (this.shop.tuning)
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
          { id: "extras", label: Locale("MECH_MENU_EXTRAS"), icon: "sliders" }
        )
      const pick = await menu({ title: this.shop.label, items })
      if (
        pick === null ||
        !DoesEntityExist(this.vehicle) ||
        cache.vehicle !== this.vehicle
      )
        return this.restore()
      if (pick === "repair") return this.repair()
      if (pick === "performance")
        await this.slots(Locale("MECH_MENU_PERFORMANCE"), [
          ...PERFORMANCE_MODS,
          18,
        ])
      else if (pick === "body")
        await this.slots(Locale("MECH_MENU_BODY"), [...COSMETIC_MODS])
      else if (pick === "wheels") await this.wheels()
      else if (pick === "paint") await this.paint()
      else if (pick === "extras") await this.extras()
    }
  }

  private repairPrice(): number {
    const damage =
      Math.max(0, 1000 - GetVehicleEngineHealth(this.vehicle)) +
      Math.max(0, 1000 - GetVehicleBodyHealth(this.vehicle))
    return Math.round(damage * this.settings.repairPoint * this.shop.multiplier)
  }

  private restore(): void {
    if (DoesEntityExist(this.vehicle))
      setVehicleProps(this.vehicle, {
        ...this.props,
        engineHealth: GetVehicleEngineHealth(this.vehicle),
        bodyHealth: GetVehicleBodyHealth(this.vehicle),
      })
  }

  private async repair(): Promise<void> {
    const result = record(
      await triggerServerCallback(EVENTS.repair, [
        VehToNet(this.vehicle),
      ]).catch(() => null)
    )
    if (result.ok !== true) notify(errorText(result, "MECH_ERR_FAR"), "error")
  }

  private price(change: Change): number {
    return Math.round(priceOf(change, this.settings) * this.shop.multiplier)
  }

  /** A list of options with live preview; a pick buys and the list stays open. */
  private async choose(title: string, build: () => Option[]): Promise<void> {
    let page = 0
    for (;;) {
      const options = build()
      const pages = Math.max(1, Math.ceil(options.length / PAGE))
      page = Math.min(page, pages - 1)
      const shown = options.slice(page * PAGE, page * PAGE + PAGE)
      const items: MenuItem[] = shown.map((o) => ({
        id: o.id,
        label: o.label,
        description: o.installed
          ? Locale("MECH_INSTALLED")
          : `$${this.price(o.change)}`,
        disabled: o.installed,
      }))
      if (page > 0)
        items.push({
          id: "prev",
          label: Locale("MECH_PREV_PAGE"),
          icon: "list",
        })
      if (page < pages - 1)
        items.push({
          id: "next",
          label: Locale("MECH_NEXT_PAGE"),
          icon: "list",
        })
      const pick = await menu(
        { title: pages > 1 ? `${title} ${page + 1}/${pages}` : title, items },
        (id) => {
          const option = shown.find((o) => o.id === id)
          if (option)
            setVehicleProps(
              this.vehicle,
              applyChange(this.props, option.change)
            )
        }
      )
      if (pick === "prev" || pick === "next") {
        page += pick === "next" ? 1 : -1
        continue
      }
      const option = shown.find((o) => o.id === pick)
      if (!option || !DoesEntityExist(this.vehicle)) return this.restore()
      const result = record(
        await triggerServerCallback(EVENTS.buy, [
          VehToNet(this.vehicle),
          option.change,
          this.props,
        ]).catch(() => null)
      )
      if (result.ok === true)
        this.props = applyChange(this.props, option.change)
      else {
        notify(errorText(result, "MECH_ERR_FAR"), "error")
        this.restore()
      }
    }
  }

  private levels(type: number): Option[] {
    const current = this.props.mods[type] ?? -1
    if (type === 18 || type === 22)
      return [0, 1].map((on) => ({
        id: String(on),
        label: Locale(on ? "MECH_ON" : "MECH_OFF"),
        change: { kind: "mod", type, index: on ? 0 : -1 },
        installed: (current === 1) === (on === 1),
      }))
    const count = GetNumVehicleMods(this.vehicle, type)
    return Array.from({ length: count + 1 }, (_, i) => {
      const index = i - 1
      const label =
        index < 0
          ? Locale("MECH_STOCK")
          : GetLabelText(GetModTextLabel(this.vehicle, type, index))
      return {
        id: String(index),
        label:
          index < 0 || label === "NULL"
            ? index < 0
              ? label
              : Locale("MECH_LEVEL", index + 1)
            : label,
        change: { kind: "mod", type, index },
        installed: current === index,
      }
    })
  }

  private async slots(title: string, types: number[]): Promise<void> {
    for (;;) {
      const available = types.filter(
        (t) => t === 18 || GetNumVehicleMods(this.vehicle, t) > 0
      )
      if (available.length === 0) return notify(Locale("MECH_NOTHING"), "info")
      const items = available.map((t) => ({
        id: String(t),
        label: text(`MECH_MOD_${t}`, `#${t}`),
      }))
      const pick = await menu({ title, items })
      if (pick === null) return
      const type = Number(pick)
      await this.choose(text(`MECH_MOD_${type}`, pick), () => this.levels(type))
    }
  }

  private async wheels(): Promise<void> {
    const types = IsThisModelABike(GetEntityModel(this.vehicle))
      ? [6]
      : WHEEL_TYPES
    for (;;) {
      const pick = await menu({
        title: Locale("MECH_MENU_WHEELS"),
        items: types.map((t) => ({
          id: String(t),
          label: text(`MECH_WHEELS_${t}`, `#${t}`),
        })),
      })
      if (pick === null) return
      const wheelType = Number(pick)
      SetVehicleWheelType(this.vehicle, wheelType)
      const count = GetNumVehicleMods(this.vehicle, WHEEL_MOD)
      await this.choose(text(`MECH_WHEELS_${wheelType}`, pick), () =>
        Array.from({ length: count + 1 }, (_, i) => {
          const index = i - 1
          const label =
            index < 0
              ? Locale("MECH_STOCK")
              : GetLabelText(GetModTextLabel(this.vehicle, WHEEL_MOD, index))
          const installed =
            this.props.wheelType === wheelType &&
            (this.props.mods[WHEEL_MOD] ?? -1) === index
          return {
            id: String(index),
            label: label === "NULL" ? Locale("MECH_LEVEL", index + 1) : label,
            change: { kind: "wheels", wheelType, index },
            installed,
          }
        })
      )
    }
  }

  private async paint(): Promise<void> {
    for (;;) {
      const pick = await menu({
        title: Locale("MECH_MENU_PAINT"),
        items: [
          { id: "0", label: Locale("MECH_PRIMARY") },
          { id: "1", label: Locale("MECH_SECONDARY") },
        ],
      })
      if (pick === null) return
      const slot = pick === "1" ? 1 : 0
      await this.choose(Locale(slot ? "MECH_SECONDARY" : "MECH_PRIMARY"), () =>
        PAINTS.map((color) => ({
          id: String(color),
          label: text(`MECH_PAINT_${color}`, `#${color}`),
          change: { kind: "paint", slot, color },
          installed: this.props.colors[slot] === color,
        }))
      )
    }
  }

  private async extras(): Promise<void> {
    for (;;) {
      const items = [
        { id: "tint", label: Locale("MECH_TINT") },
        { id: "plate", label: Locale("MECH_PLATE") },
        { id: "xenon", label: Locale("MECH_XENON") },
      ]
      const pick = await menu({ title: Locale("MECH_MENU_EXTRAS"), items })
      if (pick === null) return
      if (pick === "xenon")
        await this.choose(Locale("MECH_XENON"), () => this.levels(22))
      else if (pick === "tint")
        await this.choose(Locale("MECH_TINT"), () =>
          [0, 1, 2, 3, 4, 5, 6].map((value) => ({
            id: String(value),
            label: text(`MECH_TINT_${value}`, `#${value}`),
            change: { kind: "tint", value },
            installed: this.props.windowTint === value,
          }))
        )
      else
        await this.choose(Locale("MECH_PLATE"), () =>
          [0, 1, 2, 3, 4, 5].map((value) => ({
            id: String(value),
            label: text(`MECH_PLATE_${value}`, `#${value}`),
            change: { kind: "plate", value },
            installed: this.props.plateIndex === value,
          }))
        )
    }
  }
}

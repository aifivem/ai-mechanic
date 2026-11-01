import { int, num, readBlipStyle, record, str } from "@aicore-fivem/lib/shared";

/** ai-mechanic's settings file (both sides). */
export interface Settings {
  accounts: string[];
  /** Dollars per health point repaired (engine + body, 2000 points). */
  repairPoint: number;
  performance: number;
  turbo: number;
  xenon: number;
  cosmetic: number;
  wheels: number;
  paint: number;
  tint: number;
  plate: number;
  washPrice: number;
  washSeconds: number;
  kitEngine: number;
  kitSeconds: number;
  /** The usable repair kit item. */
  kitItem: string;
  /** Job shops' stash size. */
  stashSlots: number;
  stashWeight: number;
  /** Map blips: public shops, job shops, car washes. */
  shopBlip: BlipStyle;
  jobShopBlip: BlipStyle;
  washBlip: BlipStyle;
  /** What one customer bill may ask for. */
  billMin: number;
  billMax: number;
}

export interface BlipStyle {
  sprite: number;
  color: number;
  scale: number;
}

export function readSettings(raw: unknown): Settings {
  const v = record(raw);
  const accounts = Array.isArray(v.accounts)
    ? v.accounts.filter((a): a is string => typeof a === "string")
    : [];
  return {
    accounts: accounts.length > 0 ? accounts : ["cash", "bank"],
    repairPoint: num(v.repairPoint, 2),
    performance: int(v.performance, 2500, 0),
    turbo: int(v.turbo, 15000, 0),
    xenon: int(v.xenon, 2000, 0),
    cosmetic: int(v.cosmetic, 750, 0),
    wheels: int(v.wheels, 1500, 0),
    paint: int(v.paint, 1000, 0),
    tint: int(v.tint, 500, 0),
    plate: int(v.plate, 300, 0),
    washPrice: int(v.washPrice, 20, 0),
    washSeconds: int(v.washSeconds, 6, 1, 60),
    kitEngine: int(v.kitEngine, 750, 100, 1000),
    kitSeconds: int(v.kitSeconds, 10, 1, 60),
    kitItem: str(v.kitItem, "repairkit", 48),
    stashSlots: int(v.stashSlots, 50, 1, 200),
    stashWeight: int(v.stashWeight, 250_000, 1000, 10_000_000),
    shopBlip: readBlipStyle(v.shopBlip, { sprite: 72, color: 46, scale: 0.6 }),
    jobShopBlip: readBlipStyle(v.jobShopBlip, {
      sprite: 72,
      color: 46,
      scale: 0.6,
    }),
    washBlip: readBlipStyle(v.washBlip, {
      sprite: 100,
      color: 37,
      scale: 0.75,
    }),
    billMin: int(v.billMin, 1, 1, 10_000_000),
    billMax: int(v.billMax, 50_000, 1, 10_000_000),
  };
}

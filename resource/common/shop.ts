import {
  type AccessRule,
  bool,
  num,
  type PlacePed,
  readAccess,
  readPlacePed,
  record,
  str,
} from "@aicore-fivem/lib/shared";

/** ai-mechanic's shop and car wash records (both sides). */

type Point = { x: number; y: number; z: number };
const point = (v: unknown): Point => {
  const p = record(v);
  return { x: num(p.x, 0), y: num(p.y, 0), z: num(p.z, 0) };
};

export interface Shop {
  /** NPC standing at the place (panel), null for none. */
  ped: PlacePed | null;
  id: string;
  label: string;
  /** Empty: anyone, paid by the driver; otherwise on-duty members of this job, paid from the job's account. */
  job: string;
  /** Who may use it: everyone, or `job`'s on-duty members (lib `allows` / `online.allows`). */
  access: AccessRule;
  coords: Point;
  radius: number;
  blip: boolean;
  repair: boolean;
  tuning: boolean;
  multiplier: number;
  /** Job shops' stash; (0, 0, 0) = none. */
  stash: Point | null;
}

/** One shop record (`panel.records` / `world.records`). */
export function readShop(id: string, v: Record<string, unknown>): Shop {
  const stash = point(v.stash);
  const job = str(v.job, "", 32);
  return {
    ped: readPlacePed(v.ped),
    id,
    label: str(v.label, id, 48),
    job,
    access: readAccess({ jobs: job ? [job] : [], onDuty: true }),
    coords: point(v.coords),
    radius: num(v.radius, 8),
    blip: bool(v.blip, true),
    repair: bool(v.repair, true),
    tuning: bool(v.tuning, true),
    multiplier: num(v.multiplier, 1),
    stash: stash.x === 0 && stash.y === 0 ? null : stash,
  };
}

/** The jobs that run a job shop: their on-duty members are mechanics (customer bills). */
export function mechanicJobs(shops: Iterable<Shop>): string[] {
  const jobs = new Set<string>();
  for (const shop of shops) if (shop.job) jobs.add(shop.job);
  return [...jobs];
}

export interface Wash {
  id: string;
  label: string;
  coords: Point;
}

/** One car wash record (`panel.records` / `world.records`). */
export function readWash(id: string, v: Record<string, unknown>): Wash {
  return { id, label: str(v.label, id, 48), coords: point(v.coords) };
}

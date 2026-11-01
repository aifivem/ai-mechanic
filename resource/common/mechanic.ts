/** ai-mechanic's contracts (events, callbacks, bill limits). No natives. */
export const EVENTS = {
  /** Callback: (netId, change: Change, base: VehicleProps) -> { ok } buys one change at the shop the player is in. */
  buy: "ai-mechanic:buy",
  /** Callback: (netId) -> { ok } repairs the vehicle at a shop. */
  repair: "ai-mechanic:repair",
  /** Callback: (shopId) -> { ok } opens a job shop's stash. */
  stash: "ai-mechanic:stash",
  /** Callback: (netId) -> { ok } washes the vehicle at a car wash. */
  wash: "ai-mechanic:wash",
  /** Callback: (target, amount, reason) -> { ok } an on-duty mechanic bills the player next to them from the job. */
  bill: "ai-mechanic:bill",
  /** Server -> entity owner: (netId, engine | null) fix the body (engine null) or set the engine health; (netId, -1) wash. */
  fix: "ai-mechanic:client:fix",
} as const;

/** How close the customer stands to the mechanic for a bill (the server allows 2 m more for movement). */
export const BILL_METRES = 3;
/** Longest bill reason. */
export const BILL_REASON_MAX = 48;

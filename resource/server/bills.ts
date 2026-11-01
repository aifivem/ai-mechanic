import {
  aiLog,
  aiLogChannels,
  billing,
  coordsOf,
  hasCharacter,
  isNear,
  onClientCallback,
  online,
} from "@aicore-fivem/lib/server";
import { fail, readId, readInt, readText } from "@aicore-fivem/lib/shared";
import { BILL_METRES, BILL_REASON_MAX, EVENTS } from "common/mechanic";
import { mechanicJobs } from "common/shop";
import { content } from "./content";

aiLogChannels({ bills: {} });

/** The mechanic job the player is on duty for (a job that runs a job shop), or null. */
function mechanicJobOf(source: number): string | null {
  const duty = online.dutyJob(source);
  return duty !== null && mechanicJobs(content.shops.values()).includes(duty)
    ? duty
    : null;
}

/**
 * Bill a customer: an on-duty mechanic bills the player next to them; the job's account gets the money when the
 * customer pays (ai-core's billing layer: the active billing script or ai-core's own bills).
 */
onClientCallback(
  EVENTS.bill,
  {
    args: ([to, amount, reason]): [number, number, string] | null => {
      const target = readId(to);
      const value = readInt(amount, 1, 10_000_000);
      const text = readText(reason, BILL_REASON_MAX);
      return target !== null && value !== null && text
        ? [target, value, text]
        : null;
    },
    guards: [hasCharacter()],
    rate: { count: 3, windowMs: 10_000 },
    lock: true,
  },
  (source, target, amount, reason) => {
    const job = mechanicJobOf(source);
    if (!job) return fail("MECH_ERR_BILL_JOB");
    if (target === source || !online.character(target))
      return fail("MECH_ERR_BILL_TARGET");
    if (!isNear(source, coordsOf(target), BILL_METRES + 2))
      return fail("MECH_ERR_BILL_FAR");
    const { billMin, billMax } = content.settings;
    if (amount < billMin || amount > billMax)
      return fail("MECH_ERR_BILL_AMOUNT");
    if (!billing.send({ to: target, amount, label: reason, from: source, job }))
      return fail("MECH_ERR_BILL");
    aiLog("bills", "billed a customer", {
      source,
      target,
      metadata: { job, amount, reason },
    });
    return { ok: true };
  },
);

import {
  callAction,
  input,
  nearestPlayer,
  notify,
  onDutyIn,
  radial,
} from "@aicore-fivem/lib/client";
import { Locale } from "common";
import { BILL_METRES, BILL_REASON_MAX, EVENTS } from "common/mechanic";
import { mechanicJobs } from "common/shop";
import { settings } from "./content";
import { shops } from "./points";

/** On-duty mechanics (members of a job that runs a job shop) bill the player next to them; the server checks it all. */
radial.add({
  id: "mechanic_bill",
  label: Locale("MECH_RADIAL_BILL"),
  icon: "file-invoice-dollar",
  canShow: () => onDutyIn(mechanicJobs(shops.records.values())),
  onPressed: () => void billCustomer(),
});

async function billCustomer(): Promise<void> {
  const target = nearestPlayer(BILL_METRES);
  if (target === null) return notify(Locale("MECH_BILL_NO_PLAYER"), "warning");
  const { billMin, billMax } = settings.value;
  const values = await input({
    title: Locale("MECH_BILL_TITLE"),
    fields: [
      {
        name: "amount",
        label: Locale("MECH_BILL_AMOUNT", billMin, billMax),
        type: "number",
        min: billMin,
        max: billMax,
        placeholder: String(billMin),
      },
      {
        name: "reason",
        label: Locale("MECH_BILL_REASON"),
        type: "text",
        maxLength: BILL_REASON_MAX,
        placeholder: Locale("MECH_BILL_REASON_PLACEHOLDER"),
      },
    ],
    confirm: Locale("MECH_BILL_CONFIRM"),
  });
  if (!values) return;
  const amount = Number(values.amount);
  const reply = await callAction(
    EVENTS.bill,
    [target, amount, String(values.reason ?? "")],
    { fallback: "MECH_ERR_BILL" },
  );
  if (reply) notify(Locale("MECH_BILL_SENT", amount), "success");
}

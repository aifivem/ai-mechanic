import { spec } from "@aicore-fivem/lib/shared";
import type { FileSpec, TabSpec } from "@aicore-fivem/shared";
import { blip } from "./blip";
import { pricesCard } from "./prices";

export const settingsFile: FileSpec = {
  kind: "settings",
  sync: "all",
  sections: {
    accounts: {
      type: "names",
      lookup: "account",
      max: 5,
      itemMax: 32,
      pattern: "^[a-z0-9_]{2,32}$",
    },
    repairPoint: { type: "number", min: 0, max: 100 },
    performance: spec.int(0, 1_000_000),
    turbo: spec.int(0, 1_000_000),
    xenon: spec.int(0, 1_000_000),
    cosmetic: spec.int(0, 1_000_000),
    wheels: spec.int(0, 1_000_000),
    paint: spec.int(0, 1_000_000),
    tint: spec.int(0, 1_000_000),
    plate: spec.int(0, 1_000_000),
    washPrice: spec.int(0, 100_000),
    washSeconds: spec.int(1, 60),
    kitEngine: spec.int(100, 1000),
    kitSeconds: spec.int(1, 60),
    kitItem: {
      type: "text",
      lookup: "item",
      min: 2,
      max: 48,
      optional: true,
    },
    stashSlots: { ...spec.int(1, 200), optional: true },
    stashWeight: { ...spec.int(1000, 10_000_000), optional: true },
    shopBlip: blip,
    jobShopBlip: blip,
    washBlip: blip,
    billMin: { ...spec.int(1, 10_000_000), optional: true },
    billMax: { ...spec.int(1, 10_000_000), optional: true },
  },
};

export const settingsTab: TabSpec = {
  id: "settings",
  file: "settings",
  icon: "sliders",
  label: "ADMIN_TAB_SETTINGS",
  desc: "ADMIN_TAB_SETTINGS_DESC",
  cards: [
    pricesCard,
    {
      icon: "droplet",
      title: "ADMIN_C_WASHING",
      desc: "ADMIN_C_WASHING_DESC",
      fields: [
        {
          widget: "number",
          path: "washPrice",
          label: "ADMIN_F_WASH_PRICE",
          min: 0,
          max: 100_000,
          unit: "$",
        },
        {
          widget: "number",
          path: "washSeconds",
          label: "ADMIN_F_WASH_SECONDS",
          min: 1,
          max: 60,
          unit: "s",
        },
      ],
    },
    {
      icon: "toolbox",
      title: "ADMIN_C_KIT",
      desc: "ADMIN_C_KIT_DESC",
      fields: [
        {
          widget: "number",
          path: "kitEngine",
          label: "ADMIN_F_KIT_ENGINE",
          hint: "ADMIN_H_KIT_ENGINE",
          min: 100,
          max: 1000,
        },
        {
          widget: "number",
          path: "kitSeconds",
          label: "ADMIN_F_KIT_SECONDS",
          min: 1,
          max: 60,
          unit: "s",
        },
        {
          widget: "text",
          lookup: "item",
          path: "kitItem",
          label: "ADMIN_F_KIT_ITEM",
          hint: "ADMIN_H_KIT_ITEM",
          placeholder: "ADMIN_P_KIT_ITEM",
        },
      ],
    },
    {
      icon: "file-invoice-dollar",
      title: "ADMIN_C_BILLS",
      desc: "ADMIN_C_BILLS_DESC",
      fields: [
        {
          widget: "number",
          path: "billMin",
          label: "ADMIN_F_BILL_MIN",
          hint: "ADMIN_H_BILL_MIN",
          min: 1,
          max: 10_000_000,
          unit: "$",
        },
        {
          widget: "number",
          path: "billMax",
          label: "ADMIN_F_BILL_MAX",
          hint: "ADMIN_H_BILL_MAX",
          min: 1,
          max: 10_000_000,
          unit: "$",
        },
      ],
    },
    {
      icon: "box-open",
      title: "ADMIN_C_STASH",
      desc: "ADMIN_C_STASH_DESC",
      fields: [
        {
          widget: "number",
          path: "stashSlots",
          label: "ADMIN_F_STASH_SLOTS",
          min: 1,
          max: 200,
        },
        {
          widget: "number",
          path: "stashWeight",
          label: "ADMIN_F_STASH_WEIGHT",
          min: 1000,
          max: 10_000_000,
          unit: "g",
        },
      ],
    },
    {
      icon: "map",
      title: "ADMIN_C_BLIPS",
      desc: "ADMIN_C_BLIPS_DESC",
      fields: [
        { widget: "blip", path: "shopBlip", label: "ADMIN_F_SHOP_BLIP" },
        {
          widget: "blip",
          path: "jobShopBlip",
          label: "ADMIN_F_JOB_SHOP_BLIP",
        },
        { widget: "blip", path: "washBlip", label: "ADMIN_F_WASH_BLIP" },
      ],
    },
  ],
};

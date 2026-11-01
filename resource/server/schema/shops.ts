import { PLACE_PED_SPEC, placePedFields } from "@aicore-fivem/lib/shared";
import type { FileSpec, TabSpec } from "@aicore-fivem/shared";
import { blip } from "./blip";

export const shopsFile: FileSpec = {
  kind: "records",
  sync: "all",
  labelPath: "label",
  newRecord: {
    label: "",
    job: "",
    coords: { x: 0, y: 0, z: 0 },
    radius: 8,
    blip: true,
    repair: true,
    tuning: true,
    multiplier: 1,
    stash: { x: 0, y: 0, z: 0 },
  },
  sections: {
    ped: PLACE_PED_SPEC,
    label: { type: "text", min: 1, max: 48 },
    job: { type: "text", lookup: "job", min: 0, max: 32 },
    coords: { type: "vec3" },
    radius: { type: "number", min: 2, max: 40 },
    blip: { type: "bool" },
    repair: { type: "bool" },
    tuning: { type: "bool" },
    multiplier: { type: "number", min: 0, max: 10 },
    stash: { type: "vec3" },
  },
};

export const shopsTab: TabSpec = {
  id: "shops",
  file: "shops",
  icon: "wrench",
  label: "ADMIN_TAB_SHOPS",
  desc: "ADMIN_TAB_SHOPS_DESC",
  listSub: "job",
  createLabel: "ADMIN_NEW_SHOP",
  deleteLabel: "ADMIN_DELETE_SHOP",
  deleteDesc: "ADMIN_DELETE_SHOP_DESC",
  cards: [
    {
      icon: "wrench",
      title: "ADMIN_C_SHOP",
      desc: "ADMIN_C_SHOP_DESC",
      fields: [
        {
          widget: "text",
          path: "label",
          suggest: { from: "coords" },
          label: "ADMIN_F_LABEL",
          placeholder: "ADMIN_P_LABEL",
        },
        {
          widget: "point",
          path: "coords",
          label: "ADMIN_F_COORDS",
          hint: "ADMIN_H_COORDS",
          ground: true,
        },
        {
          widget: "number",
          path: "radius",
          label: "ADMIN_F_RADIUS",
          hint: "ADMIN_H_RADIUS",
          min: 2,
          max: 40,
          unit: "m",
        },
        { widget: "switch", path: "blip", label: "ADMIN_F_BLIP" },
        {
          widget: "switch",
          path: "repair",
          label: "ADMIN_F_REPAIR",
          hint: "ADMIN_H_REPAIR",
        },
        {
          widget: "switch",
          path: "tuning",
          label: "ADMIN_F_TUNING",
          hint: "ADMIN_H_TUNING",
        },
        {
          widget: "number",
          path: "multiplier",
          label: "ADMIN_F_MULTIPLIER",
          hint: "ADMIN_H_MULTIPLIER",
          min: 0,
          max: 10,
          step: 0.05,
          unit: "x",
        },
      ],
    },
    {
      icon: "briefcase",
      title: "ADMIN_C_JOB",
      desc: "ADMIN_C_JOB_DESC",
      fields: [
        {
          widget: "text",
          lookup: "job",
          path: "job",
          label: "ADMIN_F_JOB",
          hint: "ADMIN_H_JOB",
          placeholder: "ADMIN_P_JOB",
        },
        {
          widget: "point",
          path: "stash",
          label: "ADMIN_F_STASH",
          hint: "ADMIN_H_STASH",
          ground: true,
        },
      ],
    },
    {
      icon: "user",
      title: "ADMIN_C_PED",
      desc: "ADMIN_C_PED_DESC",
      fields: placePedFields(),
    },
  ],
};

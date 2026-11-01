import type { FileSpec, TabSpec } from "@aicore-fivem/shared";

export const washesFile: FileSpec = {
  kind: "records",
  sync: "all",
  labelPath: "label",
  newRecord: { label: "", coords: { x: 0, y: 0, z: 0 } },
  sections: {
    label: { type: "text", min: 1, max: 48 },
    coords: { type: "vec3" },
  },
};

export const washesTab: TabSpec = {
  id: "washes",
  file: "washes",
  icon: "droplet",
  label: "ADMIN_TAB_WASHES",
  desc: "ADMIN_TAB_WASHES_DESC",
  createLabel: "ADMIN_NEW_WASH",
  deleteLabel: "ADMIN_DELETE_WASH",
  cards: [
    {
      icon: "droplet",
      title: "ADMIN_C_WASH",
      desc: "ADMIN_C_WASH_DESC",
      fields: [
        {
          widget: "text",
          path: "label",
          suggest: { from: "coords" },
          label: "ADMIN_F_LABEL",
          placeholder: "ADMIN_P_WASH_LABEL",
        },
        {
          widget: "point",
          path: "coords",
          label: "ADMIN_F_COORDS",
          hint: "ADMIN_H_WASH_COORDS",
          ground: true,
        },
      ],
    },
  ],
};

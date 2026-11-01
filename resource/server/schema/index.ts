import type { PanelSchema } from "@aicore-fivem/shared";
import { shopsFile, shopsTab } from "./shops";
import { washesFile, washesTab } from "./washes";
import { settingsFile, settingsTab } from "./settings";

/** ai-mechanic's panel: shops (repair, tuning, job stash), car washes and every price. */
export const mechanicSchema: PanelSchema = {
  title: "ADMIN_TITLE",
  icon: "wrench",
  files: {
    settings: settingsFile,
    shops: shopsFile,
    washes: washesFile,
  },
  tabs: [shopsTab, washesTab, settingsTab],
};

import { AdminWorld } from "@aicore-fivem/lib/client";
import { readSettings } from "common/settings";

export const world = new AdminWorld(["settings", "shops", "washes"]);
export const settings = world.view("settings", readSettings);

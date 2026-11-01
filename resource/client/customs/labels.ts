import { loadLocaleTexts } from "@aicore-fivem/lib/client";

const texts = loadLocaleTexts();
/** A lang text by a built key (mod slots, wheel types, paints), or the fallback when the lang file has none. */
export const text = (key: string, fallback: string) => texts[key] ?? fallback;

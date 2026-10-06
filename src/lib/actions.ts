import { db } from "@/lib/db";
import { nowIso } from "@/lib/utils";

export async function updateSettingsTheme(theme: "dark" | "light") {
  await db.settings.update("app", { theme, updatedAt: nowIso() });
}


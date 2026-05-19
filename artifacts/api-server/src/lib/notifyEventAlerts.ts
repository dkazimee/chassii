import { db, notificationsTable, eventAlertPreferencesTable, usersTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";

export type InsertedEventSummary = {
  id: number;
  city: string;
  title: string;
};

export async function notifyEventAlerts(insertedEvents: InsertedEventSummary[]): Promise<void> {
  if (insertedEvents.length === 0) return;

  const prefs = await db
    .select({ userId: eventAlertPreferencesTable.userId, city: eventAlertPreferencesTable.city })
    .from(eventAlertPreferencesTable)
    .where(eq(eventAlertPreferencesTable.enabled, true));

  if (prefs.length === 0) return;

  for (const event of insertedEvents) {
    const eventCityLower = event.city.toLowerCase();
    const matchingPrefs = prefs.filter(p =>
      eventCityLower.includes(p.city.toLowerCase()) ||
      p.city.toLowerCase().includes(eventCityLower)
    );

    for (const pref of matchingPrefs) {
      try {
        await db.insert(notificationsTable).values({
          userId: pref.userId,
          type: "new_event_nearby",
          message: `New event near ${event.city}: ${event.title}`,
        });
      } catch (err) {
        console.error("[notifyEventAlerts] failed to insert notification", err);
      }
    }
  }
}

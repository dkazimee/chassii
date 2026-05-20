import { scrapeRedditEvents, ScrapeReport } from "./eventScraper";
import { scrapeEventbriteEvents, EventbriteScrapeReport } from "./eventbriteScraper";
import { scrapeSerpApiEvents, SerpScrapeReport } from "./serpApiScraper";
import { notifyEventAlerts } from "./notifyEventAlerts";

export type CombinedScrapeReport = {
  reddit: ScrapeReport;
  eventbrite: EventbriteScrapeReport;
  google?: SerpScrapeReport;
  totalInserted: number;
  totalFetched: number;
};

export async function runAllScrapers(city?: string): Promise<CombinedScrapeReport> {
  console.log(`[scrapers] starting all scrapers${city ? ` for city: ${city}` : ""}`);

  const scrapers: [Promise<ScrapeReport>, Promise<EventbriteScrapeReport>, Promise<SerpScrapeReport> | null] = [
    scrapeRedditEvents(60, city),
    scrapeEventbriteEvents(city),
    city ? scrapeSerpApiEvents(city) : null,
  ];

  const [reddit, eventbrite, google] = await Promise.allSettled(
    scrapers.filter(Boolean) as Promise<unknown>[]
  );

  const redditReport: ScrapeReport = reddit.status === "fulfilled"
    ? reddit.value as ScrapeReport
    : { fetched: 0, evaluated: 0, inserted: 0, skippedDuplicates: 0, skippedNonEvent: 0, skippedPast: 0, errors: 1, insertedEvents: [] };

  const eventbriteReport: EventbriteScrapeReport = eventbrite.status === "fulfilled"
    ? eventbrite.value as EventbriteScrapeReport
    : { fetched: 0, inserted: 0, skippedDuplicates: 0, skippedPast: 0, skippedNoLocation: 0, errors: 1, insertedEvents: [] };

  const googleReport: SerpScrapeReport | undefined = city
    ? (google?.status === "fulfilled"
        ? google.value as SerpScrapeReport
        : { fetched: 0, inserted: 0, skippedDuplicates: 0, skippedNoDate: 0, skippedOutOfRange: 0, skippedPast: 0, errors: 1, insertedEvents: [] })
    : undefined;

  if (reddit.status === "rejected") console.error("[scrapers] Reddit scraper failed", reddit.reason);
  if (eventbrite.status === "rejected") console.error("[scrapers] Eventbrite scraper failed", eventbrite.reason);
  if (city && google?.status === "rejected") console.error("[scrapers] Google scraper failed", (google as PromiseRejectedResult).reason);

  const allInsertedEvents = [
    ...redditReport.insertedEvents,
    ...eventbriteReport.insertedEvents,
    ...(googleReport?.insertedEvents ?? []),
  ];

  if (allInsertedEvents.length > 0) {
    try {
      await notifyEventAlerts(allInsertedEvents);
      console.log(`[scrapers] sent alert notifications for ${allInsertedEvents.length} new event(s)`);
    } catch (err) {
      console.error("[scrapers] notifyEventAlerts failed", err);
    }
  }

  const result: CombinedScrapeReport = {
    reddit: redditReport,
    eventbrite: eventbriteReport,
    google: googleReport,
    totalInserted: redditReport.inserted + eventbriteReport.inserted + (googleReport?.inserted ?? 0),
    totalFetched: redditReport.fetched + eventbriteReport.fetched + (googleReport?.fetched ?? 0),
  };

  console.log(`[scrapers] done — reddit: ${redditReport.inserted}, eventbrite: ${eventbriteReport.inserted}, google: ${googleReport?.inserted ?? "skipped"}`);
  return result;
}

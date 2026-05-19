import { scrapeRedditEvents, ScrapeReport } from "./eventScraper";
import { scrapeEventbriteEvents, EventbriteScrapeReport } from "./eventbriteScraper";

export type CombinedScrapeReport = {
  reddit: ScrapeReport;
  eventbrite: EventbriteScrapeReport;
  totalInserted: number;
  totalFetched: number;
};

export async function runAllScrapers(city?: string): Promise<CombinedScrapeReport> {
  console.log(`[scrapers] starting all scrapers${city ? ` for city: ${city}` : ""}`);

  const [reddit, eventbrite] = await Promise.allSettled([
    scrapeRedditEvents(60, city),
    scrapeEventbriteEvents(city),
  ]);

  const redditReport: ScrapeReport = reddit.status === "fulfilled"
    ? reddit.value
    : { fetched: 0, evaluated: 0, inserted: 0, skippedDuplicates: 0, skippedNonEvent: 0, skippedPast: 0, errors: 1 };

  const eventbriteReport: EventbriteScrapeReport = eventbrite.status === "fulfilled"
    ? eventbrite.value
    : { fetched: 0, inserted: 0, skippedDuplicates: 0, skippedPast: 0, skippedNoLocation: 0, errors: 1 };

  if (reddit.status === "rejected") {
    console.error("[scrapers] Reddit scraper failed", reddit.reason);
  }
  if (eventbrite.status === "rejected") {
    console.error("[scrapers] Eventbrite scraper failed", eventbrite.reason);
  }

  const result: CombinedScrapeReport = {
    reddit: redditReport,
    eventbrite: eventbriteReport,
    totalInserted: redditReport.inserted + eventbriteReport.inserted,
    totalFetched: redditReport.fetched + eventbriteReport.fetched,
  };

  console.log(`[scrapers] done — reddit: ${redditReport.inserted} inserted, eventbrite: ${eventbriteReport.inserted} inserted`);
  return result;
}

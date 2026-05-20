import app from "./app";
import { logger } from "./lib/logger";
import { runAllScrapers } from "./lib/scraperRunner";
import { scrapeSerpApiEvents } from "./lib/serpApiScraper";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Major US metros to auto-scrape Google Events for every 6 hours
const DEFAULT_CITIES = [
  "Los Angeles, CA",
  "New York, NY",
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Philadelphia, PA",
  "San Antonio, TX",
  "San Diego, CA",
  "Dallas, TX",
  "Miami, FL",
  "Atlanta, GA",
  "Denver, CO",
  "Seattle, WA",
  "Las Vegas, NV",
  "Detroit, MI",
];

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  async function scheduledScrape() {
    logger.info("[scheduler] Starting scheduled event scrape");
    try {
      const report = await runAllScrapers();
      logger.info({ report }, "[scheduler] Scheduled scrape complete");
    } catch (err) {
      logger.error({ err }, "[scheduler] Scheduled scrape failed");
    }

    // Google Events scrape for each default city, staggered to avoid rate limits
    if (process.env.SERPAPI_KEY) {
      logger.info("[scheduler] Starting Google Events scrape for default cities");
      for (const city of DEFAULT_CITIES) {
        try {
          const report = await scrapeSerpApiEvents(city);
          logger.info({ city, inserted: report.inserted, fetched: report.fetched }, "[scheduler] Google scrape complete");
        } catch (err) {
          logger.error({ err, city }, "[scheduler] Google scrape failed for city");
        }
        // 2s delay between cities to be polite to SerpAPI
        await new Promise(r => setTimeout(r, 2000));
      }
      logger.info("[scheduler] Google Events scrape for all cities complete");
    }
  }

  setInterval(scheduledScrape, SIX_HOURS_MS);
  logger.info("[scheduler] Auto-scrape scheduled every 6 hours");
  scheduledScrape();
});

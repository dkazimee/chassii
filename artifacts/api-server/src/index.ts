import app from "./app";
import { logger } from "./lib/logger";
import { runAllScrapers } from "./lib/scraperRunner";

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
  }

  setInterval(scheduledScrape, SIX_HOURS_MS);
  logger.info("[scheduler] Auto-scrape scheduled every 6 hours");
  scheduledScrape();
});

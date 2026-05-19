import { db, eventsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const REDDIT_UA = "CHASSII Social Network (https://chassii-social-network.replit.app)";

const SUBREDDITS_AND_QUERIES: Array<{ sub: string; q: string }> = [
  { sub: "cars", q: "meet OR event OR cars and coffee" },
  { sub: "carmeets", q: "meet OR event" },
  { sub: "Autos", q: "meet OR event OR show" },
  { sub: "carshow", q: "show OR meet" },
  { sub: "Cartalk", q: "meet OR event" },
  { sub: "projectcar", q: "meet OR event OR show" },
  { sub: "spotted", q: "meet OR event" },
];

type RedditPost = {
  id: string;
  title: string;
  selftext: string;
  permalink: string;
  url: string;
  created_utc: number;
  subreddit: string;
};

async function fetchRedditPosts(): Promise<RedditPost[]> {
  const all: RedditPost[] = [];
  for (const { sub, q } of SUBREDDITS_AND_QUERIES) {
    try {
      const url = new URL(`https://www.reddit.com/r/${sub}/search.json`);
      url.searchParams.set("q", q);
      url.searchParams.set("restrict_sr", "true");
      url.searchParams.set("sort", "new");
      url.searchParams.set("limit", "15");
      url.searchParams.set("t", "month");
      const r = await fetch(url.toString(), { headers: { "User-Agent": REDDIT_UA } });
      if (!r.ok) continue;
      const json = (await r.json()) as { data?: { children?: Array<{ data: RedditPost }> } };
      for (const c of json.data?.children ?? []) {
        all.push(c.data);
      }
    } catch (err) {
      console.error(`[scraper] subreddit ${sub} failed`, err);
    }
  }
  return all;
}

type ExtractedEvent = {
  isEvent: boolean;
  title?: string;
  description?: string;
  date?: string;
  city?: string;
  location?: string;
  type?: string;
};

async function extractEvent(post: RedditPost): Promise<ExtractedEvent | null> {
  const text = `Title: ${post.title}\n\nBody:\n${(post.selftext || "").slice(0, 3000)}`;
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 600,
      messages: [
        {
          role: "system",
          content: `You extract real-world upcoming CAR events (meets, cars-and-coffee, shows, track days, cruises) from social posts.
Today is ${new Date().toISOString().slice(0, 10)}.
Respond ONLY with strict JSON, no prose, matching:
{"isEvent": boolean, "title": string, "description": string, "date": string (ISO 8601 with time, future date), "city": string, "location": string, "type": "meet"|"show"|"track_day"|"cruise"|"other"}
Rules:
- isEvent = true ONLY if the post advertises a specific real upcoming event with a clear date AND city.
- isEvent = false for questions, general discussion, recaps of past events, memes, or posts missing a date or city.
- date MUST be in the future. Skip vague dates ("next month", "summer"). If no specific date is given, isEvent = false.
- city = US/intl city name like "Austin, TX" or "London, UK". If missing, isEvent = false.
- title: a short event name, not the Reddit title.
- description: 1-2 sentence summary of what to expect.`,
        },
        { role: "user", content: text },
      ],
    });
    const raw = resp.choices[0]?.message?.content || "";
    const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
    const parsed = JSON.parse(cleaned) as ExtractedEvent;
    return parsed;
  } catch (err) {
    return null;
  }
}

async function getOrCreateBotUser(): Promise<typeof usersTable.$inferSelect> {
  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, "system:chassii-bot"),
  });
  if (existing) return existing;
  // Race-safe: if a concurrent scrape inserted first, conflict -> reselect.
  const inserted = await db.insert(usersTable).values({
    clerkId: "system:chassii-bot",
    username: "chassii_bot",
    displayName: "CHASSII Events Bot",
    bio: "Auto-discovers car events from across the web so you don't have to.",
  }).onConflictDoNothing({ target: usersTable.clerkId }).returning();
  if (inserted[0]) return inserted[0];
  const found = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, "system:chassii-bot"),
  });
  if (!found) throw new Error("Failed to get or create bot user");
  return found;
}

export type ScrapeReport = {
  fetched: number;
  evaluated: number;
  inserted: number;
  skippedDuplicates: number;
  skippedNonEvent: number;
  skippedPast: number;
  errors: number;
};

export async function scrapeRedditEvents(maxPosts = 40): Promise<ScrapeReport> {
  const report: ScrapeReport = {
    fetched: 0, evaluated: 0, inserted: 0,
    skippedDuplicates: 0, skippedNonEvent: 0, skippedPast: 0, errors: 0,
  };

  const bot = await getOrCreateBotUser();
  const posts = await fetchRedditPosts();
  report.fetched = posts.length;

  // Dedupe by permalink upfront
  const seen = new Set<string>();
  const unique = posts.filter(p => {
    const key = `reddit:${p.permalink}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, maxPosts);

  // Pre-filter existing sourceUrls to avoid wasted AI calls
  const existingUrls = await db.select({ url: eventsTable.sourceUrl })
    .from(eventsTable)
    .where(sql`${eventsTable.sourceUrl} IS NOT NULL`);
  const existingSet = new Set(existingUrls.map(r => r.url));

  for (const post of unique) {
    const sourceUrl = `https://reddit.com${post.permalink}`;
    if (existingSet.has(sourceUrl)) {
      report.skippedDuplicates++;
      continue;
    }
    report.evaluated++;
    const extracted = await extractEvent(post);
    if (!extracted || !extracted.isEvent || !extracted.date || !extracted.city || !extracted.title || !extracted.location) {
      report.skippedNonEvent++;
      continue;
    }
    const date = new Date(extracted.date);
    if (isNaN(date.getTime()) || date.getTime() < Date.now()) {
      report.skippedPast++;
      continue;
    }
    try {
      const inserted = await db.insert(eventsTable).values({
        userId: bot.id,
        title: extracted.title.slice(0, 200),
        description: (extracted.description || "").slice(0, 1000),
        type: extracted.type || "other",
        date,
        location: extracted.location.slice(0, 200),
        city: extracted.city.slice(0, 100),
        source: "reddit",
        sourceUrl,
      }).onConflictDoNothing({ target: eventsTable.sourceUrl }).returning({ id: eventsTable.id });
      if (inserted.length > 0) {
        report.inserted++;
      } else {
        report.skippedDuplicates++;
      }
    } catch (err) {
      report.errors++;
      console.error("[scraper] insert failed", err);
    }
  }

  return report;
}

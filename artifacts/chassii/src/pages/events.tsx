import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useRsvpEvent } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar, MapPin, Users, ExternalLink, Search, Bot, RefreshCw, X, Map, List } from "lucide-react";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SignedIn } from "@/components/auth/ConditionalAuth";
import { useAuth } from "@clerk/react";

const EventsMap = lazy(() => import("@/components/EventsMap"));

type ScrapedEvent = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  date: string;
  location: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  source: string | null;
  sourceUrl: string | null;
  rsvpCount: number;
  hasRsvpd: boolean;
  organizer: { id: number; username: string; displayName: string; avatarUrl: string | null };
};

const WMO: Record<number, { label: string; emoji: string }> = {
  0:  { label: "Clear sky",        emoji: "☀️"  },
  1:  { label: "Mostly clear",     emoji: "🌤️" },
  2:  { label: "Partly cloudy",    emoji: "⛅"  },
  3:  { label: "Overcast",         emoji: "☁️"  },
  45: { label: "Foggy",            emoji: "🌫️" },
  48: { label: "Icy fog",          emoji: "🌫️" },
  51: { label: "Light drizzle",    emoji: "🌦️" },
  53: { label: "Drizzle",          emoji: "🌦️" },
  55: { label: "Heavy drizzle",    emoji: "🌧️" },
  61: { label: "Light rain",       emoji: "🌧️" },
  63: { label: "Rain",             emoji: "🌧️" },
  65: { label: "Heavy rain",       emoji: "🌧️" },
  71: { label: "Light snow",       emoji: "🌨️" },
  73: { label: "Snow",             emoji: "🌨️" },
  75: { label: "Heavy snow",       emoji: "❄️"  },
  77: { label: "Sleet",            emoji: "🌨️" },
  80: { label: "Showers",          emoji: "🌦️" },
  81: { label: "Showers",          emoji: "🌧️" },
  82: { label: "Heavy showers",    emoji: "⛈️"  },
  85: { label: "Snow showers",     emoji: "🌨️" },
  86: { label: "Heavy snow showers", emoji: "❄️" },
  95: { label: "Thunderstorm",     emoji: "⛈️"  },
  96: { label: "Thunderstorm",     emoji: "⛈️"  },
  99: { label: "Heavy thunderstorm", emoji: "⛈️" },
};

function wmoInfo(code: number) {
  if (WMO[code]) return WMO[code];
  const keys = Object.keys(WMO).map(Number).sort((a, b) => b - a);
  for (const k of keys) if (k <= code) return WMO[k];
  return { label: "Weather", emoji: "🌡️" };
}

type WeatherData = { weathercode: number; tempMax: number; tempMin: number; precipProb: number };

function WeatherBadge({ lat, lng, date }: { lat: number; lng: number; date: string }) {
  const day = date.slice(0, 10);
  const { data, isLoading } = useQuery<WeatherData | null>({
    queryKey: ["weather", lat.toFixed(3), lng.toFixed(3), day],
    queryFn: async () => {
      const r = await fetch(`/api/weather?lat=${lat}&lng=${lng}&date=${day}`);
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 3 * 60 * 60 * 1000,
    retry: false,
  });

  if (isLoading) return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-0.5 rounded-full animate-pulse">
      ⛅ --°
    </span>
  );
  if (!data) return null;

  const { emoji, label } = wmoInfo(data.weathercode);
  return (
    <span
      title={`${label} · High ${data.tempMax}°F · Low ${data.tempMin}°F · ${data.precipProb}% precip`}
      className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 bg-sky-50 border border-sky-100 px-2.5 py-0.5 rounded-full cursor-default select-none"
    >
      {emoji} {data.tempMax}°<span className="text-sky-400 font-normal">/{data.tempMin}°</span>
      {data.precipProb >= 30 && (
        <span className="text-blue-400 font-normal text-xs ml-0.5">💧{data.precipProb}%</span>
      )}
    </span>
  );
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return null;
  if (source === "eventbrite") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">Eventbrite</span>;
  if (source === "google") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Google</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Reddit</span>;
}

export default function EventsPage() {
  const [cityFilter, setCityFilter] = useState("");
  const [debouncedCity, setDebouncedCity] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [scrapeCity, setScrapeCity] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  // { lat, lng } of user's saved city (auto-set on mount)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  // { lat, lng } derived from the manual city filter input
  const [filterCoords, setFilterCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [savedCity, setSavedCity] = useState<string | null>(null);
  const rsvpEvent = useRsvpEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isSignedIn } = useAuth();
  const initFired = useRef(false);

  const { data: adminInfo } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: async () => {
      const r = await fetch("/api/admin/me", { credentials: "include" });
      if (!r.ok) return { isAdmin: false };
      return (await r.json()) as { isAdmin: boolean };
    },
    retry: false,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCity(cityFilter.trim()), 400);
    return () => clearTimeout(t);
  }, [cityFilter]);

  // When debouncedCity changes, geocode it to get coords for radius filtering
  useEffect(() => {
    if (!debouncedCity) { setFilterCoords(null); return; }
    (async () => {
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(debouncedCity)}`);
        if (r.ok) setFilterCoords(await r.json());
        else setFilterCoords(null);
      } catch { setFilterCoords(null); }
    })();
  }, [debouncedCity]);

  // On mount: load saved city, geocode it, trigger Google scrape
  useEffect(() => {
    if (!isSignedIn || initFired.current) return;
    initFired.current = true;

    (async () => {
      try {
        const prefRes = await fetch("/api/users/me/alert-preferences", { credentials: "include" });
        if (!prefRes.ok) return;
        const pref = await prefRes.json() as { city?: string; enabled?: boolean } | null;
        const city = pref?.city;
        if (!city) return;
        setSavedCity(city);

        // Geocode the saved city for radius filtering
        const geoRes = await fetch(`/api/geocode?q=${encodeURIComponent(city)}`);
        if (geoRes.ok) setUserCoords(await geoRes.json());

        // Silently trigger Google Events scrape for this city
        await fetch("/api/events/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city }),
        });
        // Refresh list after scrape has had time to complete
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["events"] }), 10000);
      } catch {
        // Silent — don't show errors for background work
      }
    })();
  }, [isSignedIn, queryClient]);

  // Active coords: manual filter takes priority, then saved city
  const activeCoords = filterCoords ?? userCoords;

  const { data: allEvents, isLoading } = useQuery({
    queryKey: ["events", { nearLat: activeCoords?.lat, nearLng: activeCoords?.lng, city: debouncedCity }],
    queryFn: async () => {
      const url = new URL("/api/events", window.location.origin);
      if (activeCoords) {
        url.searchParams.set("nearLat", String(activeCoords.lat));
        url.searchParams.set("nearLng", String(activeCoords.lng));
        url.searchParams.set("radiusMiles", "100");
      } else if (debouncedCity) {
        url.searchParams.set("city", debouncedCity);
      }
      url.searchParams.set("limit", "80");
      const r = await fetch(url.toString(), { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load events");
      return (await r.json()) as ScrapedEvent[];
    },
  });

  const events = (() => {
    if (!allEvents) return allEvents;
    const q = debouncedSearch.toLowerCase();
    if (!q) return allEvents;
    return allEvents.filter((e) =>
      e.title.toLowerCase().includes(q) ||
      (e.description ?? "").toLowerCase().includes(q) ||
      (e.location ?? "").toLowerCase().includes(q) ||
      (e.city ?? "").toLowerCase().includes(q) ||
      (e.type ?? "").toLowerCase().includes(q) ||
      (e.source ?? "").toLowerCase().includes(q) ||
      (e.organizer?.displayName ?? "").toLowerCase().includes(q) ||
      (e.organizer?.username ?? "").toLowerCase().includes(q),
    );
  })();

  const handleRsvp = (eventId: number) => {
    rsvpEvent.mutate({ eventId }, {
      onSuccess: (data) => {
        toast({ title: data.rsvpd ? "RSVP Confirmed" : "RSVP Cancelled" });
        queryClient.invalidateQueries({ queryKey: ["events"] });
      }
    });
  };

  async function handleScrape() {
    setIsScraping(true);
    try {
      const body: Record<string, string> = {};
      if (scrapeCity.trim()) body.city = scrapeCity.trim();
      const r = await fetch("/api/admin/events/scrape", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Scrape failed");
      const report = json.report;
      const inserted = report?.totalInserted ?? report?.inserted ?? 0;
      const fetched = report?.totalFetched ?? report?.fetched ?? 0;
      const redditInserted = report?.reddit?.inserted ?? 0;
      const ebInserted = report?.eventbrite?.inserted ?? 0;
      const googleInserted = report?.google?.inserted ?? 0;
      toast({
        title: `Found ${inserted} new event${inserted !== 1 ? "s" : ""}`,
        description: `Reddit: ${redditInserted}, Eventbrite: ${ebInserted}, Google: ${googleInserted} (${fetched} total scanned)`,
      });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    } catch (err) {
      toast({ title: "Scrape failed", description: String(err), variant: "destructive" });
    } finally {
      setIsScraping(false);
    }
  }

  const effectiveCity = debouncedCity || debouncedSearch;
  const mappableEvents = events?.filter(e => e.lat != null && e.lng != null) ?? [];
  const hasMappable = mappableEvents.length > 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Events & Meets</h1>
          <p className="text-gray-500 mt-2">
            {activeCoords
              ? <>Showing events within 100 miles of <span className="font-semibold text-gray-700">{debouncedCity || savedCity}</span></>
              : "Auto-discovered car events from Google, Reddit, and Eventbrite — set your city to filter by location."
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SignedIn>
            <Button size="lg" className="rounded-full">Create Event</Button>
          </SignedIn>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search events by title, location, organizer…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 pr-9"
            data-testid="input-event-search"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="relative w-full sm:w-56">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Near me (city, e.g. Austin, TX)"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="pl-9 pr-9"
            data-testid="input-event-city-search"
          />
          {cityFilter && (
            <button
              onClick={() => setCityFilter("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              aria-label="Clear city"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {/* View toggle */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden shrink-0">
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === "list" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
            aria-label="List view"
          >
            <List className="h-4 w-4" /> List
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === "map" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
            aria-label="Map view"
          >
            <Map className="h-4 w-4" /> Map
          </button>
        </div>
      </div>

      {/* Admin scrape panel */}
      {adminInfo?.isAdmin && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Target city for refresh (optional)"
              value={scrapeCity}
              onChange={(e) => setScrapeCity(e.target.value)}
              className="pl-9"
              data-testid="input-scrape-city"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleScrape}
            disabled={isScraping}
            data-testid="button-scrape-events"
            className="rounded-full whitespace-nowrap"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isScraping ? "animate-spin" : ""}`} />
            {isScraping ? "Scanning…" : "Refresh from Web"}
          </Button>
          <p className="text-xs text-gray-400 sm:w-48">Auto-refreshes every 6 hours. Use this to trigger an on-demand scan.</p>
        </div>
      )}

      {/* Map view */}
      {viewMode === "map" && (
        <div>
          {isLoading ? (
            <Skeleton className="h-96 w-full rounded-2xl" />
          ) : hasMappable ? (
            <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
              <EventsMap events={mappableEvents as any} />
            </Suspense>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-dashed border-gray-300 text-center px-6">
              <Map className="h-10 w-10 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-800">No mappable events</h3>
              <p className="text-gray-500 text-sm mt-1">
                {effectiveCity
                  ? `No events with location data match "${effectiveCity}".`
                  : "Events without a recognizable city can't be placed on the map. They still appear in the list."}
              </p>
              <button
                onClick={() => setViewMode("list")}
                className="mt-3 text-sm text-blue-600 hover:underline"
              >
                Switch to list view
              </button>
            </div>
          )}
          {/* Show count of events not on map */}
          {events && events.length > 0 && events.length - mappableEvents.length > 0 && (
            <p className="text-xs text-gray-400 mt-2 text-center">
              {events.length - mappableEvents.length} event{events.length - mappableEvents.length !== 1 ? "s" : ""} without location data not shown on map —{" "}
              <button onClick={() => setViewMode("list")} className="underline hover:text-gray-600">view in list</button>
            </p>
          )}
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading ? (
            [1,2,3,4].map(i => <Skeleton key={i} className="h-64 w-full rounded-3xl" />)
          ) : events && events.length > 0 ? (
            events.map(event => (
              <Card key={event.id} className="rounded-3xl overflow-hidden border-gray-100 shadow-sm flex flex-col">
                <div className="h-48 bg-gray-900 relative">
                  {event.imageUrl ? (
                    <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover opacity-80" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <Calendar className="h-12 w-12 text-gray-600" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-sm font-bold text-gray-900">
                    {format(new Date(event.date), 'MMM d, h:mm a')}
                  </div>
                  {event.source && (
                    <div className="absolute top-4 left-4 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
                      <Bot className="h-3 w-3" />
                      <SourceBadge source={event.source} />
                    </div>
                  )}
                </div>
                <CardContent className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge variant="outline">{event.type.replace('_', ' ')}</Badge>
                    {event.city && <Badge variant="secondary">{event.city}</Badge>}
                    {event.lat != null && event.lng != null && (
                      <WeatherBadge lat={event.lat} lng={event.lng} date={event.date} />
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h3>
                  <div className="flex items-center gap-2 text-gray-500 mb-4 text-sm">
                    <MapPin className="h-4 w-4 flex-shrink-0" /> {event.location}
                  </div>
                  {event.description && <p className="text-gray-600 line-clamp-2 mb-6 text-sm">{event.description}</p>}

                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                      <Users className="h-4 w-4" /> {event.rsvpCount || 0} Attending
                    </div>
                    <div className="flex items-center gap-2">
                      {event.sourceUrl && (
                        <a
                          href={event.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 text-sm"
                        >
                          Source <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <SignedIn>
                        <Button
                          variant={event.hasRsvpd ? "outline" : "default"}
                          onClick={() => handleRsvp(event.id)}
                          disabled={rsvpEvent.isPending}
                        >
                          {event.hasRsvpd ? "Going" : "RSVP"}
                        </Button>
                      </SignedIn>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-2 text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900">No events found</h3>
              <p className="mt-2 text-gray-500 max-w-sm mx-auto">
                {activeCoords
                  ? `No upcoming car events within 100 miles of ${debouncedCity || savedCity}. Try a different city or clear the filter.`
                  : isSignedIn
                    ? "Set your city in your notification preferences to see local events automatically."
                    : "Sign in and set your city to see events near you."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

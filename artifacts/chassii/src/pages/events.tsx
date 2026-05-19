import { useState, useEffect } from "react";
import { useRsvpEvent } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Users, ExternalLink, Search, Bot, RefreshCw, X } from "lucide-react";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SignedIn } from "@/components/auth/ConditionalAuth";

type ScrapedEvent = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  date: string;
  location: string;
  city: string | null;
  imageUrl: string | null;
  source: string | null;
  sourceUrl: string | null;
  rsvpCount: number;
  hasRsvpd: boolean;
  organizer: { id: number; username: string; displayName: string; avatarUrl: string | null };
};

type CityRow = { city: string; count: number };

export default function EventsPage() {
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const rsvpEvent = useRsvpEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: adminInfo } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: async () => {
      const r = await fetch("/api/admin/me", { credentials: "include" });
      if (!r.ok) return { isAdmin: false };
      return (await r.json()) as { isAdmin: boolean };
    },
    retry: false,
  });
  const [isScraping, setIsScraping] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const cityParam = cityFilter !== "all" ? cityFilter : "";

  const { data: allEvents, isLoading } = useQuery({
    queryKey: ["events", { city: cityParam }],
    queryFn: async () => {
      const url = new URL("/api/events", window.location.origin);
      if (cityParam) url.searchParams.set("city", cityParam);
      url.searchParams.set("limit", "40");
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

  const { data: cities } = useQuery({
    queryKey: ["events", "cities"],
    queryFn: async () => {
      const r = await fetch("/api/events/cities");
      if (!r.ok) return [] as CityRow[];
      return (await r.json()) as CityRow[];
    },
  });

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
      const r = await fetch("/api/admin/events/scrape", { method: "POST", credentials: "include" });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Scrape failed");
      toast({
        title: `Imported ${json.report.inserted} new events`,
        description: `Scanned ${json.report.fetched} posts • ${json.report.skippedDuplicates} duplicates skipped`,
      });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    } catch (err) {
      toast({ title: "Scrape failed", description: String(err), variant: "destructive" });
    } finally {
      setIsScraping(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Events & Meets</h1>
          <p className="text-gray-500 mt-2">Local cars and coffee, track days, cruises — plus events auto-discovered from across the web.</p>
        </div>
        <div className="flex items-center gap-2">
          {adminInfo?.isAdmin && (
            <Button
              variant="outline"
              onClick={handleScrape}
              disabled={isScraping}
              data-testid="button-scrape-events"
              className="rounded-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isScraping ? "animate-spin" : ""}`} />
              {isScraping ? "Scanning…" : "Refresh from Web"}
            </Button>
          )}
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
            data-testid="input-event-city-search"
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
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-full sm:w-64" data-testid="select-event-city">
            <SelectValue placeholder="All cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cities</SelectItem>
            {cities?.map(c => (
              <SelectItem key={c.city} value={c.city}>
                {c.city} <span className="text-gray-400 ml-1">({c.count})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
                  <div className="absolute top-4 left-4 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <Bot className="h-3 w-3" /> via {event.source}
                  </div>
                )}
              </div>
              <CardContent className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline">{event.type.replace('_', ' ')}</Badge>
                  {event.city && <Badge variant="secondary">{event.city}</Badge>}
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
            <p className="mt-2 text-gray-500">
              {effectiveCity
                ? `No upcoming events match "${effectiveCity}". Try clearing the filter.`
                : "Check back later, create your own, or ask an admin to refresh from the web."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

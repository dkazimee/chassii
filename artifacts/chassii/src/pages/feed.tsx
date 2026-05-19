import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useGetFeed } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Car, Wrench, Users, TrendingUp, Calendar, MapPin, MessageSquare, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostActions } from "@/components/PostActions";
import { FeedFilters, EMPTY_FILTERS, type FeedFilterValues } from "@/components/FeedFilters";
import { useLightbox } from "@/components/Lightbox";

function matchesFilters(item: any, f: FeedFilterValues): boolean {
  const make = (item.post?.make ?? item.car?.make ?? "").toString().toLowerCase();
  const model = (item.post?.model ?? item.car?.model ?? "").toString().toLowerCase();
  const year = (item.post?.year ?? item.car?.year ?? "").toString();
  const generation = (item.post?.generation ?? item.car?.generation ?? "").toString().toLowerCase();
  const location = (item.post?.location ?? item.actor?.location ?? "").toString().toLowerCase();
  const category = (item.post?.category ?? "").toString().toLowerCase();

  if (f.make && make !== f.make.toLowerCase()) return false;
  if (f.model && model !== f.model.toLowerCase()) return false;
  if (f.year && year !== f.year) return false;
  if (f.generation && generation !== f.generation.toLowerCase()) return false;
  if (f.location && !location.includes(f.location.toLowerCase().trim())) return false;
  if (f.category && f.category !== "all" && category !== f.category.toLowerCase()) return false;
  return true;
}

export default function FeedPage() {
  const { isSignedIn } = useAuth();
  const { data: feedData, isLoading } = useGetFeed();
  const { data: adminInfo } = useQuery({
    queryKey: ["admin-me"],
    enabled: !!isSignedIn,
    queryFn: async () => {
      const r = await fetch("/api/admin/me", { credentials: "include" });
      if (!r.ok) return { isAdmin: false };
      return (await r.json()) as { isAdmin: boolean };
    },
  });
  const isAdmin = !!adminInfo?.isAdmin;
  const [filters, setFilters] = useState<FeedFilterValues>(EMPTY_FILTERS);
  const lightbox = useLightbox();

  const filteredFeed = (feedData ?? []).filter((item) => matchesFilters(item, filters));
  const hasActiveFilters =
    !!filters.make || !!filters.model || !!filters.year || !!filters.generation || !!filters.location || (!!filters.category && filters.category !== "all");

  const renderFeedItem = (item: any) => {
    if (item.type === 'post' && item.post) {
      return (
        <Card key={item.id} className="mb-4 hover:border-gray-300 transition-colors">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={item.actor?.avatarUrl || ''} />
                <AvatarFallback>{item.actor?.displayName?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Link href={`/users/${item.actor?.id}`} className="font-semibold text-gray-900 hover:underline">
                    {item.actor?.displayName}
                  </Link>
                  <span className="text-gray-500 text-sm">started a discussion</span>
                  <span className="text-gray-400 text-sm ml-auto">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <Link href={`/posts/${item.post.id}`}>
                  <h3 className="text-xl font-bold text-gray-900 mb-2 hover:text-primary cursor-pointer">
                    {item.post.title}
                  </h3>
                  {item.post.body && (
                    <p className="text-gray-600 line-clamp-3 mb-4">{item.post.body}</p>
                  )}
                </Link>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <PostActions
                    postId={item.post.id}
                    likeCount={item.post.likeCount || 0}
                    commentCount={item.post.commentCount || 0}
                    isLiked={!!item.post.isLiked}
                    size="sm"
                  />
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    {item.post.category}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    if (item.type === 'new_car' && item.car) {
      return (
        <Card key={item.id} className="mb-4 hover:border-gray-300 transition-colors overflow-hidden">
          <CardContent className="p-0">
            {item.car.mainImageUrl && (
              <Link href={`/cars/${item.car.id}`}>
                <div className="h-48 w-full cursor-pointer overflow-hidden">
                  <img src={item.car.mainImageUrl} alt={`${item.car.year} ${item.car.make} ${item.car.model}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                </div>
              </Link>
            )}
            <div className="p-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={item.actor?.avatarUrl || ''} />
                  <AvatarFallback>{item.actor?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/users/${item.actor?.id}`} className="font-semibold text-gray-900 hover:underline">
                      {item.actor?.displayName}
                    </Link>
                    <span className="text-gray-500 text-sm">added a new car to their garage</span>
                    <span className="text-gray-400 text-sm ml-auto">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <Link href={`/cars/${item.car.id}`}>
                    <h3 className="text-xl font-bold text-gray-900 hover:text-primary cursor-pointer">
                      {item.car.year} {item.car.make} {item.car.model}
                    </h3>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (item.type === 'timeline_entry' && item.timelineEntry) {
        return (
          <Card key={item.id} className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Wrench className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Link href={`/users/${item.actor?.id}`} className="font-semibold text-gray-900 hover:underline">
                      {item.actor?.displayName}
                    </Link>
                    <span className="text-gray-500 text-sm">updated their build</span>
                    <span className="text-gray-400 text-sm ml-auto">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <Link href={`/cars/${item.timelineEntry.carId}`}>
                    <h3 className="text-lg font-bold text-gray-900 mb-2 cursor-pointer hover:underline">
                      {item.timelineEntry.title}
                    </h3>
                  </Link>
                  {item.timelineEntry.body && (
                    <p className="text-gray-600 mb-4">{item.timelineEntry.body}</p>
                  )}
                  {item.timelineEntry.imageUrls && item.timelineEntry.imageUrls.length > 0 && (
                     <div className="grid grid-cols-2 gap-2 mt-2">
                        {item.timelineEntry.imageUrls.map((url: string, i: number) => (
                           <button
                             key={i}
                             type="button"
                             onClick={() => lightbox.open(item.timelineEntry.imageUrls, i, item.timelineEntry.title)}
                             className="block w-full focus:outline-none focus:ring-2 focus:ring-primary rounded-lg overflow-hidden"
                           >
                             <img src={url} alt="Timeline update" className="rounded-lg w-full h-32 object-cover cursor-zoom-in hover:opacity-95 transition-opacity" />
                           </button>
                        ))}
                     </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
    }

    return null;
  };

  return (
    <>
    {lightbox.element}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <Tabs defaultValue="following" className="w-full">
          <TabsList className="mb-6 w-full justify-start border-b rounded-none h-12 bg-transparent p-0">
            <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2 font-semibold">
              All Activity
            </TabsTrigger>
            <TabsTrigger value="following" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2 font-semibold">
              Following
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-0">
            <FeedFilters
              value={filters}
              onChange={setFilters}
              resultCount={filteredFeed.length}
              totalCount={feedData?.length ?? 0}
            />
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/4" />
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-20 w-full" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredFeed.length > 0 ? (
              filteredFeed.map(renderFeedItem)
            ) : hasActiveFilters ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                <Car className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No activity matches these filters</h3>
                <p className="mt-1 text-gray-500">Try clearing a filter or two to see more.</p>
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                <Car className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Your feed is quiet</h3>
                <p className="mt-1 text-gray-500">Follow users and cars to see updates here.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="following" className="mt-0">
             <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                <h3 className="text-lg font-medium text-gray-900">Not enough data</h3>
                <p className="mt-1 text-gray-500">Find more garages to follow.</p>
              </div>
          </TabsContent>
        </Tabs>
      </div>

      <aside className="hidden lg:block">
        <HomeSidebar />
      </aside>
    </div>
    </>
  );
}

function HomeSidebar() {
  const { isSignedIn } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["home-sidebar"],
    enabled: !!isSignedIn,
    queryFn: async () => {
      const r = await fetch("/api/home/sidebar", { credentials: "include" });
      if (!r.ok) return null;
      return (await r.json()) as {
        suggestions: Array<{ id: number; username: string; displayName: string; avatarUrl: string | null; location: string | null; reason: string }>;
        trending: Array<{ id: number; title: string; make: string | null; model: string | null; likeCount: number; commentCount: number; author: { displayName: string; avatarUrl: string | null } }>;
        events: Array<{ id: number; title: string; date: string; location: string; city: string | null; type: string }>;
        myCars: Array<{ id: number; make: string; model: string; year: number; mainImageUrl: string | null }>;
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 sticky top-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3"><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 sticky top-6">
      {/* My Garage at a Glance */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Car className="h-4 w-4" /> My Garage</h3>
          <Link href="/garage" className="text-xs text-primary hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          {data.myCars.length === 0 ? (
            <div className="text-sm text-gray-500">
              <p>No cars yet.</p>
              <Link href="/garage" className="text-primary hover:underline">Add your first car →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.myCars.slice(0, 4).map((c) => (
                <Link key={c.id} href={`/cars/${c.id}`} className="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded-md transition-colors">
                  <div className="h-10 w-10 rounded-md bg-gray-100 overflow-hidden flex-shrink-0">
                    {c.mainImageUrl ? (
                      <img src={c.mainImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center"><Car className="h-5 w-5 text-gray-400" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.year} {c.make} {c.model}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Who to Follow */}
      {data.suggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="h-4 w-4" /> Who to Follow</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.suggestions.map((u) => (
                <div key={u.id} className="flex items-start gap-3">
                  <Link href={`/users/${u.id}`}>
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={u.avatarUrl || ""} />
                      <AvatarFallback>{u.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/users/${u.id}`} className="text-sm font-medium text-gray-900 hover:underline block truncate">
                      {u.displayName}
                    </Link>
                    <div className="text-xs text-gray-500 truncate">{u.reason}</div>
                  </div>
                  <Link href={`/users/${u.id}`}>
                    <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trending For Your Garage */}
      {data.trending.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Trending For Your Garage</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.trending.map((p) => (
                <Link key={p.id} href={`/posts/${p.id}`} className="block hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded-md transition-colors">
                  <div className="text-sm font-medium text-gray-900 line-clamp-2">{p.title}</div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                    {(p.make || p.model) && <span>{[p.make, p.model].filter(Boolean).join(" ")}</span>}
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{p.likeCount}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{p.commentCount}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Events Near You */}
      {data.events.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Calendar className="h-4 w-4" /> Events Near You</h3>
            <Link href="/events" className="text-xs text-primary hover:underline">See all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.events.map((e) => (
                <Link key={e.id} href={`/events`} className="block hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded-md transition-colors">
                  <div className="text-sm font-medium text-gray-900 line-clamp-2">{e.title}</div>
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                    <span>{new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{e.city || e.location}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import { useParams } from "wouter";
import { useState } from "react";
import { 
  useGetCar, useGetCarMods, useGetCarTimeline, useGetMe,
  useFollowCar, useUnfollowCar, getGetCarQueryKey, getGetCarModsQueryKey, getGetCarTimelineQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { MapPin, Wrench, Settings, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AddTimelineEntryDialog } from "@/components/AddTimelineEntryDialog";
import { TIMELINE_TYPES, TIMELINE_TYPE_MAP } from "@/data/timeline-types";
import { cn } from "@/lib/utils";
import { useLightbox } from "@/components/Lightbox";

export default function CarDetailPage() {
  const params = useParams();
  const carId = Number(params.carId);
  const queryClient = useQueryClient();

  const { data: car, isLoading: isCarLoading } = useGetCar(carId, { query: { enabled: !!carId, queryKey: getGetCarQueryKey(carId) } });
  const { data: mods, isLoading: isModsLoading } = useGetCarMods(carId, { query: { enabled: !!carId, queryKey: getGetCarModsQueryKey(carId) } });
  const { data: timeline, isLoading: isTimelineLoading } = useGetCarTimeline(carId, { query: { enabled: !!carId, queryKey: getGetCarTimelineQueryKey(carId) } });
  const { data: me } = useGetMe();

  const [typeFilter, setTypeFilter] = useState<string | "all">("all");

  const followCar = useFollowCar();
  const unfollowCar = useUnfollowCar();
  const lightbox = useLightbox();

  const isOwner = !!me && !!car?.owner && me.id === car.owner.id;
  const filteredTimeline = (timeline ?? []).filter(
    (e) => typeFilter === "all" || e.type === typeFilter,
  );
  const typesUsed = new Set((timeline ?? []).map((e) => e.type));

  const toggleFollow = () => {
    if (car?.iFollow) {
      unfollowCar.mutate({ carId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCarQueryKey(carId) })
      });
    } else {
      followCar.mutate({ carId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCarQueryKey(carId) })
      });
    }
  };

  if (isCarLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-96 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
          <div><Skeleton className="h-96 w-full" /></div>
        </div>
      </div>
    );
  }

  if (!car) return <div className="text-center py-20">Car not found</div>;

  return (
    <div className="space-y-8">
      {lightbox.element}
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[50vh] min-h-[400px] bg-gray-900">
        {car.mainImageUrl ? (
           <img
             src={car.mainImageUrl}
             alt={`${car.make} ${car.model}`}
             onClick={() => lightbox.open(car.mainImageUrl!, 0, `${car.year} ${car.make} ${car.model}`)}
             className="absolute inset-0 w-full h-full object-cover opacity-80 cursor-zoom-in"
           />
        ) : (
           <div className="absolute inset-0 flex items-center justify-center bg-gray-800"><CarIcon className="h-24 w-24 text-gray-600" /></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent pointer-events-none" />
        
        <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-12">
          <div className="flex flex-col sm:flex-row justify-between items-end gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border-none px-3 py-1">
                  {car.year}
                </Badge>
                {car.generation && (
                  <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border-none px-3 py-1">
                    {car.generation}
                  </Badge>
                )}
              </div>
              <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight drop-shadow-md">
                {car.make} <span className="text-red-500">{car.model}</span>
              </h1>
              {car.trim && <p className="text-xl text-gray-300 mt-2 font-medium">{car.trim}</p>}
            </div>
            
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
              <div className="text-center px-4 border-r border-white/20">
                <div className="text-2xl font-bold text-white">{car.followerCount || 0}</div>
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">Followers</div>
              </div>
              <Button 
                size="lg" 
                variant={car.iFollow ? "outline" : "default"}
                onClick={toggleFollow}
                disabled={followCar.isPending || unfollowCar.isPending}
                className={`rounded-full font-bold px-6 ${car.iFollow ? 'bg-white/10 text-white border-white/20 hover:bg-white/20' : ''}`}
              >
                {car.iFollow ? "Following" : "Follow"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="w-full space-y-8">
              {/* Ownership Story */}
              {car.ownershipStory && (
                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">The Story</h2>
                  <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 text-gray-700 leading-relaxed text-lg">
                    {car.ownershipStory}
                  </div>
                </section>
              )}

              {/* Timeline */}
              <section>
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold text-gray-900">Timeline</h2>
                  {isOwner && <AddTimelineEntryDialog carId={carId} />}
                </div>

                {/* Type filter chips */}
                {timeline && timeline.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    <button
                      type="button"
                      onClick={() => setTypeFilter("all")}
                      className={cn(
                        "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                        typeFilter === "all"
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                      )}
                    >
                      All
                    </button>
                    {TIMELINE_TYPES.filter(t => typesUsed.has(t.value)).map(t => {
                      const active = typeFilter === t.value;
                      const Icon = t.icon;
                      return (
                        <button
                          type="button"
                          key={t.value}
                          onClick={() => setTypeFilter(t.value)}
                          className={cn(
                            "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5",
                            active
                              ? "bg-gray-900 text-white border-gray-900"
                              : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <Icon className="h-3 w-3" /> {t.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                  {isTimelineLoading ? (
                    [1,2].map(i => <Skeleton key={i} className="h-40 w-full" />)
                  ) : filteredTimeline.length > 0 ? (
                    filteredTimeline.map((entry) => {
                      const meta = TIMELINE_TYPE_MAP[entry.type] ?? TIMELINE_TYPE_MAP.maintenance;
                      const Icon = meta.icon;
                      return (
                        <div key={entry.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className={cn("flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10", meta.colorClass)}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between mb-1">
                              <Badge variant="outline" className={cn("text-xs font-semibold uppercase tracking-wider", meta.badgeClass)}>{meta.label}</Badge>
                              <time className="text-sm text-gray-400">{formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}</time>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{entry.title}</h3>
                            {entry.body && <p className="text-gray-600 mb-3 text-sm whitespace-pre-wrap">{entry.body}</p>}
                            {entry.imageUrls && entry.imageUrls.length > 0 && (
                              <button
                                type="button"
                                onClick={() => lightbox.open(entry.imageUrls!, 0, entry.title)}
                                className="mt-3 rounded-xl overflow-hidden block w-full relative group/img focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                <img src={entry.imageUrls[0]} alt={entry.title} className="w-full h-48 object-cover cursor-zoom-in" />
                                {entry.imageUrls.length > 1 && (
                                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-md">
                                    +{entry.imageUrls.length - 1}
                                  </div>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : timeline && timeline.length > 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 z-10 relative">
                      <p className="text-gray-500">No entries match this filter.</p>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 z-10 relative">
                      <p className="text-gray-500">No timeline entries yet.</p>
                      {isOwner && (
                        <p className="text-sm text-gray-400 mt-2">Document maintenance, mods, track days, road trips, and more.</p>
                      )}
                    </div>
                  )}
                </div>
              </section>
          </div>
        </div>

        <div className="space-y-8">
          {/* Owner Info */}
          {car.owner && (
            <Card className="rounded-2xl border-gray-100 shadow-sm overflow-hidden">
              <div className="h-24 bg-gradient-to-r from-red-600 to-red-900" />
              <CardContent className="px-6 pb-6 pt-0 flex flex-col items-center text-center">
                <Avatar className="h-20 w-20 border-4 border-white -mt-10 shadow-sm">
                  <AvatarImage src={car.owner.avatarUrl || ''} />
                  <AvatarFallback>{car.owner.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="mt-3 w-full">
                  <h3 className="text-xl font-bold text-gray-900 truncate" data-testid="text-owner-name">{car.owner.displayName}</h3>
                  <Link href={`/users/${car.owner.id}`} className="text-sm text-gray-500 hover:text-primary inline-flex items-center mt-1">
                    @{car.owner.username} <ChevronRight className="h-3 w-3 ml-1" />
                  </Link>
                  {car.owner.location && (
                    <div className="flex items-center justify-center gap-1 text-sm text-gray-600 mt-4">
                      <MapPin className="h-4 w-4" /> {car.owner.location}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Specs */}
          <Card className="rounded-2xl border-gray-100 shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-400" /> Factory Specs
              </h3>
              <dl className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <dt className="text-gray-500 font-medium">Engine</dt>
                  <dd className="text-gray-900 font-semibold">{car.engine || 'Unknown'}</dd>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <dt className="text-gray-500 font-medium">Transmission</dt>
                  <dd className="text-gray-900 font-semibold">{car.transmission || 'Unknown'}</dd>
                </div>
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <dt className="text-gray-500 font-medium">Color</dt>
                  <dd className="text-gray-900 font-semibold">{car.color || 'Unknown'}</dd>
                </div>
                <div className="flex justify-between pb-2">
                  <dt className="text-gray-500 font-medium">Mileage</dt>
                  <dd className="text-gray-900 font-semibold">{car.mileage ? `${car.mileage.toLocaleString()} mi` : 'Unknown'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Mods */}
          <Card className="rounded-2xl border-gray-100 shadow-sm bg-gray-900 text-white">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Wrench className="h-5 w-5 text-red-500" /> Modifications
              </h3>
              {isModsLoading ? (
                <Skeleton className="h-32 w-full bg-gray-800" />
              ) : mods && mods.length > 0 ? (
                <div className="space-y-4">
                  {mods.map(mod => (
                    <div key={mod.id} className="bg-gray-800 rounded-xl p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-100">{mod.name}</p>
                          <p className="text-sm text-gray-400">{mod.brand}</p>
                        </div>
                        <Badge variant="secondary" className="bg-gray-700 text-gray-300 border-none">{mod.category}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Bone stock (for now)</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CarIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <path d="M9 17h6" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

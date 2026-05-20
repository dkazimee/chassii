import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useDiscoverGarages, useListCars } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, MapPin, Filter, Car as CarIcon, Map as MapIcon, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExplorePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [, setLocation] = useLocation();

  const { data: garages, isLoading: isGaragesLoading } = useDiscoverGarages({ limit: 6, sort: 'most_followed' });
  const { data: cars, isLoading: isCarsLoading } = useListCars({ limit: 12, sort: 'popular' });

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (!q) return;
    setLocation(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="space-y-12">
      <div className="text-center max-w-3xl mx-auto space-y-6">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">Explore the Community</h1>
        <p className="text-xl text-gray-500">Discover incredible builds, connect with enthusiasts, and get inspired.</p>

        <form onSubmit={submitSearch} className="flex max-w-xl mx-auto items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="search"
              placeholder="Search makes, models, users..."
              className="pl-10 h-12 text-lg rounded-full border-gray-300 focus:border-primary bg-white shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-explore-search"
            />
          </div>
          <Button type="submit" size="icon" className="h-12 w-12 rounded-full shrink-0" data-testid="button-explore-search">
            <Search className="h-5 w-5" />
          </Button>
        </form>
      </div>

      <section>
        <Link href="/map">
          <Card className="rounded-3xl overflow-hidden border-transparent shadow-sm hover:shadow-xl transition-all cursor-pointer group bg-gradient-to-br from-gray-900 via-gray-800 to-red-900 text-white">
            <CardContent className="p-8 flex items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
                  <MapIcon className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Browse on the Map</h2>
                  <p className="text-gray-300 mt-1">See cars, garages, and events near you on an interactive map.</p>
                </div>
              </div>
              <ArrowRight className="h-6 w-6 shrink-0 transition-transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Featured Garages</h2>
          <Button variant="ghost" className="text-primary font-medium hover:text-red-700">View All</Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isGaragesLoading ? (
            [1,2,3].map(i => <Skeleton key={i} className="h-64 w-full rounded-3xl" />)
          ) : garages?.map((garage: any) => (
            <Link key={garage.id} href={`/users/${garage.id}`} className="flex">
              <Card className="rounded-3xl border-gray-100 hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group flex flex-col w-full min-h-[260px]">
                <div className="h-20 bg-gray-900 relative flex-shrink-0">
                  {garage.coverUrl && <img src={garage.coverUrl} className="w-full h-full object-cover opacity-60" alt="Cover" />}
                </div>
                <CardContent className="p-5 pt-0 flex flex-col flex-1">
                  {/* Avatar row — sits below the cover, no absolute overlap */}
                  <div className="flex items-end gap-3 -mt-8 mb-3">
                    <Avatar className="h-16 w-16 border-4 border-white shadow-sm flex-shrink-0">
                      <AvatarImage src={garage.avatarUrl || ''} />
                      <AvatarFallback>{garage.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="pb-1 flex-1 min-w-0">
                      <h3 className="font-bold text-base text-gray-900 group-hover:text-primary transition-colors leading-tight truncate">{garage.displayName}</h3>
                      <p className="text-xs text-gray-500 truncate">@{garage.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span className="font-medium text-gray-700">{garage.carCount ?? garage.cars?.length ?? 0} cars</span>
                    <span>{garage.followerCount ?? 0} followers</span>
                  </div>

                  {/* Mini garage */}
                  {garage.cars && garage.cars.length > 0 && (
                    <div className="space-y-1.5 border-t border-gray-100 pt-3 flex-1">
                      {garage.cars.slice(0, 2).map((car: any) => (
                        <div key={car.id} className="flex items-center gap-2">
                          <div className="h-8 w-10 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                            {car.mainImageUrl ? (
                              <img src={car.mainImageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <CarIcon className="h-4 w-4 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-700 truncate">{car.year} {car.make} {car.model}</span>
                        </div>
                      ))}
                      {garage.cars.length > 2 && (
                        <p className="text-xs text-gray-400 pl-12">+{garage.cars.length - 2} more</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Trending Cars</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isCarsLoading ? (
            [1,2,3,4].map(i => <Skeleton key={i} className="h-72 w-full rounded-2xl" />)
          ) : cars?.map(car => (
            <Link key={car.id} href={`/cars/${car.id}`}>
              <Card className="overflow-hidden rounded-2xl hover:shadow-xl transition-all cursor-pointer group border-transparent shadow-sm hover:-translate-y-1 duration-300">
                <div className="h-48 relative bg-gray-100 overflow-hidden">
                  {car.mainImageUrl ? (
                    <img src={car.mainImageUrl} alt={`${car.make} ${car.model}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><CarIcon className="h-12 w-12 text-gray-300" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <CardContent className="p-4 bg-white border border-t-0 border-gray-100 rounded-b-2xl">
                  <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{car.year} {car.make} {car.model}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={car.owner?.avatarUrl || ''} />
                      <AvatarFallback>{car.owner?.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-gray-500 truncate">{car.owner?.displayName}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
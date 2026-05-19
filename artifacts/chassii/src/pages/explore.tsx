import { useState } from "react";
import { Link } from "wouter";
import { useDiscoverGarages, useListCars } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, MapPin, Filter, Car as CarIcon, Map as MapIcon, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExplorePage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: garages, isLoading: isGaragesLoading } = useDiscoverGarages({ limit: 6, sort: 'most_followed' });
  const { data: cars, isLoading: isCarsLoading } = useListCars({ limit: 12, sort: 'popular' });

  return (
    <div className="space-y-12">
      <div className="text-center max-w-3xl mx-auto space-y-6">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">Explore the Community</h1>
        <p className="text-xl text-gray-500">Discover incredible builds, connect with enthusiasts, and get inspired.</p>
        
        <div className="flex max-w-xl mx-auto items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input 
              type="search" 
              placeholder="Search makes, models, users..." 
              className="pl-10 h-12 text-lg rounded-full border-gray-300 focus:border-primary bg-white shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button size="icon" variant="outline" className="h-12 w-12 rounded-full shrink-0">
            <Filter className="h-5 w-5" />
          </Button>
        </div>
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
            [1,2,3].map(i => <Skeleton key={i} className="h-48 w-full rounded-3xl" />)
          ) : garages?.map(garage => (
            <Link key={garage.id} href={`/users/${garage.id}`}>
              <Card className="rounded-3xl border-gray-100 hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group">
                <div className="h-20 bg-gray-900 relative">
                   {garage.coverUrl && <img src={garage.coverUrl} className="w-full h-full object-cover opacity-60" alt="Cover" />}
                </div>
                <CardContent className="p-6 relative pt-0">
                  <Avatar className="h-16 w-16 border-4 border-white absolute -top-8 shadow-sm">
                    <AvatarImage src={garage.avatarUrl || ''} />
                    <AvatarFallback>{garage.displayName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="mt-10">
                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-primary transition-colors">{garage.displayName}</h3>
                    <p className="text-sm text-gray-500">@{garage.username}</p>
                    
                    <div className="flex items-center justify-between mt-4 text-sm">
                      <span className="font-medium text-gray-700">{garage.carCount} cars</span>
                      <span className="text-gray-500">{garage.followerCount} followers</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Trending Builds</h2>
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
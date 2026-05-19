import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Locate, Loader2 } from "lucide-react";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type MapUser = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  location: string | null;
  latitude: number;
  longitude: number;
  cars: Array<{ id: number; make: string; model: string; year: number | null; mainImageUrl: string | null }>;
};

function RecenterButton({ center }: { center: [number, number] | null }) {
  const map = useMap();
  if (!center) return null;
  return (
    <button
      onClick={() => map.flyTo(center, 11)}
      className="absolute top-4 right-4 z-[400] bg-white rounded-full shadow-md p-2 hover:bg-gray-50 border border-gray-200"
      data-testid="button-recenter-map"
      title="Center on me"
    >
      <Locate className="h-5 w-5 text-gray-700" />
    </button>
  );
}

export default function MapPage() {
  const [users, setUsers] = useState<MapUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myCenter, setMyCenter] = useState<[number, number] | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/users/map")
      .then(async r => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<MapUser[]>;
      })
      .then(data => { if (!cancelled) { setUsers(data); setIsLoading(false); } })
      .catch(err => { if (!cancelled) { setError(String(err.message || err)); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMyCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { maximumAge: 600_000, timeout: 5000 },
    );
  }, []);

  const initialCenter = useMemo<[number, number]>(() => {
    if (myCenter) return myCenter;
    if (users.length) return [users[0].latitude, users[0].longitude];
    return [39.8283, -98.5795]; // geographic center of contiguous US
  }, [myCenter, users]);

  useEffect(() => {
    if (myCenter && mapRef.current) {
      mapRef.current.flyTo(myCenter, 10);
    }
  }, [myCenter]);

  return (
    <div className="space-y-6" data-testid="page-map">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-2">
            <MapPin className="h-7 w-7 text-primary" />
            Enthusiasts Near You
          </h1>
          <p className="text-gray-500 mt-1">
            {isLoading ? "Loading..." : `${users.length} ${users.length === 1 ? "owner" : "owners"} on the map`}
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline" data-testid="button-update-location">
            <MapPin className="h-4 w-4 mr-2" />
            Update my location
          </Button>
        </Link>
      </div>

      <Card className="overflow-hidden p-0 relative" style={{ height: "70vh", minHeight: 480 }}>
        {error ? (
          <div className="flex items-center justify-center h-full text-red-600 p-6 text-center">
            Failed to load map: {error}
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading map...
          </div>
        ) : (
          <MapContainer
            center={initialCenter}
            zoom={myCenter ? 10 : 4}
            style={{ height: "100%", width: "100%" }}
            ref={(m) => { mapRef.current = m; }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RecenterButton center={myCenter} />
            {myCenter && (
              <Marker
                position={myCenter}
                icon={L.divIcon({
                  className: "",
                  html: `<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 2px #3b82f6;"></div>`,
                  iconSize: [18, 18],
                  iconAnchor: [9, 9],
                })}
              >
                <Popup>You are here (approximate)</Popup>
              </Marker>
            )}
            {users.map(u => (
              <Marker key={u.id} position={[u.latitude, u.longitude]}>
                <Popup>
                  <div className="min-w-[200px]" data-testid={`popup-user-${u.id}`}>
                    <Link href={`/users/${u.id}`} className="flex items-center gap-3 hover:opacity-80">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={u.avatarUrl ?? undefined} />
                        <AvatarFallback>{u.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-gray-900">{u.displayName}</div>
                        {u.location && <div className="text-xs text-gray-500">{u.location}</div>}
                      </div>
                    </Link>
                    {u.cars.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-2">
                        <div className="text-xs font-semibold text-gray-700">
                          {u.cars.length} {u.cars.length === 1 ? "car" : "cars"} in garage
                        </div>
                        {u.cars.slice(0, 4).map(c => (
                          <Link
                            key={c.id}
                            href={`/cars/${c.id}`}
                            className="flex items-center gap-2 hover:bg-gray-50 rounded p-1 -mx-1"
                          >
                            {c.mainImageUrl ? (
                              <img src={c.mainImageUrl} alt="" className="w-10 h-7 object-cover rounded" />
                            ) : (
                              <div className="w-10 h-7 bg-gray-100 rounded" />
                            )}
                            <span className="text-xs text-gray-700">
                              {c.year ? `${c.year} ` : ""}{c.make} {c.model}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </Card>

      <p className="text-xs text-gray-500 text-center">
        Locations are based on the city or neighborhood members enter — never an exact address.
      </p>
    </div>
  );
}

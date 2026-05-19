import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { format } from "date-fns";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type EventPin = {
  id: number;
  title: string;
  date: string;
  location: string;
  city: string | null;
  lat: number;
  lng: number;
  sourceUrl: string | null;
  type: string;
};

type Props = {
  events: EventPin[];
};

function getCenter(events: EventPin[]): [number, number] {
  if (!events.length) return [39.5, -98.35];
  const avgLat = events.reduce((s, e) => s + e.lat, 0) / events.length;
  const avgLng = events.reduce((s, e) => s + e.lng, 0) / events.length;
  return [avgLat, avgLng];
}

function getZoom(events: EventPin[]): number {
  if (events.length <= 1) return 11;
  const lats = events.map(e => e.lat);
  const lngs = events.map(e => e.lng);
  const latSpread = Math.max(...lats) - Math.min(...lats);
  const lngSpread = Math.max(...lngs) - Math.min(...lngs);
  const spread = Math.max(latSpread, lngSpread);
  if (spread < 0.1) return 12;
  if (spread < 0.5) return 10;
  if (spread < 2) return 8;
  if (spread < 10) return 6;
  return 4;
}

export default function EventsMap({ events }: Props) {
  const pinned = events.filter(e => e.lat != null && e.lng != null);

  if (!pinned.length) return null;

  const center = getCenter(pinned);
  const zoom = getZoom(pinned);

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm" style={{ height: 380 }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pinned.map(event => (
          <Marker key={event.id} position={[event.lat, event.lng]}>
            <Popup maxWidth={240}>
              <div className="space-y-1">
                <p className="font-bold text-gray-900 text-sm leading-tight">{event.title}</p>
                <p className="text-gray-500 text-xs">{format(new Date(event.date), "MMM d, yyyy · h:mm a")}</p>
                <p className="text-gray-500 text-xs">{event.location}</p>
                {event.sourceUrl ? (
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 text-xs text-blue-600 hover:underline font-medium"
                  >
                    View details →
                  </a>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

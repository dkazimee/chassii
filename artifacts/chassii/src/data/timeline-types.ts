import type { TimelineEntryType } from "@workspace/api-client-react";
import {
  Wrench, Settings, Flag, Map, Sparkles, AlertTriangle, Hammer, Camera,
  type LucideIcon,
} from "lucide-react";

export interface TimelineTypeMeta {
  value: TimelineEntryType;
  label: string;
  description: string;
  icon: LucideIcon;
  colorClass: string;
  badgeClass: string;
}

export const TIMELINE_TYPES: TimelineTypeMeta[] = [
  {
    value: "maintenance",
    label: "Maintenance",
    description: "Oil change, tires, fluids, brakes…",
    icon: Settings,
    colorClass: "bg-blue-500",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    value: "mod",
    label: "Mod Installed",
    description: "A new part or upgrade",
    icon: Wrench,
    colorClass: "bg-red-500",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
  },
  {
    value: "track_day",
    label: "Track Day",
    description: "Lap times, sessions, events",
    icon: Flag,
    colorClass: "bg-orange-500",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    value: "road_trip",
    label: "Road Trip",
    description: "A memorable drive or trip",
    icon: Map,
    colorClass: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    value: "detailing",
    label: "Detailing",
    description: "Wash, polish, ceramic, interior",
    icon: Sparkles,
    colorClass: "bg-purple-500",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    value: "problem_fix",
    label: "Repair / Fix",
    description: "Diagnosed and fixed an issue",
    icon: AlertTriangle,
    colorClass: "bg-amber-500",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    value: "build_update",
    label: "Build Update",
    description: "Progress on a project build",
    icon: Hammer,
    colorClass: "bg-rose-600",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    value: "photo",
    label: "Photo",
    description: "Just a moment worth sharing",
    icon: Camera,
    colorClass: "bg-pink-500",
    badgeClass: "bg-pink-50 text-pink-700 border-pink-200",
  },
];

export const TIMELINE_TYPE_MAP: Record<TimelineEntryType, TimelineTypeMeta> =
  TIMELINE_TYPES.reduce((acc, t) => {
    acc[t.value] = t;
    return acc;
  }, {} as Record<TimelineEntryType, TimelineTypeMeta>);

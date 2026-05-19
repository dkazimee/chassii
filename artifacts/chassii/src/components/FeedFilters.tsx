import { CarCombobox } from "@/components/CarCombobox";
import { CAR_MAKES, MODELS_BY_MAKE } from "@/data/car-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

export interface FeedFilterValues {
  make: string;
  model: string;
  location: string;
  category: string;
}

export const EMPTY_FILTERS: FeedFilterValues = {
  make: "",
  model: "",
  location: "",
  category: "",
};

const CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "general", label: "General" },
  { value: "build", label: "Build" },
  { value: "help", label: "Help / Advice" },
  { value: "showcase", label: "Showcase" },
  { value: "events", label: "Events" },
  { value: "for_sale", label: "For Sale" },
];

interface Props {
  value: FeedFilterValues;
  onChange: (next: FeedFilterValues) => void;
  resultCount?: number;
  totalCount?: number;
}

export function FeedFilters({ value, onChange, resultCount, totalCount }: Props) {
  const [expanded, setExpanded] = useState(false);
  const modelOptions = value.make ? MODELS_BY_MAKE[value.make] ?? [] : [];

  const activeCount =
    (value.make ? 1 : 0) +
    (value.model ? 1 : 0) +
    (value.location ? 1 : 0) +
    (value.category && value.category !== "all" ? 1 : 0);

  const clearAll = () => onChange(EMPTY_FILTERS);

  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 font-semibold text-gray-900">
          <Filter className="h-4 w-4" />
          Filter activity
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeCount}
            </Badge>
          )}
        </span>
        <span className="text-sm text-gray-500">
          {activeCount > 0 && typeof resultCount === "number" && typeof totalCount === "number"
            ? `${resultCount} of ${totalCount}`
            : expanded
              ? "Hide"
              : "Show"}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Make</label>
              <CarCombobox
                options={CAR_MAKES}
                value={value.make}
                onChange={(v) =>
                  onChange({
                    ...value,
                    make: v,
                    model: v !== value.make ? "" : value.model,
                  })
                }
                placeholder="Any make"
                searchPlaceholder="Search makes…"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Model</label>
              <CarCombobox
                options={modelOptions}
                value={value.model}
                onChange={(v) => onChange({ ...value, model: v })}
                placeholder={value.make ? "Any model" : "Pick a make first"}
                searchPlaceholder="Search models…"
                disabled={!value.make}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
              <Input
                value={value.location}
                onChange={(e) => onChange({ ...value, location: e.target.value })}
                placeholder="e.g. Austin, CA, Tokyo"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
              <Select
                value={value.category || "all"}
                onValueChange={(v) => onChange({ ...value, category: v === "all" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {activeCount > 0 && (
            <div className="flex items-center justify-between pt-1">
              <div className="flex flex-wrap gap-1.5">
                {value.make && (
                  <FilterChip label={value.make} onClear={() => onChange({ ...value, make: "", model: "" })} />
                )}
                {value.model && (
                  <FilterChip label={value.model} onClear={() => onChange({ ...value, model: "" })} />
                )}
                {value.location && (
                  <FilterChip label={value.location} onClear={() => onChange({ ...value, location: "" })} />
                )}
                {value.category && value.category !== "all" && (
                  <FilterChip
                    label={CATEGORY_OPTIONS.find((c) => c.value === value.category)?.label ?? value.category}
                    onClear={() => onChange({ ...value, category: "" })}
                  />
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-gray-600">
                Clear all
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full pl-2.5 pr-1 py-1">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 hover:bg-gray-200"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

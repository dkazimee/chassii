import { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CarComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
}

export function CarCombobox({
  options,
  value,
  onChange,
  placeholder = "Select or type…",
  searchPlaceholder = "Search…",
  emptyLabel = "No results — press Enter to use custom value",
  disabled = false,
}: CarComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const exactMatch = options.some(
    o => o.toLowerCase() === query.toLowerCase()
  );

  function select(val: string) {
    onChange(val);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && query.trim() && filtered.length === 0) {
      e.preventDefault();
      select(query.trim());
    }
  }

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false} onKeyDown={handleKeyDown}>
          <CommandInput
            ref={inputRef}
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-60">
            {query.trim() && !exactMatch && (
              <CommandGroup heading="Custom value">
                <CommandItem
                  value={`__custom__${query}`}
                  onSelect={() => select(query.trim())}
                  className="text-blue-600 font-medium"
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  Use &ldquo;{query.trim()}&rdquo;
                </CommandItem>
              </CommandGroup>
            )}

            {filtered.length === 0 && !query.trim() && (
              <CommandEmpty>{emptyLabel}</CommandEmpty>
            )}

            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map(option => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => select(option)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {query.trim() && filtered.length === 0 && (
              <CommandEmpty className="py-2 text-center text-sm text-muted-foreground">
                Press Enter to use &ldquo;{query.trim()}&rdquo;
              </CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

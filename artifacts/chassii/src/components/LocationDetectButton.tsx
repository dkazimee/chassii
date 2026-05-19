import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Locate } from "lucide-react";

export function LocationDetectButton({ onDetected }: { onDetected: (label: string) => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  async function handleClick() {
    if (!("geolocation" in navigator)) {
      toast({ title: "Geolocation not supported by this browser", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch("/api/reverse-geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
          });
          if (!r.ok) throw new Error(await r.text());
          const { label } = await r.json();
          if (label) onDetected(label);
          else toast({ title: "Could not determine your area", variant: "destructive" });
        } catch (err) {
          toast({ title: "Lookup failed", description: String(err), variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      },
      (err) => {
        setIsLoading(false);
        toast({ title: "Location permission denied", description: err.message, variant: "destructive" });
      },
      { timeout: 8000 },
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      onClick={handleClick}
      disabled={isLoading}
      data-testid="button-detect-location"
      title="Use my current location"
    >
      <Locate className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
    </Button>
  );
}

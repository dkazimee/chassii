import { useState } from "react";
import { useListEvents, useRsvpEvent } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SignedIn } from "@/components/auth/ConditionalAuth";

export default function EventsPage() {
  const { data: events, isLoading } = useListEvents({ limit: 20 });
  const rsvpEvent = useRsvpEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRsvp = (eventId: number) => {
    rsvpEvent.mutate({ eventId }, {
      onSuccess: (data) => {
        toast({ title: data.rsvpd ? "RSVP Confirmed" : "RSVP Cancelled" });
        queryClient.invalidateQueries({ queryKey: ["events"] });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Events & Meets</h1>
          <p className="text-gray-500 mt-2">Find local cars and coffee, track days, and cruises.</p>
        </div>
        <SignedIn>
          <Button size="lg" className="rounded-full">Create Event</Button>
        </SignedIn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          [1,2,3,4].map(i => <Skeleton key={i} className="h-64 w-full rounded-3xl" />)
        ) : events && events.length > 0 ? (
          events.map(event => (
            <Card key={event.id} className="rounded-3xl overflow-hidden border-gray-100 shadow-sm flex flex-col">
              <div className="h-48 bg-gray-900 relative">
                {event.imageUrl ? (
                  <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover opacity-80" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800">
                    <Calendar className="h-12 w-12 text-gray-600" />
                  </div>
                )}
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-sm font-bold text-gray-900">
                  {format(new Date(event.date), 'MMM d, h:mm a')}
                </div>
              </div>
              <CardContent className="p-6 flex-1 flex flex-col">
                <Badge variant="outline" className="w-fit mb-3">{event.type.replace('_', ' ')}</Badge>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h3>
                <div className="flex items-center gap-2 text-gray-500 mb-4 text-sm">
                  <MapPin className="h-4 w-4" /> {event.location}
                </div>
                {event.description && <p className="text-gray-600 line-clamp-2 mb-6 text-sm">{event.description}</p>}
                
                <div className="mt-auto flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <Users className="h-4 w-4" /> {event.rsvpCount || 0} Attending
                  </div>
                  <SignedIn>
                    <Button 
                      variant={event.hasRsvpd ? "outline" : "default"} 
                      onClick={() => handleRsvp(event.id)}
                      disabled={rsvpEvent.isPending}
                    >
                      {event.hasRsvpd ? "Going" : "RSVP"}
                    </Button>
                  </SignedIn>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-2 text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900">No events found</h3>
            <p className="mt-2 text-gray-500">Check back later or create your own event.</p>
          </div>
        )}
      </div>
    </div>
  );
}
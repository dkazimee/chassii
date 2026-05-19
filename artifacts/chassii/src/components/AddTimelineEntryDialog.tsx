import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useAddTimelineEntry,
  getGetCarTimelineQueryKey,
  getGetCarQueryKey,
} from "@workspace/api-client-react";
import type { TimelineEntryInputType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImageUploader } from "@/components/ImageUploader";
import { TIMELINE_TYPES } from "@/data/timeline-types";
import { cn } from "@/lib/utils";

const TYPE_VALUES = TIMELINE_TYPES.map(t => t.value) as [string, ...string[]];

const entrySchema = z.object({
  type: z.enum(TYPE_VALUES, { message: "Pick a type" }),
  title: z.string().min(1, "Required").max(120),
  body: z.string().max(2000).optional(),
  imageUrl: z.string().optional(),
});

type EntryValues = z.infer<typeof entrySchema>;

interface Props {
  carId: number;
}

export function AddTimelineEntryDialog({ carId }: Props) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addEntry = useAddTimelineEntry();

  const form = useForm<EntryValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: { type: "maintenance" as TimelineEntryInputType, title: "", body: "", imageUrl: "" },
  });

  const selectedType = form.watch("type");

  function onSubmit(values: EntryValues) {
    addEntry.mutate({
      carId,
      data: {
        type: values.type as TimelineEntryInputType,
        title: values.title,
        body: values.body || undefined,
        imageUrls: values.imageUrl ? [values.imageUrl] : [],
      },
    }, {
      onSuccess: () => {
        toast({ title: "Entry added to timeline" });
        queryClient.invalidateQueries({ queryKey: getGetCarTimelineQueryKey(carId) });
        queryClient.invalidateQueries({ queryKey: getGetCarQueryKey(carId) });
        form.reset({ type: "maintenance" as TimelineEntryInputType, title: "", body: "", imageUrl: "" });
        setOpen(false);
      },
      onError: () => toast({ title: "Failed to add entry", variant: "destructive" }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) form.reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full font-semibold">
          <Plus className="mr-1.5 h-4 w-4" /> Add Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a timeline entry</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>What kind of entry?</FormLabel>
                <FormControl>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TIMELINE_TYPES.map((t) => {
                      const Icon = t.icon;
                      const active = field.value === t.value;
                      return (
                        <button
                          type="button"
                          key={t.value}
                          onClick={() => field.onChange(t.value)}
                          className={cn(
                            "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
                            active
                              ? "border-gray-900 bg-gray-50 shadow-sm"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                          )}
                        >
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-white", t.colorClass)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-semibold text-gray-900">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </FormControl>
                {selectedType && (
                  <p className="text-xs text-gray-500 mt-1">
                    {TIMELINE_TYPES.find(t => t.value === selectedType)?.description}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Synthetic oil change at 42k miles" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="body" render={({ field }) => (
              <FormItem>
                <FormLabel>Details</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Add any notes, observations, or details (optional)…"
                    className="resize-none"
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="imageUrl" render={({ field }) => (
              <FormItem>
                <FormLabel>Photo (optional)</FormLabel>
                <FormControl>
                  <ImageUploader
                    shape="square"
                    aspectRatio="aspect-video"
                    placeholder="Attach a photo"
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addEntry.isPending}>
                {addEntry.isPending ? "Adding…" : "Add to Timeline"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

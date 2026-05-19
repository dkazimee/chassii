import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useUpdateCar, useDeleteCar,
  getGetUserCarsQueryKey, getGetCarQueryKey,
} from "@workspace/api-client-react";
import type { Car } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ImageUploader } from "@/components/ImageUploader";
import { CarCombobox } from "@/components/CarCombobox";
import { CAR_MAKES, MODELS_BY_MAKE, CAR_YEARS } from "@/data/car-data";

const editCarSchema = z.object({
  make: z.string().min(1, "Required"),
  model: z.string().min(1, "Required"),
  year: z.coerce.number().int().min(1900).max(new Date().getFullYear() + 2),
  generation: z.string().optional(),
  trim: z.string().optional(),
  color: z.string().optional(),
  mileage: z.union([z.coerce.number().int().min(0), z.null()]).optional(),
  transmission: z.string().optional(),
  engine: z.string().optional(),
  mainImageUrl: z.string().optional(),
  ownershipStory: z.string().optional(),
  isPublic: z.boolean(),
});

type EditCarValues = z.infer<typeof editCarSchema>;

interface Props {
  car: Car | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: number;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-2">{children}</div>;
}

export function EditCarDialog({ car, open, onOpenChange, userId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateCar = useUpdateCar();
  const deleteCar = useDeleteCar();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<EditCarValues>({
    resolver: zodResolver(editCarSchema),
    defaultValues: {
      make: "", model: "", year: new Date().getFullYear(),
      generation: "", trim: "", color: "",
      mileage: undefined, transmission: "", engine: "",
      mainImageUrl: "", ownershipStory: "", isPublic: true,
    },
  });

  useEffect(() => {
    if (car && open) {
      form.reset({
        make: car.make ?? "",
        model: car.model ?? "",
        year: car.year ?? new Date().getFullYear(),
        generation: car.generation ?? "",
        trim: car.trim ?? "",
        color: car.color ?? "",
        mileage: car.mileage ?? undefined,
        transmission: car.transmission ?? "",
        engine: car.engine ?? "",
        mainImageUrl: car.mainImageUrl ?? "",
        ownershipStory: car.ownershipStory ?? "",
        isPublic: car.isPublic ?? true,
      });
    }
  }, [car, open, form]);

  const selectedMake = useWatch({ control: form.control, name: "make" }) as string;
  const modelOptions = MODELS_BY_MAKE[selectedMake] ?? [];

  function onSubmit(values: EditCarValues) {
    if (!car) return;
    updateCar.mutate({ carId: car.id, data: values }, {
      onSuccess: () => {
        toast({ title: "Car updated" });
        queryClient.invalidateQueries({ queryKey: getGetCarQueryKey(car.id) });
        if (userId) queryClient.invalidateQueries({ queryKey: getGetUserCarsQueryKey(userId) });
        onOpenChange(false);
      },
      onError: () => toast({ title: "Failed to update car", variant: "destructive" }),
    });
  }

  function onDelete() {
    if (!car) return;
    deleteCar.mutate({ carId: car.id }, {
      onSuccess: () => {
        toast({ title: "Car removed from garage" });
        queryClient.removeQueries({ queryKey: getGetCarQueryKey(car.id) });
        if (userId) queryClient.invalidateQueries({ queryKey: getGetUserCarsQueryKey(userId) });
        setConfirmDelete(false);
        onOpenChange(false);
      },
      onError: () => toast({ title: "Failed to remove car", variant: "destructive" }),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit car</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pb-2">

            <FormField control={form.control} name="mainImageUrl" render={({ field }) => (
              <FormItem>
                <FormLabel>Car Photo</FormLabel>
                <FormControl>
                  <ImageUploader
                    shape="square"
                    aspectRatio="aspect-video"
                    cropAspect={16 / 9}
                    cropTitle="Crop car photo"
                    placeholder="Upload a photo of your car"
                    value={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )} />

            <SectionLabel>Basic Info</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="make" render={({ field }) => (
                <FormItem>
                  <FormLabel>Make <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <CarCombobox
                      options={CAR_MAKES}
                      value={field.value}
                      onChange={(val) => {
                        field.onChange(val);
                        if (val !== selectedMake) form.setValue("model", "");
                      }}
                      placeholder="Select make…"
                      searchPlaceholder="Search or type make…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="model" render={({ field }) => (
                <FormItem>
                  <FormLabel>Model <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <CarCombobox
                      options={modelOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={selectedMake ? "Select model…" : "Select make first"}
                      searchPlaceholder="Search or type model…"
                      disabled={!selectedMake}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="year" render={({ field }) => (
                <FormItem>
                  <FormLabel>Year <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <CarCombobox
                      options={CAR_YEARS}
                      value={field.value ? String(field.value) : ""}
                      onChange={(val) => field.onChange(Number(val))}
                      placeholder="Select year…"
                      searchPlaceholder="Search year…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="generation" render={({ field }) => (
                <FormItem>
                  <FormLabel>Generation</FormLabel>
                  <FormControl><Input placeholder="991.2" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="trim" render={({ field }) => (
                <FormItem>
                  <FormLabel>Trim</FormLabel>
                  <FormControl><Input placeholder="RS, Sport, Base…" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="color" render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl><Input placeholder="Guards Red" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <SectionLabel>Specs</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="engine" render={({ field }) => (
                <FormItem>
                  <FormLabel>Engine</FormLabel>
                  <FormControl><Input placeholder="4.0L Flat-6" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="transmission" render={({ field }) => (
                <FormItem>
                  <FormLabel>Transmission</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Manual">Manual</SelectItem>
                      <SelectItem value="Automatic">Automatic</SelectItem>
                      <SelectItem value="DCT">DCT / Dual-Clutch</SelectItem>
                      <SelectItem value="CVT">CVT</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="mileage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mileage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="42000"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <SectionLabel>Ownership Story</SectionLabel>
            <FormField control={form.control} name="ownershipStory" render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="How did you find it? What's the plan?"
                    className="resize-none"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="isPublic" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Public Visibility</FormLabel>
                  <p className="text-sm text-gray-500">Allow others to see this car on your profile.</p>
                </div>
              </FormItem>
            )} />

            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
              <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete car
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this car?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove this car along with its mods, timeline, and photos. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => { e.preventDefault(); onDelete(); }}
                      className="bg-red-600 hover:bg-red-700"
                      disabled={deleteCar.isPending}
                    >
                      {deleteCar.isPending ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={updateCar.isPending}>
                  {updateCar.isPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

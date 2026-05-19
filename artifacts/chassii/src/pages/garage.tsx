import { useState } from "react";
import { Link } from "wouter";
import { useGetMe, useGetUserCars, useCreateCar, useAddCarMod, getGetUserCarsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Settings, Eye, Lock, Car as CarIcon, X, Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { ImageUploader } from "@/components/ImageUploader";
import { CarCombobox } from "@/components/CarCombobox";
import { CAR_MAKES, MODELS_BY_MAKE, CAR_YEARS } from "@/data/car-data";
import { EditCarDialog } from "@/components/EditCarDialog";
import type { Car } from "@workspace/api-client-react";

const MOD_CATEGORIES = [
  "Engine", "Exhaust", "Intake", "Turbo / Supercharger",
  "Suspension", "Brakes", "Wheels & Tires",
  "Exterior", "Interior", "Lighting", "Electronics",
  "Transmission / Drivetrain", "Fuel System", "Cooling", "Other",
];

interface ModEntry {
  name: string;
  category: string;
  brand: string;
  notes: string;
}

const carFormSchema = z.object({
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.coerce.number().min(1900).max(new Date().getFullYear() + 1),
  generation: z.string().optional(),
  trim: z.string().optional(),
  color: z.string().optional(),
  mileage: z.coerce.number().min(0).optional(),
  transmission: z.string().optional(),
  engine: z.string().optional(),
  mainImageUrl: z.string().optional(),
  ownershipStory: z.string().optional(),
  isPublic: z.boolean().default(true),
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-2 mb-1">
      {children}
    </p>
  );
}

export default function GaragePage() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const { data: cars, isLoading: isCarsLoading } = useGetUserCars(user?.id ?? 0, {
    query: { enabled: !!user?.id, queryKey: getGetUserCarsQueryKey(user?.id ?? 0) },
  });

  const [isAddCarOpen, setIsAddCarOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<Car | null>(null);
  const [mods, setMods] = useState<ModEntry[]>([]);
  const [modDraft, setModDraft] = useState<ModEntry>({ name: "", category: "", brand: "", notes: "" });
  const [showModForm, setShowModForm] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCar = useCreateCar();
  const addCarMod = useAddCarMod();

  const form = useForm<z.infer<typeof carFormSchema>>({
    resolver: zodResolver(carFormSchema),
    defaultValues: {
      make: "", model: "", year: new Date().getFullYear(),
      generation: "", trim: "", color: "",
      mileage: undefined, transmission: "", engine: "",
      mainImageUrl: "", ownershipStory: "", isPublic: true,
    },
  });

  const selectedMake = useWatch({ control: form.control, name: "make" }) as string;
  const modelOptions = MODELS_BY_MAKE[selectedMake] ?? [];

  function addMod() {
    if (!modDraft.name.trim() || !modDraft.category) return;
    setMods(prev => [...prev, { ...modDraft }]);
    setModDraft({ name: "", category: "", brand: "", notes: "" });
    setShowModForm(false);
  }

  function removeMod(idx: number) {
    setMods(prev => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(values: z.infer<typeof carFormSchema>) {
    createCar.mutate({ data: values }, {
      onSuccess: async (car) => {
        if (mods.length > 0) {
          await Promise.all(
            mods.map(m =>
              addCarMod.mutateAsync({ carId: car.id, data: { name: m.name, category: m.category, brand: m.brand || undefined, notes: m.notes || undefined } })
            )
          );
        }
        toast({ title: "Car added to garage" });
        setIsAddCarOpen(false);
        form.reset();
        setMods([]);
        setModDraft({ name: "", category: "", brand: "", notes: "" });
        setShowModForm(false);
        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: getGetUserCarsQueryKey(user.id) });
        }
      },
      onError: () => {
        toast({ title: "Failed to add car", variant: "destructive" });
      },
    });
  }

  if (isUserLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Garage</h1>
          <p className="text-gray-500 mt-1">Manage your vehicles and their garage journeys</p>
        </div>

        <Dialog open={isAddCarOpen} onOpenChange={(open) => {
          setIsAddCarOpen(open);
          if (!open) { form.reset(); setMods([]); setModDraft({ name: "", category: "", brand: "", notes: "" }); setShowModForm(false); }
        }}>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-full font-bold">
              <Plus className="mr-2 h-5 w-5" /> Add Car
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add a new car</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pb-2">

                {/* Photo */}
                <FormField
                  control={form.control}
                  name="mainImageUrl"
                  render={({ field }) => (
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Basic identity */}
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
                            form.setValue("model", "");
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

                {/* Specs */}
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Manual">Manual</SelectItem>
                          <SelectItem value="Automatic">Automatic</SelectItem>
                          <SelectItem value="DCT">DCT / PDK</SelectItem>
                          <SelectItem value="CVT">CVT</SelectItem>
                          <SelectItem value="Sequential">Sequential</SelectItem>
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
                          min="0"
                          placeholder="e.g. 42000"
                          {...field}
                          value={field.value ?? ""}
                          onChange={e => field.onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Mods */}
                <SectionLabel>Modifications</SectionLabel>
                <div className="space-y-3">
                  {mods.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {mods.map((m, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="flex items-center gap-1.5 pr-1.5 text-sm py-1"
                        >
                          <Wrench className="h-3 w-3 text-gray-500 shrink-0" />
                          <span className="font-medium">{m.name}</span>
                          <span className="text-gray-400">· {m.category}</span>
                          {m.brand && <span className="text-gray-400">· {m.brand}</span>}
                          <button
                            type="button"
                            onClick={() => removeMod(i)}
                            className="ml-1 rounded-full hover:bg-gray-200 p-0.5"
                          >
                            <X className="h-3 w-3 text-gray-500" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {showModForm ? (
                    <div className="border rounded-xl p-4 space-y-3 bg-gray-50">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Mod Name <span className="text-red-500">*</span></label>
                          <Input
                            placeholder="Cold air intake"
                            value={modDraft.name}
                            onChange={e => setModDraft(d => ({ ...d, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Category <span className="text-red-500">*</span></label>
                          <Select value={modDraft.category} onValueChange={v => setModDraft(d => ({ ...d, category: v }))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select…" />
                            </SelectTrigger>
                            <SelectContent>
                              {MOD_CATEGORIES.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Brand</label>
                          <Input
                            placeholder="Mishimoto, AEM…"
                            value={modDraft.brand}
                            onChange={e => setModDraft(d => ({ ...d, brand: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-medium">Notes</label>
                          <Input
                            placeholder="e.g. Stage 2, dyno'd at 340 whp"
                            value={modDraft.notes}
                            onChange={e => setModDraft(d => ({ ...d, notes: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          onClick={addMod}
                          disabled={!modDraft.name.trim() || !modDraft.category}
                        >
                          Add Mod
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => { setShowModForm(false); setModDraft({ name: "", category: "", brand: "", notes: "" }); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setShowModForm(true)}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" /> Add a mod
                    </Button>
                  )}
                </div>

                {/* Story */}
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

                {/* Visibility */}
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

                <Button type="submit" className="w-full" disabled={createCar.isPending}>
                  {createCar.isPending ? "Adding your car…" : "Add Car to Garage"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isCarsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map(i => <Skeleton key={i} className="h-80 w-full rounded-2xl" />)}
        </div>
      ) : cars && cars.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cars.map((car) => (
            <Card key={car.id} className="overflow-hidden rounded-2xl hover:shadow-lg transition-all group">
              <div className="h-48 relative overflow-hidden bg-gray-100">
                {car.mainImageUrl ? (
                  <img
                    src={car.mainImageUrl}
                    alt={`${car.make} ${car.model}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <CarIcon className="h-12 w-12 text-gray-300" />
                  </div>
                )}
                <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5">
                  {car.isPublic
                    ? <><Eye className="h-3.5 w-3.5" /> Public</>
                    : <><Lock className="h-3.5 w-3.5" /> Private</>}
                </div>
              </div>
              <CardContent className="p-5">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {car.year} {car.make} {car.model}
                </h3>
                {(car.generation || car.trim) && (
                  <p className="text-gray-500 text-sm mb-1">
                    {[car.generation, car.trim].filter(Boolean).join(" · ")}
                  </p>
                )}
                {car.mileage != null && (
                  <p className="text-gray-400 text-xs mb-4">
                    {car.mileage.toLocaleString()} mi
                  </p>
                )}
                <div className="flex items-center gap-3 mt-4">
                  <Link href={`/cars/${car.id}`}>
                    <Button variant="outline" className="w-full rounded-full">View Journal</Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full shrink-0"
                    onClick={() => setEditingCar(car)}
                    aria-label="Edit car"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CarIcon className="h-10 w-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Your garage is empty</h3>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">
            Add your first car to start documenting its history, sharing mods, and connecting with other owners.
          </p>
        </div>
      )}

      <EditCarDialog
        car={editingCar}
        open={!!editingCar}
        onOpenChange={(open) => { if (!open) setEditingCar(null); }}
        userId={user?.id}
      />
    </div>
  );
}

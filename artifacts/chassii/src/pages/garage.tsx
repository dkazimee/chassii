import { useState } from "react";
import { Link } from "wouter";
import { useGetMe, useGetUserCars, useCreateCar, getGetUserCarsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Settings, Eye, Lock, Car as CarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { ImageUploader } from "@/components/ImageUploader";

const carFormSchema = z.object({
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.coerce.number().min(1900).max(new Date().getFullYear() + 1),
  generation: z.string().optional(),
  trim: z.string().optional(),
  color: z.string().optional(),
  mileage: z.coerce.number().optional(),
  transmission: z.string().optional(),
  engine: z.string().optional(),
  mainImageUrl: z.string().url().optional().or(z.literal("")),
  ownershipStory: z.string().optional(),
  isPublic: z.boolean().default(true),
});

export default function GaragePage() {
  const { data: user, isLoading: isUserLoading } = useGetMe();
  const { data: cars, isLoading: isCarsLoading } = useGetUserCars(user?.id ?? 0, { query: { enabled: !!user?.id, queryKey: getGetUserCarsQueryKey(user?.id ?? 0) } });
  
  const [isAddCarOpen, setIsAddCarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCar = useCreateCar();

  const form = useForm<z.infer<typeof carFormSchema>>({
    resolver: zodResolver(carFormSchema),
    defaultValues: {
      make: "",
      model: "",
      year: new Date().getFullYear(),
      generation: "",
      trim: "",
      color: "",
      mileage: 0,
      transmission: "",
      engine: "",
      mainImageUrl: "",
      ownershipStory: "",
      isPublic: true,
    },
  });

  function onSubmit(values: z.infer<typeof carFormSchema>) {
    createCar.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Car added to garage" });
        setIsAddCarOpen(false);
        form.reset();
        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: getGetUserCarsQueryKey(user.id) });
        }
      },
      onError: (error) => {
        toast({ title: "Failed to add car", variant: "destructive" });
      }
    });
  }

  if (isUserLoading) return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Garage</h1>
          <p className="text-gray-500 mt-1">Manage your vehicles and build journals</p>
        </div>
        <Dialog open={isAddCarOpen} onOpenChange={setIsAddCarOpen}>
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="make"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Make</FormLabel>
                        <FormControl><Input placeholder="Porsche" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl><Input placeholder="911 GT3" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="generation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Generation (optional)</FormLabel>
                        <FormControl><Input placeholder="991.2" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="mainImageUrl"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Car Photo</FormLabel>
                        <FormControl>
                          <ImageUploader
                            shape="square"
                            aspectRatio="aspect-video"
                            placeholder="Upload a photo of your car"
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="ownershipStory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ownership Story</FormLabel>
                      <FormControl>
                        <Textarea placeholder="How did you find it? What's the plan?" className="resize-none" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Public Visibility</FormLabel>
                        <p className="text-sm text-gray-500">Allow others to see this car on your profile.</p>
                      </div>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createCar.isPending}>
                  {createCar.isPending ? "Adding..." : "Add Car to Garage"}
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
                  <img src={car.mainImageUrl} alt={`${car.make} ${car.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <CarIcon className="h-12 w-12 text-gray-300" />
                  </div>
                )}
                <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5">
                  {car.isPublic ? <><Eye className="h-3.5 w-3.5" /> Public</> : <><Lock className="h-3.5 w-3.5" /> Private</>}
                </div>
              </div>
              <CardContent className="p-5">
                <h3 className="text-xl font-bold text-gray-900 mb-1">{car.year} {car.make} {car.model}</h3>
                {car.generation && <p className="text-gray-500 text-sm mb-4">{car.generation}</p>}
                
                <div className="flex items-center gap-3 mt-6">
                  <Link href={`/cars/${car.id}`}>
                    <Button variant="outline" className="w-full rounded-full">View Journal</Button>
                  </Link>
                  <Button variant="ghost" size="icon" className="rounded-full shrink-0"><Settings className="h-4 w-4" /></Button>
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
          <p className="mt-2 text-gray-500 max-w-md mx-auto">Add your first car to start documenting its history, sharing mods, and connecting with other owners.</p>
        </div>
      )}
    </div>
  );
}
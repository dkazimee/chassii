import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useClerk } from "@clerk/react";
import { ImageUploader } from "@/components/ImageUploader";
import { Locate, MapPin } from "lucide-react";
import { useState } from "react";

const profileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  bio: z.string().optional(),
  location: z.string().optional(),
  avatarUrl: z.string().optional(),
  coverUrl: z.string().optional(),
});

function LocationDetectButton({ onDetected }: { onDetected: (label: string) => void }) {
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

export default function SettingsPage() {
  const { data: user, isLoading } = useGetMe();
  const updateMe = useUpdateMe();
  const { toast } = useToast();
  const { signOut } = useClerk();

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: "",
      bio: "",
      location: "",
      avatarUrl: "",
      coverUrl: "",
    },
  });

  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (user && initializedForId.current !== user.id) {
      initializedForId.current = user.id;
      form.reset({
        displayName: user.displayName || "",
        bio: user.bio || "",
        location: user.location || "",
        avatarUrl: user.avatarUrl || "",
        coverUrl: user.coverUrl || "",
      });
    }
  }, [user, form]);

  function onSubmit(values: z.infer<typeof profileSchema>) {
    updateMe.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Profile updated successfully" });
      },
      onError: () => {
        toast({ title: "Failed to update profile", variant: "destructive" });
      }
    });
  }

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-2">Manage your profile and account preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Public Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              <div className="flex items-end gap-6">
                <FormField
                  control={form.control}
                  name="avatarUrl"
                  render={({ field }) => (
                    <FormItem className="shrink-0">
                      <FormLabel>Profile Photo</FormLabel>
                      <FormControl>
                        <ImageUploader
                          shape="circle"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Display Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="coverUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cover Photo</FormLabel>
                    <FormControl>
                      <ImageUploader
                        shape="square"
                        aspectRatio="aspect-[4/1]"
                        cropAspect={4}
                        cropTitle="Crop cover photo"
                        placeholder="Upload a cover photo (banner)"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl><Textarea className="resize-none" rows={4} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" />
                      Location
                    </FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Neighborhood, City, or City, State"
                          {...field}
                          data-testid="input-location"
                        />
                        <LocationDetectButton onDetected={(label) => form.setValue("location", label, { shouldDirty: true })} />
                      </div>
                    </FormControl>
                    <p className="text-xs text-gray-500 mt-1.5">
                      Used to place you on the community map within a <strong>~10 mile vicinity</strong>. Your exact address is never stored or shown — even if you enter a full street address, we round your spot to a wide area so other members only see your general region.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <Button type="submit" disabled={updateMe.isPending}>
                  {updateMe.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="border-red-100">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => signOut({ redirectUrl: "/" })}>
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

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

const profileSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  bio: z.string().optional(),
  location: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  coverUrl: z.string().url().optional().or(z.literal("")),
});

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
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
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
                    <FormLabel>Location</FormLabel>
                    <FormControl><Input placeholder="City, State" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="avatarUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Avatar Image URL</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="coverUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cover Image URL</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
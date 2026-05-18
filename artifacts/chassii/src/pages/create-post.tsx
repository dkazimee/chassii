import { useLocation } from "wouter";
import { useCreatePost } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Content is required"),
  category: z.enum(["general", "question", "build_update", "guide", "review", "problem", "event", "marketplace"]),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().optional().or(z.literal("")),
  location: z.string().optional(),
});

export default function CreatePostPage() {
  const [, setLocation] = useLocation();
  const createPost = useCreatePost();

  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: "",
      body: "",
      category: "general",
      make: "",
      model: "",
      year: "",
      location: "",
    },
  });

  function onSubmit(values: z.infer<typeof postSchema>) {
    createPost.mutate({ data: {
      ...values,
      year: values.year ? Number(values.year) : undefined,
    } as any }, {
      onSuccess: (post) => {
        setLocation(`/posts/${post.id}`);
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">Start a Discussion</h1>
        <p className="text-gray-500 mt-2">Ask a question, share a build update, or talk about cars.</p>
      </div>

      <Card className="rounded-3xl border-gray-100 shadow-sm">
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input placeholder="What's on your mind?" className="text-lg py-6" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="question">Question / Help</SelectItem>
                          <SelectItem value="build_update">Build Update</SelectItem>
                          <SelectItem value="guide">Guide / DIY</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="marketplace">Marketplace</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (Optional)</FormLabel>
                      <FormControl><Input placeholder="e.g. Los Angeles, CA" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl space-y-4">
                <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Vehicle Details (Optional)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Year</FormLabel>
                        <FormControl><Input type="number" placeholder="2023" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="make"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Make</FormLabel>
                        <FormControl><Input placeholder="BMW" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl><Input placeholder="M3" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Share the details..." className="min-h-[200px] resize-y text-base" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => setLocation("/discussions")}>Cancel</Button>
                <Button type="submit" disabled={createPost.isPending}>
                  {createPost.isPending ? "Posting..." : "Post Discussion"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListPosts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, PlusCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { PostActions } from "@/components/PostActions";

export default function DiscussionsPage() {
  const [, setLocation] = useLocation();
  const [sort, setSort] = useState<'newest' | 'popular'>('popular');
  
  const { data: posts, isLoading } = useListPosts({ sort, limit: 20 });

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Discussions</h1>
          <p className="text-gray-500 mt-2 text-lg">Talk shop, troubleshoot, and share knowledge.</p>
        </div>
        <Button size="lg" className="rounded-full font-bold px-6" onClick={() => setLocation("/create-post")}>
          <PlusCircle className="mr-2 h-5 w-5" /> New Discussion
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <Tabs value={sort} onValueChange={(v) => setSort(v as any)} className="w-full md:w-auto">
          <TabsList className="bg-gray-100 rounded-full p-1 h-12">
            <TabsTrigger value="popular" className="rounded-full px-6 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Popular</TabsTrigger>
            <TabsTrigger value="newest" className="rounded-full px-6 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Newest</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search discussions..." className="pl-10 rounded-full bg-white border-gray-200" />
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          [1,2,3,4].map(i => (
            <Card key={i} className="rounded-2xl border-gray-100 shadow-sm"><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))
        ) : posts && posts.length > 0 ? (
          posts.map(post => (
            <Card key={post.id} className="rounded-2xl border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all group">
              <CardContent className="p-6 md:p-8">
                <Link href={`/posts/${post.id}`} className="block cursor-pointer">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant="secondary" className="bg-red-50 text-primary hover:bg-red-100 border-none font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5">
                      {post.category.replace('_', ' ')}
                    </Badge>
                    {post.make && <Badge variant="outline" className="text-xs text-gray-500 border-gray-200">{post.make}</Badge>}
                    <span className="text-sm text-gray-400 ml-auto whitespace-nowrap">
                      {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors mb-2 truncate">
                    {post.title}
                  </h3>

                  {post.body && <p className="text-gray-600 line-clamp-2 mb-4 text-sm">{post.body}</p>}
                </Link>

                <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-100">
                  <Link href={`/users/${post.author?.id}`} className="flex items-center gap-2 hover:opacity-80">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={post.author?.avatarUrl || ''} />
                      <AvatarFallback>{post.author?.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-gray-700 text-sm">{post.author?.displayName}</span>
                  </Link>
                  <PostActions
                    postId={post.id}
                    likeCount={post.likeCount || 0}
                    commentCount={post.commentCount || 0}
                    isLiked={!!post.isLiked}
                    size="sm"
                  />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-300">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900">No discussions found</h3>
            <p className="mt-2 text-gray-500">Be the first to start a conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
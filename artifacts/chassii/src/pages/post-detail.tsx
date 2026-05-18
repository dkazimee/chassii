import { useState } from "react";
import { useParams } from "wouter";
import { 
  useGetPost, 
  useGetPostComments, 
  useLikePost, 
  useUnlikePost, 
  useCreateComment,
  getGetPostQueryKey,
  getGetPostCommentsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, MessageSquare, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function PostDetailPage() {
  const params = useParams();
  const postId = Number(params.postId);
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState("");

  const { data: post, isLoading: isPostLoading } = useGetPost(postId, { query: { enabled: !!postId, queryKey: getGetPostQueryKey(postId) } });
  const { data: comments, isLoading: isCommentsLoading } = useGetPostComments(postId, { query: { enabled: !!postId, queryKey: getGetPostCommentsQueryKey(postId) } });

  const likePost = useLikePost();
  const unlikePost = useUnlikePost();
  const createComment = useCreateComment();

  const handleLike = () => {
    if (post?.isLiked) {
      unlikePost.mutate({ postId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) })
      });
    } else {
      likePost.mutate({ postId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) })
      });
    }
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    createComment.mutate({ postId, data: { body: commentBody } }, {
      onSuccess: () => {
        setCommentBody("");
        queryClient.invalidateQueries({ queryKey: getGetPostCommentsQueryKey(postId) });
        queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
      }
    });
  };

  if (isPostLoading) return <div className="max-w-4xl mx-auto space-y-4"><Skeleton className="h-64 w-full" /></div>;
  if (!post) return <div className="text-center py-20">Post not found</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Card className="rounded-3xl border-gray-100 shadow-sm">
        <CardContent className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-12 w-12">
              <AvatarImage src={post.author?.avatarUrl || ''} />
              <AvatarFallback>{post.author?.displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-bold text-gray-900">{post.author?.displayName}</div>
              <div className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </div>
            </div>
            <div className="ml-auto">
              <span className="bg-red-50 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                {post.category.replace('_', ' ')}
              </span>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">{post.title}</h1>
          {post.body && <div className="text-lg text-gray-700 leading-relaxed mb-6 whitespace-pre-wrap">{post.body}</div>}

          {(post.make || post.location) && (
            <div className="flex flex-wrap gap-4 mb-6 text-sm text-gray-500 bg-gray-50 p-4 rounded-xl">
              {post.make && <div><strong>Subject:</strong> {post.year} {post.make} {post.model}</div>}
              {post.location && <div className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {post.location}</div>}
            </div>
          )}

          <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
            <Button 
              variant={post.isLiked ? "default" : "ghost"} 
              size="sm" 
              onClick={handleLike}
              disabled={likePost.isPending || unlikePost.isPending}
              className={post.isLiked ? "" : "text-gray-500"}
            >
              <ThumbsUp className="mr-2 h-4 w-4" />
              {post.likeCount || 0} Likes
            </Button>
            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
              <MessageSquare className="h-4 w-4" />
              {post.commentCount || 0} Replies
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-gray-900">Replies</h3>
        
        <form onSubmit={handleComment} className="flex gap-4 items-start">
          <Avatar className="h-10 w-10 mt-1 shrink-0">
            <AvatarFallback>Me</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea 
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a reply..." 
              className="resize-none rounded-xl"
              rows={3}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={createComment.isPending || !commentBody.trim()}>
                {createComment.isPending ? "Posting..." : "Post Reply"}
              </Button>
            </div>
          </div>
        </form>

        <div className="space-y-4">
          {isCommentsLoading ? (
             <Skeleton className="h-32 w-full" />
          ) : comments && comments.length > 0 ? (
            comments.map(comment => (
              <Card key={comment.id} className="rounded-2xl border-gray-100 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={comment.author?.avatarUrl || ''} />
                      <AvatarFallback>{comment.author?.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-gray-900">{comment.author?.displayName}</div>
                        <div className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="text-gray-700 whitespace-pre-wrap">{comment.body}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">No replies yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
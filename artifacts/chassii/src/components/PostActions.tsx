import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useLikePost,
  useUnlikePost,
  getListPostsQueryKey,
  getGetPostQueryKey,
  getGetFeedQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Props = {
  postId: number;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  size?: "sm" | "md";
  className?: string;
};

export function PostActions({ postId, likeCount, commentCount, isLiked, size = "md", className }: Props) {
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);

  const liked = optimisticLiked ?? isLiked;
  const count = optimisticCount ?? likeCount;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
    queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });
  };

  const clearOptimistic = () => {
    setOptimisticLiked(null);
    setOptimisticCount(null);
  };

  const likeMutation = useLikePost({
    mutation: {
      onSuccess: () => invalidateAll(),
      onError: () => toast({ title: "Couldn't like post", variant: "destructive" }),
      onSettled: clearOptimistic,
    },
  });

  const unlikeMutation = useUnlikePost({
    mutation: {
      onSuccess: () => invalidateAll(),
      onError: () => toast({ title: "Couldn't unlike post", variant: "destructive" }),
      onSettled: clearOptimistic,
    },
  });

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isSignedIn) {
      toast({ title: "Sign in to like posts" });
      return;
    }
    if (liked) {
      setOptimisticLiked(false);
      setOptimisticCount(Math.max(0, count - 1));
      unlikeMutation.mutate({ postId });
    } else {
      setOptimisticLiked(true);
      setOptimisticCount(count + 1);
      likeMutation.mutate({ postId });
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLocation(`/posts/${postId}`);
  };

  const btnSize = size === "sm" ? "sm" : "default";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant={liked ? "default" : "ghost"}
        size={btnSize}
        onClick={handleLike}
        disabled={likeMutation.isPending || unlikeMutation.isPending}
        className={cn(
          "rounded-full font-semibold gap-2",
          liked ? "" : "text-gray-600 hover:text-primary hover:bg-red-50",
        )}
        aria-pressed={liked}
        aria-label={liked ? "Unlike post" : "Like post"}
        data-testid={`button-like-post-${postId}`}
      >
        <ThumbsUp className={cn(iconSize, liked && "fill-current")} />
        <span>{count}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={btnSize}
        onClick={handleComment}
        className="rounded-full font-semibold gap-2 text-gray-600 hover:text-primary hover:bg-red-50"
        aria-label="View comments"
        data-testid={`button-comment-post-${postId}`}
      >
        <MessageSquare className={iconSize} />
        <span>{commentCount}</span>
      </Button>
    </div>
  );
}

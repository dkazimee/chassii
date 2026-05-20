import { useEffect } from "react";
import { Link } from "wouter";
import { useGetNotifications, getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { Bell, Heart, MessageSquare, UserPlus, Car, Calendar, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

function notifIcon(type: string) {
  switch (type) {
    case "follow": return <UserPlus className="h-4 w-4 text-blue-500" />;
    case "like": return <Heart className="h-4 w-4 text-red-500" />;
    case "comment": return <MessageSquare className="h-4 w-4 text-green-500" />;
    case "car_follow": return <Car className="h-4 w-4 text-orange-500" />;
    case "event_rsvp": return <Calendar className="h-4 w-4 text-purple-500" />;
    case "mention": return <Star className="h-4 w-4 text-yellow-500" />;
    default: return <Bell className="h-4 w-4 text-gray-400" />;
  }
}

function notifLink(n: { type: string; postId?: number | null; carId?: number | null }) {
  if (n.postId) return `/posts/${n.postId}`;
  if (n.carId) return `/cars/${n.carId}`;
  return null;
}

export default function NotificationsPage() {
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useGetNotifications(
    { limit: 50 },
    { query: { enabled: !!isSignedIn, queryKey: getGetNotificationsQueryKey({ limit: 50 }) } }
  );

  useEffect(() => {
    if (!isSignedIn || !notifications?.length) return;
    const hasUnread = notifications.some(n => !n.isRead);
    if (!hasUnread) return;
    fetch("/api/notifications/read-all", { method: "POST", credentials: "include" })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey({ limit: 5 }) });
        queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey({ limit: 50 }) });
      })
      .catch(() => {});
  }, [isSignedIn, notifications, queryClient]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-gray-100">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : !notifications?.length ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Bell className="h-8 w-8 text-gray-300" />
          </div>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">No notifications yet</h2>
          <p className="text-sm text-gray-400">When someone follows you, likes your post, or comments, it'll show up here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const link = notifLink(n);
            const content = (
              <div className={`flex items-start gap-4 p-4 rounded-2xl border transition-colors ${
                !n.isRead ? "bg-primary/5 border-primary/20" : "bg-white border-gray-100"
              }`}>
                <div className="relative flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                    {notifIcon(n.type)}
                  </div>
                  {!n.isRead && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 leading-snug">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );

            return link ? (
              <Link key={n.id} href={link} className="block hover:opacity-90 transition-opacity">
                {content}
              </Link>
            ) : (
              <div key={n.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

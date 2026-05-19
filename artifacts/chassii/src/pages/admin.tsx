import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Shield, Users, FileText, Calendar, Trash2, Ban, CheckCircle,
  MapPin, Car, MessageSquare, AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  location: string | null;
  isAdmin: boolean;
  isBlocked: boolean;
  carCount: number;
  postCount: number;
  createdAt: string;
}

interface AdminPost {
  id: number;
  title: string;
  body: string;
  category: string;
  createdAt: string;
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface AdminEvent {
  id: number;
  title: string;
  description: string | null;
  type: string;
  date: string;
  location: string;
  createdAt: string;
  userId: number;
  username: string;
  displayName: string;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [activeTab, setActiveTab] = useState("users");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    apiFetch("/api/admin/me")
      .then(d => setIsAdmin(d.isAdmin))
      .catch(() => setIsAdmin(false));
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    apiFetch("/api/admin/users")
      .then(setUsers)
      .finally(() => setLoadingUsers(false));
  }, [isAdmin]);

  const loadPosts = () => {
    if (posts.length) return;
    setLoadingPosts(true);
    apiFetch("/api/admin/posts")
      .then(setPosts)
      .finally(() => setLoadingPosts(false));
  };

  const loadEvents = () => {
    if (events.length) return;
    setLoadingEvents(true);
    apiFetch("/api/admin/events")
      .then(setEvents)
      .finally(() => setLoadingEvents(false));
  };

  const handleBlockUser = async (userId: number, blocked: boolean) => {
    await apiFetch(`/api/admin/users/${userId}/block`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isBlocked: blocked } : u));
  };

  const handleDeleteUser = async (userId: number) => {
    await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleDeletePost = async (postId: number) => {
    await apiFetch(`/api/admin/posts/${postId}`, { method: "DELETE" });
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleDeleteEvent = async (eventId: number) => {
    await apiFetch(`/api/admin/events/${eventId}`, { method: "DELETE" });
    setEvents(prev => prev.filter(e => e.id !== eventId));
  };

  if (!isLoaded || isAdmin === null) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!isSignedIn || isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-6">You don't have permission to view this page.</p>
        <Button onClick={() => setLocation("/feed")}>Go Home</Button>
      </div>
    );
  }

  const blockedCount = users.filter(u => u.isBlocked).length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gray-900 rounded-3xl p-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-red-600 flex items-center justify-center">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white">Admin Panel</h1>
            <p className="text-gray-400 mt-1">CHASSII platform management</p>
          </div>
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-white">{users.length}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Users</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{posts.length || "—"}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Posts</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-400">{blockedCount}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Blocked</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v);
        if (v === "posts") loadPosts();
        if (v === "events") loadEvents();
      }}>
        <TabsList className="w-full justify-start border-b border-gray-200 rounded-none bg-transparent p-0 mb-6 h-auto">
          <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 pb-3 pt-1 text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" /> Users
            <span className="ml-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{users.length}</span>
          </TabsTrigger>
          <TabsTrigger value="posts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 pb-3 pt-1 text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" /> Posts
          </TabsTrigger>
          <TabsTrigger value="events" className="rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 pb-3 pt-1 text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Events
          </TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users" className="mt-0 space-y-3">
          {loadingUsers ? (
            [1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
          ) : (
            users.map(user => (
              <Card key={user.id} className={`rounded-2xl border ${user.isBlocked ? 'border-red-200 bg-red-50' : 'border-gray-100'} shadow-sm`}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={user.avatarUrl || ''} />
                      <AvatarFallback className="text-lg">{user.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{user.displayName}</span>
                        <span className="text-gray-400 text-sm">@{user.username}</span>
                        {user.isAdmin && <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Admin</Badge>}
                        {user.isBlocked && <Badge variant="destructive" className="text-xs">Blocked</Badge>}
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                        {user.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{user.location}</span>}
                        <span className="flex items-center gap-1"><Car className="h-3 w-3" />{user.carCount} cars</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{user.postCount} posts</span>
                        <span>Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>

                  {!user.isAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`rounded-full text-xs ${user.isBlocked ? 'border-green-300 text-green-700 hover:bg-green-50' : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'}`}
                        onClick={() => handleBlockUser(user.id, !user.isBlocked)}
                      >
                        {user.isBlocked ? <><CheckCircle className="h-3 w-3 mr-1" /> Unblock</> : <><Ban className="h-3 w-3 mr-1" /> Block</>}
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="rounded-full text-xs border-red-200 text-red-600 hover:bg-red-50">
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete @{user.username}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes the user, all their cars, posts, and events. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              Delete Permanently
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* POSTS TAB */}
        <TabsContent value="posts" className="mt-0 space-y-3">
          {loadingPosts ? (
            [1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
          ) : posts.length === 0 ? (
            <div className="text-center py-20 text-gray-500">No posts found.</div>
          ) : (
            posts.map(post => (
              <Card key={post.id} className="rounded-2xl border-gray-100 shadow-sm">
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                      <AvatarImage src={post.avatarUrl || ''} />
                      <AvatarFallback>{post.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 truncate">{post.title}</div>
                      <div className="text-sm text-gray-500 line-clamp-1">{post.body}</div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-400">
                        <span>by @{post.username}</span>
                        <Badge variant="outline" className="text-xs py-0">{post.category}</Badge>
                        <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-full text-xs border-red-200 text-red-600 hover:bg-red-50 shrink-0">
                        <Trash2 className="h-3 w-3 mr-1" /> Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove this post?</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{post.title}" will be permanently deleted along with all its comments and likes.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => handleDeletePost(post.id)}
                        >
                          Remove Post
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* EVENTS TAB */}
        <TabsContent value="events" className="mt-0 space-y-3">
          {loadingEvents ? (
            [1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
          ) : events.length === 0 ? (
            <div className="text-center py-20 text-gray-500">No events found.</div>
          ) : (
            events.map(event => (
              <Card key={event.id} className="rounded-2xl border-gray-100 shadow-sm">
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900">{event.title}</div>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(event.date).toLocaleDateString()}</span>
                      <span>by @{event.username}</span>
                      <Badge variant="outline" className="text-xs py-0">{event.type}</Badge>
                    </div>
                    {event.description && <p className="text-sm text-gray-500 mt-1 line-clamp-1">{event.description}</p>}
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-full text-xs border-red-200 text-red-600 hover:bg-red-50 shrink-0">
                        <Trash2 className="h-3 w-3 mr-1" /> Remove
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove this event?</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{event.title}" will be permanently removed from the platform.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => handleDeleteEvent(event.id)}
                        >
                          Remove Event
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

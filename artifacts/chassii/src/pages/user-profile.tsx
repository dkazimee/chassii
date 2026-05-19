import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useGetUser, useGetUserCars, useGetUserPosts, useGetMe, useFollowUser, useUnfollowUser, getGetUserQueryKey, getGetUserCarsQueryKey, getGetUserPostsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users, Car, MessageSquare, Shield, Camera, Pencil } from "lucide-react";

export default function UserProfilePage() {
  const params = useParams();
  const userId = Number(params.userId);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();

  const [adminStatus, setAdminStatus] = useState<{ isAdmin: boolean } | null>(null);
  const [noAdminYet, setNoAdminYet] = useState(false);
  const [claimingAdmin, setClaimingAdmin] = useState(false);

  const { data: user, isLoading: isUserLoading } = useGetUser(userId, { query: { enabled: !!userId, queryKey: getGetUserQueryKey(userId) } });
  const { data: cars, isLoading: isCarsLoading } = useGetUserCars(userId, { query: { enabled: !!userId, queryKey: getGetUserCarsQueryKey(userId) } });
  const { data: posts, isLoading: isPostsLoading } = useGetUserPosts(userId, { query: { enabled: !!userId, queryKey: getGetUserPostsQueryKey(userId) } });
  const { data: me } = useGetMe({ query: { enabled: !!isSignedIn } });

  const followUser = useFollowUser();
  const unfollowUser = useUnfollowUser();

  // Fetch admin status when signed in and viewing own profile
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/admin/me")
      .then(r => r.json())
      .then(d => {
        setAdminStatus(d);
        // Check if any admin exists at all (by trying setup probe)
        if (!d.isAdmin) {
          fetch("/api/admin/setup", { method: "POST" })
            .then(r => {
              if (r.status === 409) setNoAdminYet(false);
              else if (r.status === 401 || r.status === 403) setNoAdminYet(false);
              // if ok, admin was just created (shouldn't happen here, handled below)
            })
            .catch(() => {});
          // Actually just check if we should show the claim button by trying to GET users list
          fetch("/api/admin/users").then(r => {
            if (r.status === 403) {
              // No admin yet check: try to see if setup would work
              setNoAdminYet(true);
            }
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [isSignedIn]);

  const claimAdmin = async () => {
    setClaimingAdmin(true);
    try {
      const res = await fetch("/api/admin/setup", { method: "POST" });
      if (res.ok) {
        setAdminStatus({ isAdmin: true });
        setNoAdminYet(false);
      }
    } finally {
      setClaimingAdmin(false);
    }
  };

  const toggleFollow = () => {
    if (user?.iFollowThem) {
      unfollowUser.mutate({ userId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) })
      });
    } else {
      followUser.mutate({ userId }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) })
      });
    }
  };

  if (isUserLoading) return <div className="space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (!user) return <div className="text-center py-20">User not found</div>;

  const isOwnProfile = !!me && me.id === user.id;
  const isAdmin = adminStatus?.isAdmin ?? false;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="h-48 w-full bg-gradient-to-r from-gray-800 to-gray-900 relative group">
          {user.coverUrl && <img src={user.coverUrl} alt="Cover" className="w-full h-full object-cover opacity-60" />}
          {isOwnProfile && (
            <Link
              href="/settings"
              className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white text-xs font-semibold px-3 py-2 rounded-full flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              title="Change cover photo"
            >
              <Camera className="h-3.5 w-3.5" /> Edit Cover
            </Link>
          )}
        </div>
        <div className="px-8 pb-8 relative">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 -mt-16 sm:-mt-20 mb-6">
            <div className="relative group">
              <Avatar className="h-32 w-32 border-4 border-white shadow-md bg-white">
                <AvatarImage src={user.avatarUrl || ''} />
                <AvatarFallback className="text-4xl">{user.displayName?.charAt(0)}</AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <Link
                  href="/settings"
                  className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors"
                  title="Change profile photo"
                >
                  <Camera className="h-7 w-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              )}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              {isOwnProfile && (
                <Button
                  onClick={() => setLocation("/settings")}
                  variant="outline"
                  className="rounded-full px-5 flex items-center gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Profile
                </Button>
              )}
              {/* Admin Panel button — only visible to the admin */}
              {isAdmin && (
                <Button
                  onClick={() => setLocation("/admin")}
                  variant="outline"
                  className="rounded-full px-5 border-red-200 text-red-700 hover:bg-red-50 flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Admin Panel
                </Button>
              )}
              {/* Claim Admin — only shows when no admin exists yet and user is signed in */}
              {!isAdmin && noAdminYet && isSignedIn && (
                <Button
                  onClick={claimAdmin}
                  disabled={claimingAdmin}
                  variant="outline"
                  className="rounded-full px-5 border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-2 text-xs"
                >
                  <Shield className="h-3.5 w-3.5" />
                  {claimingAdmin ? "Claiming…" : "Claim Admin"}
                </Button>
              )}
              {!isOwnProfile && (
                <Button
                  onClick={toggleFollow}
                  variant={user.iFollowThem ? "outline" : "default"}
                  className="rounded-full px-6"
                  disabled={followUser.isPending || unfollowUser.isPending}
                >
                  {user.iFollowThem ? "Following" : "Follow"}
                </Button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900">{user.displayName}</h1>
              {isAdmin && (
                <Badge className="bg-red-100 text-red-700 border-red-200 flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Admin
                </Badge>
              )}
            </div>
            <p className="text-gray-500 font-medium">@{user.username}</p>

            {user.bio && <p className="mt-4 text-gray-700 max-w-2xl text-lg">{user.bio}</p>}

            <div className="flex flex-wrap gap-6 mt-6 text-sm text-gray-600">
              {user.location && (
                <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {user.location}</div>
              )}
              <div className="flex items-center gap-1.5 font-medium"><Users className="h-4 w-4" /> <span className="text-gray-900">{user.followerCount}</span> Followers</div>
              <div className="flex items-center gap-1.5 font-medium"><span className="text-gray-900">{user.followingCount}</span> Following</div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="garage" className="w-full">
        <TabsList className="w-full justify-start border-b border-gray-200 rounded-none bg-transparent p-0 mb-8 h-auto">
          <TabsTrigger value="garage" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 pb-4 pt-2 text-lg font-semibold">
            Garage <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{user.carCount || 0}</span>
          </TabsTrigger>
          <TabsTrigger value="posts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 pb-4 pt-2 text-lg font-semibold">
            Discussions <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{user.postCount || 0}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="garage" className="mt-0">
          {isCarsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[1,2].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
            </div>
          ) : cars && cars.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {cars.map(car => (
                <Link key={car.id} href={`/cars/${car.id}`}>
                  <Card className="overflow-hidden rounded-2xl hover:shadow-lg transition-all cursor-pointer group border-gray-200">
                    <div className="h-56 relative bg-gray-100">
                      {car.mainImageUrl ? (
                        <img src={car.mainImageUrl} alt={`${car.make} ${car.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Car className="h-12 w-12 text-gray-300" /></div>
                      )}
                    </div>
                    <CardContent className="p-5">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">{car.year} {car.make} {car.model}</h3>
                      {car.generation && <p className="text-gray-500 mt-1">{car.generation}</p>}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
              <Car className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900">No cars yet</h3>
              <p className="mt-2 text-gray-500">This user hasn't added any cars to their garage.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="posts" className="mt-0">
          {isPostsLoading ? (
            <div className="space-y-4">
              {[1,2].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map(post => (
                <Link key={post.id} href={`/posts/${post.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer rounded-2xl border-gray-200">
                    <CardContent className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{post.title}</h3>
                      {post.body && <p className="text-gray-600 line-clamp-2 mb-4">{post.body}</p>}
                      <div className="flex gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1.5"><MessageSquare className="h-4 w-4" /> {post.commentCount}</span>
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-medium">{post.category}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900">No discussions</h3>
              <p className="mt-2 text-gray-500">This user hasn't started any discussions yet.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

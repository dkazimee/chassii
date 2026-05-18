import { useLocation } from "wouter";
import { useSearch } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function SearchPage() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const q = searchParams.get('q') || '';
  
  const { data: results, isLoading } = useSearch({ q });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900">Search Results for "{q}"</h1>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : results ? (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6 border-b rounded-none h-12 bg-transparent p-0 w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2">All Results</TabsTrigger>
            <TabsTrigger value="cars" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2">Cars ({results.cars?.length || 0})</TabsTrigger>
            <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2">Users ({results.users?.length || 0})</TabsTrigger>
            <TabsTrigger value="posts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2">Discussions ({results.posts?.length || 0})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="space-y-12">
            {results.cars && results.cars.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-4">Cars</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {results.cars.map(car => (
                    <Link key={car.id} href={`/cars/${car.id}`}>
                      <Card className="hover:shadow-md cursor-pointer transition-all">
                        <div className="h-40 bg-gray-100">
                          {car.mainImageUrl && <img src={car.mainImageUrl} className="w-full h-full object-cover" alt="Car" />}
                        </div>
                        <CardContent className="p-4">
                          <h4 className="font-bold">{car.year} {car.make} {car.model}</h4>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {results.users && results.users.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-4">Users</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {results.users.map(user => (
                    <Link key={user.id} href={`/users/${user.id}`}>
                      <Card className="hover:shadow-md cursor-pointer transition-all">
                        <CardContent className="p-4 flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src={user.avatarUrl || ''} />
                            <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-bold">{user.displayName}</h4>
                            <p className="text-sm text-gray-500">@{user.username}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {results.posts && results.posts.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-4">Discussions</h3>
                <div className="space-y-4">
                  {results.posts.map(post => (
                    <Link key={post.id} href={`/posts/${post.id}`}>
                      <Card className="hover:border-primary/50 cursor-pointer transition-all">
                        <CardContent className="p-6">
                          <h4 className="font-bold text-lg">{post.title}</h4>
                          <p className="text-gray-500 text-sm line-clamp-2 mt-1">{post.body}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </TabsContent>
          {/* Implement other tab contents similarly using the data above */}
          <TabsContent value="cars">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {results.cars?.map(car => (
                <Link key={car.id} href={`/cars/${car.id}`}>
                  <Card className="hover:shadow-md cursor-pointer transition-all">
                    <div className="h-40 bg-gray-100">
                      {car.mainImageUrl && <img src={car.mainImageUrl} className="w-full h-full object-cover" alt="Car" />}
                    </div>
                    <CardContent className="p-4">
                      <h4 className="font-bold">{car.year} {car.make} {car.model}</h4>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="users">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {results.users?.map(user => (
                <Link key={user.id} href={`/users/${user.id}`}>
                  <Card className="hover:shadow-md cursor-pointer transition-all">
                    <CardContent className="p-4 flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={user.avatarUrl || ''} />
                        <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-bold">{user.displayName}</h4>
                        <p className="text-sm text-gray-500">@{user.username}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="posts">
            <div className="space-y-4">
              {results.posts?.map(post => (
                <Link key={post.id} href={`/posts/${post.id}`}>
                  <Card className="hover:border-primary/50 cursor-pointer transition-all">
                    <CardContent className="p-6">
                      <h4 className="font-bold text-lg">{post.title}</h4>
                      <p className="text-gray-500 text-sm line-clamp-2 mt-1">{post.body}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
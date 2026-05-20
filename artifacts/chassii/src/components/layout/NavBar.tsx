import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { SignedIn, SignedOut } from "@/components/auth/ConditionalAuth";
import { Search, Bell, Menu, X, Car, User, Settings, LogOut, Shield, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";
import { useGetNotifications, useGetMe, getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";

export default function NavBar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();

  const navLink = (href: string) => {
    const active = location === href || (href !== "/" && location.startsWith(href));
    return active
      ? "text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-primary text-sm font-bold"
      : "text-gray-500 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300 text-sm font-medium";
  };

  const mobileNavLink = (href: string) => {
    const active = location === href || (href !== "/" && location.startsWith(href));
    return active
      ? "block pl-3 pr-4 py-2 border-l-4 border-primary text-base font-bold text-gray-900 hover:bg-gray-50"
      : "block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300";
  };
  const { signOut } = useClerk();
  const { user } = useUser();
  const { data: dbUser } = useGetMe({ query: { enabled: !!user } });
  const { data: notifications } = useGetNotifications({ limit: 5 }, { query: { enabled: !!user, queryKey: getGetNotificationsQueryKey({ limit: 5 }) } });
  const { data: adminInfo } = useQuery({
    queryKey: ["admin-me"],
    enabled: !!user,
    queryFn: async () => {
      const r = await fetch("/api/admin/me", { credentials: "include" });
      if (!r.ok) return { isAdmin: false };
      return (await r.json()) as { isAdmin: boolean };
    },
  });
  const isAdmin = !!adminInfo?.isAdmin;

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get("q");
    if (q) setLocation(`/search?q=${encodeURIComponent(q.toString())}`);
  };

  return (
    <nav className="bg-white border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center gap-2">
              <img src="/chassii-logo.png" alt="CHASSII" className="h-8 w-auto" />
            </Link>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
              {user && (
                <>
                  <Link href="/feed" className={navLink("/feed")} data-testid="link-home-nav">
                    Home
                  </Link>
                  <Link href="/garage" className={navLink("/garage")} data-testid="link-garage-nav">
                    My Garage
                  </Link>
                </>
              )}
              <Link href="/explore" className={navLink("/explore")}>
                Explore
              </Link>
              <Link href="/discussions" className={navLink("/discussions")}>
                Discussions
              </Link>
              <Link href="/events" className={navLink("/events")}>
                Events
              </Link>
              {isAdmin && (
                <Link href="/admin" className={`${navLink("/admin")} gap-1.5`} data-testid="link-admin-nav">
                  <Shield className="h-4 w-4" /> Admin
                </Link>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex">
              <form onSubmit={handleSearch} className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  name="q"
                  type="search"
                  placeholder="Search cars, users..."
                  className="pl-10 w-64 bg-gray-50 border-transparent focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary rounded-full"
                />
              </form>
            </div>

            <SignedIn>
              <Button variant="ghost" size="icon" className="relative text-gray-400 hover:text-gray-500">
                <span className="sr-only">View notifications</span>
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.imageUrl} alt={user?.fullName || ""} />
                      <AvatarFallback>{user?.firstName?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.fullName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.primaryEmailAddress?.emailAddress}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation("/garage")}>
                    <Car className="mr-2 h-4 w-4" />
                    <span>My Garage</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => dbUser?.id && setLocation(`/users/${dbUser.id}`)}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => setLocation("/admin")} data-testid="menu-admin">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Admin</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ redirectUrl: "/" })}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SignedIn>

            <SignedOut>
              <div className="hidden sm:flex items-center space-x-2">
                <Button variant="ghost" onClick={() => setLocation("/sign-in")}>Sign In</Button>
                <Button onClick={() => setLocation("/sign-up")}>Sign Up</Button>
              </div>
            </SignedOut>

            <div className="flex items-center sm:hidden">
              <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-200">
          <div className="pt-2 pb-3 space-y-1">
            {user && (
              <>
                <Link href="/feed" className={mobileNavLink("/feed")} onClick={() => setIsMobileMenuOpen(false)}>
                  Home
                </Link>
                <Link href="/garage" className={mobileNavLink("/garage")} onClick={() => setIsMobileMenuOpen(false)}>
                  My Garage
                </Link>
              </>
            )}
            <Link href="/explore" className={mobileNavLink("/explore")} onClick={() => setIsMobileMenuOpen(false)}>
              Explore
            </Link>
            <Link href="/discussions" className={mobileNavLink("/discussions")} onClick={() => setIsMobileMenuOpen(false)}>
              Discussions
            </Link>
            <Link href="/events" className={mobileNavLink("/events")} onClick={() => setIsMobileMenuOpen(false)}>
              Events
            </Link>
            {isAdmin && (
              <Link href="/admin" className={`${mobileNavLink("/admin")} flex items-center gap-2`} onClick={() => setIsMobileMenuOpen(false)}>
                <Shield className="h-4 w-4" /> Admin
              </Link>
            )}
          </div>
          
          <SignedOut>
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="flex items-center px-4 space-x-2">
                <Button variant="outline" className="w-full" onClick={() => { setLocation("/sign-in"); setIsMobileMenuOpen(false); }}>Sign In</Button>
                <Button className="w-full" onClick={() => { setLocation("/sign-up"); setIsMobileMenuOpen(false); }}>Sign Up</Button>
              </div>
            </div>
          </SignedOut>
        </div>
      )}
    </nav>
  );
}
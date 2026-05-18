import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { SignedIn, SignedOut } from "@/components/auth/ConditionalAuth";
import { Search, Bell, Menu, X, Car, User, Settings, LogOut } from "lucide-react";
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
import { useGetNotifications, getGetNotificationsQueryKey } from "@workspace/api-client-react";

export default function NavBar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { data: notifications } = useGetNotifications({ limit: 5 }, { query: { enabled: !!user, queryKey: getGetNotificationsQueryKey({ limit: 5 }) } });

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
              <img src="/logo.svg" alt="CHASSII" className="h-8 w-auto" />
            </Link>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
              <Link href="/explore" className="text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-primary text-sm font-medium">
                Explore
              </Link>
              <Link href="/discussions" className="text-gray-500 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300 text-sm font-medium">
                Discussions
              </Link>
              <Link href="/events" className="text-gray-500 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-gray-300 text-sm font-medium">
                Events
              </Link>
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
                  <DropdownMenuItem onClick={() => setLocation(`/users/${user?.id}`)}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
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
            <Link href="/explore" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300">
              Explore
            </Link>
            <Link href="/discussions" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300">
              Discussions
            </Link>
            <Link href="/events" className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300">
              Events
            </Link>
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
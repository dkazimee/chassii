import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, useClerk } from '@clerk/react';
import { SignedIn, SignedOut } from '@/components/auth/ConditionalAuth';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";

import LandingPage from "@/pages/landing";
import FeedPage from "@/pages/feed";
import GaragePage from "@/pages/garage";
import ExplorePage from "@/pages/explore";
import DiscussionsPage from "@/pages/discussions";
import NavBar from "@/components/layout/NavBar";
import PostDetailPage from "@/pages/post-detail";
import CreatePostPage from "@/pages/create-post";
import EventsPage from "@/pages/events";
import SearchPage from "@/pages/search";
import SettingsPage from "@/pages/settings";
import UserProfilePage from "@/pages/user-profile";
import CarDetailPage from "@/pages/car-detail";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

const clerkAppearance = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#E31E24",
    colorBackground: "#ffffff",
    colorText: "#0f172a",
    colorTextSecondary: "#64748b",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    card: "shadow-md border border-gray-100 rounded-xl",
    formButtonPrimary: "bg-red-600 hover:bg-red-700 text-white",
  },
};

function HomeRedirect() {
  return (
    <>
      <SignedIn><Redirect to="/feed" /></SignedIn>
      <SignedOut><LandingPage /></SignedOut>
    </>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }: { user?: { id?: string } | null }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <SignedIn><Component /></SignedIn>
      <SignedOut><Redirect to="/sign-in" /></SignedOut>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to: string) => setLocation(stripBase(to))}
      routerReplace={(to: string) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/feed"><Layout><ProtectedRoute component={FeedPage} /></Layout></Route>
          <Route path="/garage"><Layout><ProtectedRoute component={GaragePage} /></Layout></Route>
          <Route path="/explore"><Layout><ExplorePage /></Layout></Route>
          <Route path="/discussions"><Layout><DiscussionsPage /></Layout></Route>
          <Route path="/events"><Layout><EventsPage /></Layout></Route>
          <Route path="/search"><Layout><SearchPage /></Layout></Route>
          <Route path="/posts/:postId"><Layout><PostDetailPage /></Layout></Route>
          <Route path="/create-post"><Layout><ProtectedRoute component={CreatePostPage} /></Layout></Route>
          <Route path="/settings"><Layout><ProtectedRoute component={SettingsPage} /></Layout></Route>
          <Route path="/users/:userId"><Layout><UserProfilePage /></Layout></Route>
          <Route path="/cars/:carId"><Layout><CarDetailPage /></Layout></Route>
          <Route path="*">
            <div className="min-h-screen flex items-center justify-center">
              <h1 className="text-2xl font-bold">404 - Not Found</h1>
            </div>
          </Route>
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
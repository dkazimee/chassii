import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGetStatsSummary } from "@workspace/api-client-react";
import { ArrowRight, Car, Users, MessageSquare } from "lucide-react";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { data: stats } = useGetStatsSummary();

  return (
    <div className="bg-white">
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            className="text-gray-900 hover:bg-gray-100 rounded-full font-semibold"
            onClick={() => setLocation("/sign-in")}
            data-testid="button-landing-sign-in"
          >
            Sign In
          </Button>
          <Button
            className="rounded-full font-bold"
            onClick={() => setLocation("/sign-up")}
            data-testid="button-landing-sign-up"
          >
            Sign Up
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative bg-white overflow-hidden">
        {/* Car backdrop */}
        <div className="absolute inset-0 pointer-events-none">
          <img
            src="/hero.png"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/40 to-white" />
        </div>

        <div className="relative px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-[90vh] flex flex-col items-center justify-center pt-24 pb-16 text-center">
          <img
            src="/chassii-logo-transparent.png"
            alt="CHASSII"
            className="w-[60%] max-w-xl drop-shadow-2xl mb-6 sm:mb-8 relative"
            data-testid="img-hero-logo"
          />
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 max-w-3xl">
            Your garage deserves more than a forum thread.
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-2xl">
            CHASSII is a modern community for car enthusiasts to showcase builds, document ownership, ask questions, and connect with drivers locally or nationwide.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-6 rounded-full font-bold" onClick={() => setLocation("/sign-up")}>
              Create Your Garage
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 rounded-full font-bold" onClick={() => setLocation("/explore")}>
              Browse the Garage <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
          <p className="mt-6 text-gray-600 text-sm">
            Already have an account?{" "}
            <button
              onClick={() => setLocation("/sign-in")}
              className="text-gray-900 font-semibold underline underline-offset-4 hover:text-primary"
              data-testid="link-landing-hero-sign-in"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <div className="h-16 w-16 bg-red-50 text-primary rounded-2xl flex items-center justify-center mb-4">
                <Car className="h-8 w-8" />
              </div>
              <h3 className="text-4xl font-extrabold tracking-tight text-gray-900">{stats?.totalCars || '1,000+'}</h3>
              <p className="mt-2 text-lg text-gray-500 font-medium">Cars Showcased</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-16 w-16 bg-red-50 text-primary rounded-2xl flex items-center justify-center mb-4">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="text-4xl font-extrabold tracking-tight text-gray-900">{stats?.totalUsers || '5,000+'}</h3>
              <p className="mt-2 text-lg text-gray-500 font-medium">Enthusiasts Connected</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-16 w-16 bg-red-50 text-primary rounded-2xl flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="text-4xl font-extrabold tracking-tight text-gray-900">{stats?.totalPosts || '10,000+'}</h3>
              <p className="mt-2 text-lg text-gray-500 font-medium">Discussions Started</p>
            </div>
          </div>
        </div>
      </div>

      {/* Showcase Section */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Discover legendary builds.
            </h2>
            <p className="mt-4 text-xl text-gray-500">
              From track weapons to pristine classics, see what the community is building.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="rounded-3xl overflow-hidden shadow-2xl aspect-[4/3]">
              <img src="/showcase-1.png" alt="Track car" className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Track Records & Build Journals</h3>
              <p className="text-lg text-gray-600 mb-6">
                Document every mod, track day, and maintenance item on a beautifully designed timeline. Your car's history deserves more than scattered forum posts.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-gray-700">
                  <div className="h-2 w-2 rounded-full bg-primary mr-3" />
                  Detailed mod lists with categories and brands
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="h-2 w-2 rounded-full bg-primary mr-3" />
                  Rich media timeline entries
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="h-2 w-2 rounded-full bg-primary mr-3" />
                  Follow favorite cars to get updates
                </li>
              </ul>
              <Button variant="outline" size="lg" className="rounded-full" onClick={() => setLocation("/explore")}>
                View Build Journals
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mt-24">
            <div className="order-2 lg:order-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Connect over shared passion</h3>
              <p className="text-lg text-gray-600 mb-6">
                Find owners of the same chassis, ask technical questions, and organize local meets. A modern social experience built specifically for automotive culture.
              </p>
              <ul className="space-y-4 mb-8">
                <li className="flex items-center text-gray-700">
                  <div className="h-2 w-2 rounded-full bg-primary mr-3" />
                  Make/model specific discussions
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="h-2 w-2 rounded-full bg-primary mr-3" />
                  Local events and cars and coffee
                </li>
                <li className="flex items-center text-gray-700">
                  <div className="h-2 w-2 rounded-full bg-primary mr-3" />
                  High-quality community moderation
                </li>
              </ul>
              <Button variant="outline" size="lg" className="rounded-full" onClick={() => setLocation("/discussions")}>
                Join the Discussion
              </Button>
            </div>
            <div className="order-1 lg:order-2 rounded-3xl overflow-hidden shadow-2xl aspect-[4/3]">
              <img src="/showcase-2.png" alt="Classic interior" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="bg-gray-900 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Ready to park in the garage?
          </h2>
          <p className="mt-4 text-xl text-gray-400 mb-10">
            Join thousands of enthusiasts who have already created their CHASSII portfolio.
          </p>
          <Button size="lg" className="text-lg px-10 py-6 rounded-full font-bold" onClick={() => setLocation("/sign-up")}>
            Sign Up Now
          </Button>
        </div>
      </div>
    </div>
  );
}
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
      {/* Hero Section */}
      <div className="relative">
        <div className="absolute inset-0 h-[80vh] w-full">
          <img 
            src="/hero.png" 
            alt="Cinematic sports car in garage" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-background/20" />
        </div>
        
        <div className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto h-[80vh] flex flex-col justify-end">
          <img
            src="/chassii-logo.png"
            alt="CHASSII — Your Cars. Your Story. Your Community."
            className="w-56 sm:w-72 mb-8 drop-shadow-xl"
          />
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-white max-w-3xl drop-shadow-md">
            Your garage deserves more than a forum thread.
          </h1>
          <p className="mt-6 text-xl text-gray-200 max-w-2xl drop-shadow">
            CHASSII is a modern community for car enthusiasts to showcase builds, document ownership, ask questions, and connect with drivers locally or nationwide.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="text-lg px-8 py-6 rounded-full font-bold" onClick={() => setLocation("/sign-up")}>
              Create Your Garage
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 rounded-full font-bold bg-white/10 text-white border-white/20 hover:bg-white/20" onClick={() => setLocation("/explore")}>
              Explore Builds <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
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
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGetStatsSummary } from "@workspace/api-client-react";
import { ArrowRight, Car, Users, MessageSquare, Wrench, Zap, BookOpen, AlertTriangle } from "lucide-react";

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
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Track Records & Garage Journeys</h3>
              <p className="text-lg text-gray-600 mb-6">
                Document every mod, track day, road trip, and maintenance item on a beautifully designed timeline — whether you're wrenching, restoring, or just enjoying the drive. Your car's story deserves more than scattered forum posts.
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
                Explore Garage Journeys
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

      {/* AI Mechanic Section */}
      <div className="py-24 bg-gray-900 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: copy */}
            <div>
              <div className="inline-flex items-center gap-2 bg-red-600/20 text-red-400 text-sm font-semibold px-4 py-2 rounded-full mb-6">
                <Zap className="h-4 w-4" />
                AI-Powered
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-6">
                Meet your AI Mechanic.
              </h2>
              <p className="text-lg text-gray-400 mb-8">
                Got a weird noise? Wondering if that mod is worth it? Your AI Mechanic knows your garage — ask anything and get answers grounded in your specific car's make, model, and year.
              </p>
              <ul className="space-y-5 mb-10">
                <li className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-red-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Wrench className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Diagnose before you panic</p>
                    <p className="text-gray-400 text-sm mt-0.5">Describe a symptom and get likely causes ranked by probability — before you call the shop.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-red-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <BookOpen className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Maintenance reminders that make sense</p>
                    <p className="text-gray-400 text-sm mt-0.5">Ask what's due at your mileage — and get interval recommendations specific to your chassis.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-red-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Know your common issues</p>
                    <p className="text-gray-400 text-sm mt-0.5">Every platform has known gremlins. Your AI Mechanic surfaces them so you're never caught off guard.</p>
                  </div>
                </li>
              </ul>
              <Button
                size="lg"
                className="rounded-full bg-red-600 hover:bg-red-700 text-white font-bold px-8"
                onClick={() => setLocation("/sign-up")}
              >
                Try the AI Mechanic
              </Button>
            </div>

            {/* Right: mock chat UI */}
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-4 bg-red-600/10 rounded-3xl blur-2xl pointer-events-none" />
              <div className="relative bg-gray-800 rounded-3xl border border-gray-700 overflow-hidden shadow-2xl">
                {/* Chat header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-700 bg-gray-800/80 backdrop-blur">
                  <div className="h-9 w-9 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                    <Wrench className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">AI Mechanic</p>
                    <p className="text-gray-400 text-xs">Knows your 1994 Toyota Supra</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-xs text-gray-400">Online</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="p-5 space-y-4 min-h-[320px]">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="bg-red-600 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
                      My 2JZ has a slight ticking at idle when warm. Should I be worried?
                    </div>
                  </div>

                  {/* AI response */}
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-1">
                      <Wrench className="h-3.5 w-3.5 text-red-400" />
                    </div>
                    <div className="bg-gray-700 text-gray-100 text-sm rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%] space-y-2">
                      <p>A warm ticking on the 2JZ-GTE is most commonly one of three things:</p>
                      <ol className="list-decimal list-inside space-y-1 text-gray-300">
                        <li><span className="text-white font-medium">VVT-i solenoid</span> — the most common culprit on high-mileage Supras. Cheap fix.</li>
                        <li><span className="text-white font-medium">Valve clearance</span> — check if you're past 60k since your last adjustment.</li>
                        <li><span className="text-white font-medium">Oil pressure</span> — less likely, but worth checking with a gauge.</li>
                      </ol>
                      <p className="text-gray-400 text-xs pt-1">I'd start with the solenoid screen. Want a step-by-step?</p>
                    </div>
                  </div>

                  {/* User follow-up */}
                  <div className="flex justify-end">
                    <div className="bg-red-600 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
                      Yes, walk me through cleaning it.
                    </div>
                  </div>

                  {/* Typing indicator */}
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-1">
                      <Wrench className="h-3.5 w-3.5 text-red-400" />
                    </div>
                    <div className="bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input bar */}
                <div className="px-5 pb-5">
                  <div className="flex items-center gap-3 bg-gray-700 rounded-2xl px-4 py-3 border border-gray-600">
                    <span className="text-gray-400 text-sm flex-1">Ask about your car…</span>
                    <div className="h-7 w-7 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                      <ArrowRight className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>
                </div>
              </div>
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
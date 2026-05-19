import { useState } from "react";
import { useLocation } from "wouter";
import { useGetMe, useUpdateMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/ImageUploader";
import { Car } from "lucide-react";

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const updateMe = useUpdateMe();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateUsername(val: string) {
    if (!val) return "Username is required";
    if (!/^[a-z0-9_]{3,30}$/.test(val)) return "3–30 chars: lowercase letters, numbers, underscores only";
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateUsername(username);
    if (err) { setUsernameError(err); return; }
    if (!displayName.trim()) return;

    setIsSubmitting(true);
    updateMe.mutate(
      { data: { displayName: displayName.trim(), username: username.trim(), bio, avatarUrl } },
      {
        onSuccess: () => setLocation("/feed"),
        onError: (error: unknown) => {
          const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "";
          if (msg.toLowerCase().includes("taken")) {
            setUsernameError("That username is already taken — try another");
          }
          setIsSubmitting(false);
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="h-14 w-14 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Car className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Welcome to CHASSII</h1>
          <p className="text-gray-500 text-sm">Set up your profile to get started with the community.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col items-center gap-2">
            <Label className="self-start">Profile Photo</Label>
            <ImageUploader
              shape="circle"
              value={avatarUrl}
              onChange={setAvatarUrl}
              className="mx-auto"
            />
            <p className="text-xs text-gray-400">Click to upload (optional)</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="displayName">
              Display Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="displayName"
              placeholder="e.g. Alex Johnson"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">
              Username <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
              <Input
                id="username"
                placeholder="yourhandle"
                className="pl-7"
                value={username}
                onChange={e => {
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                  setUsername(val);
                  setUsernameError(val ? validateUsername(val) : "");
                }}
                required
              />
            </div>
            {usernameError && <p className="text-xs text-red-500">{usernameError}</p>}
            {!usernameError && username && <p className="text-xs text-green-600">@{username} looks good!</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Textarea
              id="bio"
              placeholder="Tell the community about yourself and your cars..."
              className="resize-none"
              rows={3}
              value={bio}
              onChange={e => setBio(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !displayName.trim() || !username || !!usernameError}
          >
            {isSubmitting ? "Setting up your profile..." : "Get Started"}
          </Button>
        </form>
      </div>
    </div>
  );
}

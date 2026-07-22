"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in successfully");
    const nextPath = searchParams.get("next");
    router.push(nextPath || "/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(120,119,198,0.25),_transparent_30%),linear-gradient(135deg,_#f8fafc,_#eef2ff)] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur-xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-500">Flowboard</p>
          <h1 className="mt-2 text-3xl font-semibold">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to manage boards, tasks, and invites in real time.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" required />
          </div>
          <div>
            <Label>Password</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Don&apos;t have an account? <Link className="font-medium text-indigo-600" href="/signup">Create one</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(120,119,198,0.25),_transparent_30%),linear-gradient(135deg,_#f8fafc,_#eef2ff)] px-4 py-10">
          <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur-xl text-center text-slate-500">
            Loading...
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
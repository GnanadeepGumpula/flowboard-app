"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Completing sign in...");

  useEffect(() => {
    const completeSignIn = async () => {
      const code = searchParams.get("code");
      if (!code) {
        setStatus("Missing confirmation code.");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setStatus(error.message);
        toast.error(error.message);
        return;
      }

      toast.success("Email confirmed. Welcome back.");
      router.replace("/dashboard");
    };

    completeSignIn();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(120,119,198,0.25),_transparent_30%),linear-gradient(135deg,_#f8fafc,_#eef2ff)] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 text-center shadow-xl backdrop-blur-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-500">Flowboard</p>
        <h1 className="mt-3 text-3xl font-semibold">Email verification</h1>
        <p className="mt-3 text-sm text-slate-500">{status}</p>
        {status !== "Completing sign in..." ? (
          <Button className="mt-6 w-full" onClick={() => router.push("/login")}>
            Return to sign in
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(120,119,198,0.25),_transparent_30%),linear-gradient(135deg,_#f8fafc,_#eef2ff)] px-4 py-10">
          <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 text-center shadow-xl backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-500">Flowboard</p>
            <h1 className="mt-3 text-3xl font-semibold">Email verification</h1>
            <p className="mt-3 text-sm text-slate-500">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

function ResetPasswordContent() {
  const router = useRouter();

  // Form State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSessionValid, setIsSessionValid] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Parallax State
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const rightPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    // 1. Listen for auth state recovery event from URL hash
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "PASSWORD_RECOVERY" || session) {
          setIsSessionValid(true);
          setIsCheckingSession(false);
        }
      }
    );

    // 2. Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsSessionValid(true);
      }
      setIsCheckingSession(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!rightPanelRef.current) return;
    const rect = rightPanelRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => setMousePos({ x: 0, y: 0 });

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Ensure session exists right before sending update
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setLoading(false);
      toast.error("Auth session expired or missing! Please click the email link again.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated successfully!");
    router.push("/login");
  };

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center font-medium text-slate-500 bg-white">
        Verifying security token...
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col-reverse lg:flex-row bg-white selection:bg-black selection:text-white antialiased overflow-hidden" style={{ fontFamily: "var(--font-sans), Inter, -apple-system, sans-serif" }}>
      {/* LEFT SIDE: Form */}
      <div className="w-full lg:w-[52%] bg-white flex flex-col relative shrink-0">
        <div className="px-6 sm:px-10 lg:px-12 xl:px-14 pt-7 pb-6 flex items-center gap-2.5">
          <div className="w-[32px] h-[32px] rounded-[10px] bg-black flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M2 7.5C3.5 6 5.5 6 7 7.5C8.5 9 10.5 9 12 7.5C13.5 6 15.5 6 17 7.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-[17px] font-semibold tracking-tight text-black">Flowboard</span>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-12 xl:px-14 py-6 lg:py-0">
          <div className="w-full max-w-[440px]">
            <div className="mb-9">
              <h1 className="text-[38px] sm:text-[44px] lg:text-[48px] font-[800] leading-[0.95] tracking-[-0.03em] text-black">Set new password</h1>
              <p className="mt-3.5 text-[15px] leading-6 text-[#6b6b76] font-[450]">Enter your new password below to regain access to your account.</p>
            </div>

            {!isSessionValid ? (
              <div className="p-4 bg-red-50 border border-red-100 rounded-[14px] text-[14px] text-red-600 mb-6">
                Invalid or expired reset link. Please trigger a new password reset link from the login page.
              </div>
            ) : null}

            <form onSubmit={handlePasswordReset} className="space-y-5">
              <div>
                <label className="text-[13.5px] font-semibold text-black mb-2 block">New Password</label>
                <input 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  placeholder="••••••••••" 
                  type="password" 
                  required
                  disabled={!isSessionValid}
                  className="w-full h-[52px] bg-[#f6f6f7] border border-[#eeeeef] rounded-[14px] px-4 text-[15px] font-[450] text-black outline-none focus:bg-white focus:border-black focus:ring-[3px] focus:ring-black/10 transition-all disabled:opacity-50" 
                />
              </div>

              <div>
                <label className="text-[13.5px] font-semibold text-black mb-2 block">Confirm Password</label>
                <input 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  placeholder="••••••••••" 
                  type="password" 
                  required
                  disabled={!isSessionValid}
                  className="w-full h-[52px] bg-[#f6f6f7] border border-[#eeeeef] rounded-[14px] px-4 text-[15px] font-[450] text-black outline-none focus:bg-white focus:border-black focus:ring-[3px] focus:ring-black/10 transition-all disabled:opacity-50" 
                />
              </div>

              <button 
                type="submit" 
                disabled={loading || !isSessionValid} 
                className="w-full h-[56px] rounded-full bg-black text-white text-[17px] font-semibold tracking-[-0.01em] hover:bg-[#111] active:scale-[0.99] transition-all shadow-[0_8px_24px_rgba(0,0,0,0.16)] mt-2 flex items-center justify-center disabled:opacity-50"
              >
                {loading ? "Changing Password..." : "Change Password"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Visual */}
      <div 
        ref={rightPanelRef} 
        onMouseMove={handleMouseMove} 
        onMouseLeave={handleMouseLeave} 
        className="w-full lg:w-[48%] relative overflow-hidden flex items-center justify-center min-h-[520px] lg:min-h-screen" 
        style={{ background: "linear-gradient(180deg, #8a8de2 0%, #9b8fd6 28%, #a89ad9 58%, #b8a8e6 100%)" }}
      >
        <div className="relative z-10 transition-transform duration-700 ease-out" style={{ transform: `translate3d(${mousePos.x * 18}px, ${mousePos.y * 14}px, 0)` }}>
          <div className="w-[204px] bg-white/85 backdrop-blur-[18px] border border-white/60 rounded-[26px] p-[14px]">
            <div className="flex items-center gap-2 px-1 pt-1">
              <div className="w-2 h-2 rounded-full bg-[#2ee5a0]"></div>
              <span className="text-[13px] font-semibold text-[#2a2a40]">Flowboard</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center font-medium text-slate-500">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
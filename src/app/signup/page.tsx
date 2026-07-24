"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ListTodo, CheckCircle2, Zap } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  
  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmEmailOpen, setConfirmEmailOpen] = useState(false);

  // Parallax State for Right Side
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!rightPanelRef.current) return;
    const rect = rightPanelRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => setMousePos({ x: 0, y: 0 });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: fullName,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Account created and signed in.");
      router.push("/dashboard");
      return;
    }
    setConfirmEmailOpen(true);
    toast.success("Account created. Check your inbox to confirm your email.");
  };

  return (
    <div className="flex min-h-screen w-full bg-white font-sans antialiased overflow-hidden" style={{ fontFamily: "var(--font-sans), Inter, -apple-system, sans-serif" }}>
      
      {/* Embedded Styles for custom keyframes */}
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) rotate(-1.8deg) }
          50% { transform: translateY(-18px) rotate(-1.8deg) }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(6px) rotate(1.2deg) }
          50% { transform: translateY(-14px) rotate(1.2deg) }
        }
        @keyframes float3 {
          0%, 100% { transform: translateY(-2px) rotate(-0.8deg) }
          50% { transform: translateY(-20px) rotate(-0.8deg) }
        }
        @keyframes floatBadge {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1) }
          50% { transform: translateY(-8px) rotate(6deg) scale(1.05) }
        }
        @keyframes floatBadge2 {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1) }
          50% { transform: translateY(-10px) rotate(-8deg) scale(1.08) }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1) }
          50% { opacity: 0.8; transform: scale(1.08) }
        }
        @keyframes drift {
          0%, 100% { transform: translate(0,0) }
          33% { transform: translate(12px, -10px) }
          66% { transform: translate(-8px, 8px) }
        }
        .float-1 { animation: float1 4.6s ease-in-out infinite; }
        .float-2 { animation: float2 3.9s ease-in-out infinite; animation-delay: 0.3s; }
        .float-3 { animation: float3 5.1s ease-in-out infinite; animation-delay: 0.6s; }
        .float-badge { animation: floatBadge 3.2s ease-in-out infinite; }
        .float-badge2 { animation: floatBadge2 2.9s ease-in-out infinite; }
        .drift { animation: drift 8s ease-in-out infinite; }
      `}</style>

      {/* --- LEFT SIDE: Signup Form --- */}
      <div className="flex w-full items-center justify-center lg:w-1/2">
        <div className="flex w-full flex-col justify-center px-6 sm:px-12 lg:px-24 xl:px-32 py-10">
          
          <div className="mb-10 text-left">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#8B5CF6]">Flowboard</p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900">Create your account</h1>
            <p className="mt-3 text-[15px] font-medium text-slate-500">Join the workspace and organize work beautifully.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Full name</Label>
              <Input 
                className="h-12 rounded-[14px] border-slate-200 bg-slate-50/50 px-4 text-[15px] transition-colors focus:bg-white placeholder:text-slate-400" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                placeholder="Alex Rivera" 
                required 
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Email address</Label>
              <Input 
                className="h-12 rounded-[14px] border-slate-200 bg-slate-50/50 px-4 text-[15px] transition-colors focus:bg-white placeholder:text-slate-400" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                type="email" 
                placeholder="you@example.com" 
                required 
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Password</Label>
              <Input 
                className="h-12 rounded-[14px] border-slate-200 bg-slate-50/50 px-4 text-[15px] transition-colors focus:bg-white placeholder:text-slate-400" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                type="password" 
                placeholder="••••••••" 
                required 
              />
            </div>

            <Button 
              type="submit" 
              className="mt-4 h-12 w-full rounded-[14px] bg-slate-900 text-[15px] font-bold text-white transition-all hover:bg-slate-800 hover:shadow-md" 
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-8 text-center text-[14px] font-medium text-slate-500">
            Already have an account?{" "}
            <Link className="font-bold text-[#8B5CF6] transition-colors hover:text-[#7C3AED]" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* --- RIGHT SIDE: Interactive Visuals --- */}
      <div 
        ref={rightPanelRef} 
        onMouseMove={handleMouseMove} 
        onMouseLeave={handleMouseLeave} 
        className="relative hidden w-1/2 overflow-hidden bg-[#FAF9FC] lg:flex lg:flex-col lg:items-center lg:justify-center"
        style={{ background: "linear-gradient(180deg, #8a8de2 0%, #9b8fd6 28%, #a89ad9 58%, #b8a8e6 100%)" }}
      >
        <div className="absolute inset-0 opacity-[0.18] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }}></div>
        <div className="absolute w-[520px] h-[520px] rounded-full bg-white/12 blur-[80px] -top-20 -left-20 drift pointer-events-none"></div>
        <div className="absolute w-[600px] h-[600px] rounded-full bg-[#c9b6f5]/40 blur-[90px] -bottom-32 -right-20 drift pointer-events-none" style={{ animationDelay: "-2s" }}></div>
        <div className="absolute w-[300px] h-[300px] rounded-full bg-[#8b8ee0]/50 blur-[60px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        <div className="absolute top-[18%] right-[18%] w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center float-badge">
          <span className="text-[14px]">✦</span>
        </div>
        <div className="absolute top-[12%] left-[22%] w-7 h-7 rounded-full bg-white/80 shadow-md flex items-center justify-center float-badge2">
          <span className="text-[12px]">✦</span>
        </div>
        
        {/* Parallax Container */}
        <div className="relative z-10 transition-transform duration-700 ease-out will-change-transform" style={{ transform: `translate3d(${mousePos.x * 18}px, ${mousePos.y * 14}px, 0)` }}>
          <div className="absolute inset-0 -m-20 bg-white/10 blur-[50px] rounded-[40px] pointer-events-none"></div>
          
          {/* Board Grid */}
          <div className="flex gap-[18px] sm:gap-[22px] items-start px-6 py-10 lg:p-0 scale-[0.88] sm:scale-[0.92] lg:scale-[1] origin-center">
            
            {/* Column 1: To Do */}
            <div className="float-1 will-change-transform">
              <div className="w-[204px] bg-white/85 backdrop-blur-[18px] border border-white/60 rounded-[26px] shadow-[0_24px_64px_rgba(70,60,140,0.22),0_8px_24px_rgba(0,0,0,0.08)] p-[14px] flex flex-col gap-3.5 relative">
                <div className="flex items-center justify-between px-1 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#8b8ee0]"></div>
                    <span className="text-[13px] font-semibold tracking-tight text-[#2a2a40]">To Do</span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-[14px] font-bold leading-none">+</div>
                </div>

                <div className="bg-white rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.07)] p-3.5 border border-black/[0.04] relative group hover:shadow-[0_12px_28px_rgba(0,0,0,0.1)] transition-all">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-semibold tracking-wide px-2 py-1 rounded-full bg-[#f1f0ff] text-[#7c6ee0]">Design</span>
                    <div className="w-5 h-5 rounded-full border border-[#e6e6ea] flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full border border-[#c9c9d6]"></div>
                    </div>
                  </div>
                  <div className="text-[13px] font-semibold leading-[1.25] text-[#1a1a22]">Design landing page</div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex -space-x-1.5">
                      <div className="w-[26px] h-[26px] rounded-full bg-[#a78bfa] border-[2.5px] border-white flex items-center justify-center text-[10px] font-bold text-white">JD</div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-[#8b8ba0] font-medium">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 4.5h8M2 7h5" stroke="#9a9ab0" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                      3
                    </div>
                  </div>
                  <div className="absolute -right-2 -top-2 w-6 h-6 bg-[#2ee5a0] rounded-full shadow-[0_4px_12px_rgba(46,229,160,0.4)] flex items-center justify-center float-badge">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <div className="bg-white rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.07)] p-3.5 border border-black/[0.04] hover:shadow-[0_12px_28px_rgba(0,0,0,0.1)] transition-all">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-semibold tracking-wide px-2 py-1 rounded-full bg-[#fff1e6] text-[#d9853a]">Research</span>
                    <div className="w-5 h-5 rounded-full border border-[#e6e6ea] flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full border border-[#c9c9d6]"></div>
                    </div>
                  </div>
                  <div className="text-[13px] font-semibold leading-[1.25] text-[#1a1a22]">User research</div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="w-[26px] h-[26px] rounded-full bg-[#ffb86a] border-[2.5px] border-white flex items-center justify-center text-[10px] font-bold text-white">AM</div>
                    <div className="w-[26px] h-[26px] rounded-full bg-[#ffe4c2] border-[2.5px] border-white flex items-center justify-center text-[9px]">🌿</div>
                  </div>
                </div>

                <div className="absolute -left-3 bottom-[46px] w-[34px] h-[34px] rounded-[11px] bg-white shadow-[0_8px_20px_rgba(0,0,0,0.12)] flex items-center justify-center float-badge2 border border-black/5">
                  <div className="w-4 h-3.5 rounded-[3px] bg-[#f2f2f5] flex flex-col gap-[2px] p-[3px]">
                    <div className="h-[1.5px] bg-[#c2c2d0] rounded-full w-full"></div>
                    <div className="h-[1.5px] bg-[#c2c2d0] rounded-full w-[70%]"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Doing */}
            <div className="float-2 will-change-transform mt-6 lg:mt-8">
              <div className="w-[204px] bg-white/85 backdrop-blur-[18px] border border-white/60 rounded-[26px] shadow-[0_24px_64px_rgba(70,60,140,0.22),0_8px_24px_rgba(0,0,0,0.08)] p-[14px] flex flex-col gap-3.5 relative">
                <div className="flex items-center gap-2 px-1 pt-1">
                  <div className="w-2 h-2 rounded-full bg-[#f59e0b]"></div>
                  <span className="text-[13px] font-semibold tracking-tight text-[#2a2a40]">Doing</span>
                </div>
                <div className="bg-white rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.07)] p-3.5 border border-black/[0.04] hover:shadow-[0_12px_28px_rgba(0,0,0,0.1)] transition-all relative">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-semibold tracking-wide px-2 py-1 rounded-full bg-[#e8f0ff] text-[#4a7de8]">Dev</span>
                    <div className="w-5 h-5 rounded-full bg-[#111] flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white animate-[pulseDot_1.6s_ease-in-out_infinite]"></div>
                    </div>
                  </div>
                  <div className="text-[13px] font-semibold leading-[1.25] text-[#1a1a22]">API integration</div>
                  <div className="mt-3">
                    <div className="h-1.5 bg-[#f0f0f3] rounded-full overflow-hidden">
                      <div className="h-full w-[62%] bg-[#4a7de8] rounded-full"></div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="w-[26px] h-[26px] rounded-full bg-[#60a5fa] border-[2.5px] border-white flex items-center justify-center text-[10px] font-bold text-white">SK</div>
                    <span className="text-[11px] font-medium text-[#8b8ba0]">62%</span>
                  </div>
                  <div className="absolute -right-2 top-[54px] w-7 h-7 bg-[#2ee5a0] rounded-full shadow-[0_6px_16px_rgba(46,229,160,0.45)] flex items-center justify-center float-badge border-[3px] border-white">
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="absolute -right-3 bottom-8 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center float-badge">
                  <span className="text-[10px]">✦</span>
                </div>
              </div>
            </div>

            {/* Column 3: Done */}
            <div className="float-3 will-change-transform">
              <div className="w-[204px] bg-white/85 backdrop-blur-[18px] border border-white/60 rounded-[26px] shadow-[0_24px_64px_rgba(70,60,140,0.22),0_8px_24px_rgba(0,0,0,0.08)] p-[14px] flex flex-col gap-3.5 relative">
                <div className="flex items-center gap-2 px-1 pt-1">
                  <div className="w-2 h-2 rounded-full bg-[#2ee5a0]"></div>
                  <span className="text-[13px] font-semibold tracking-tight text-[#2a2a40]">Done</span>
                </div>

                <div className="bg-white rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.07)] p-3.5 border border-black/[0.04] relative hover:shadow-[0_12px_28px_rgba(0,0,0,0.1)] transition-all">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-semibold tracking-wide px-2 py-1 rounded-full bg-[#e6f9f0] text-[#0a9a66]">Docs</span>
                    <div className="w-5 h-5 rounded-full bg-[#2ee5a0] flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-[13px] font-semibold leading-[1.25] text-[#1a1a22] line-through decoration-black/20">Onboard docs</div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="w-[26px] h-[26px] rounded-full bg-[#5eead4] border-[2.5px] border-white flex items-center justify-center text-[10px] font-bold text-[#0f6d5e]">LP</div>
                  </div>
                  <div className="absolute -left-2 -top-2 w-6 h-6 bg-white rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.12)] flex items-center justify-center float-badge2 border border-black/5">
                    <div className="w-3 h-3 rounded-[2px] bg-[#f2f2f5]"></div>
                  </div>
                </div>

                <div className="bg-white rounded-[18px] shadow-[0_8px_24px_rgba(0,0,0,0.07)] p-3.5 border border-black/[0.04] hover:shadow-[0_12px_28px_rgba(0,0,0,0.1)] transition-all">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-semibold tracking-wide px-2 py-1 rounded-full bg-[#fef3c7] text-[#b45309]">Release</span>
                    <div className="w-5 h-5 rounded-full bg-[#2ee5a0] flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-[13px] font-semibold leading-[1.25] text-[#1a1a22] line-through decoration-black/20">Deploy v2.1</div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="w-[26px] h-[26px] rounded-full bg-[#fde68a] border-[2.5px] border-white flex items-center justify-center text-[10px] font-bold text-[#8a5a00]">RK</div>
                    <span className="text-[11px] font-medium text-[#2ee5a0]">✓ Done</span>
                  </div>
                </div>

                <div className="absolute -right-4 top-[88px] w-[38px] h-[38px] rounded-[12px] bg-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] flex items-center justify-center float-badge border border-black/5">
                  <div className="w-[18px] h-[20px] rounded-[4px] border border-[#e5e5ea] bg-white flex flex-col gap-[2px] p-[3px] pt-[5px]">
                    <div className="h-[1.5px] bg-[#d0d0da] rounded-full w-full"></div>
                    <div className="h-[1.5px] bg-[#d0d0da] rounded-full w-[80%]"></div>
                    <div className="h-[1.5px] bg-[#d0d0da] rounded-full w-[60%]"></div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className="absolute -top-6 -right-8 w-16 h-16 rounded-[18px] bg-white/70 backdrop-blur shadow-[0_12px_32px_rgba(0,0,0,0.1)] rotate-12 float-badge2 hidden sm:flex items-center justify-center">
          <div className="w-8 h-1.5 rounded-full bg-[#8b8ee0]/40 mb-1"></div>
        </div>
        <div className="absolute -bottom-4 -left-6 w-12 h-12 rounded-full bg-[#2ee5a0]/90 shadow-[0_8px_20px_rgba(46,229,160,0.4)] flex items-center justify-center float-badge text-white text-[14px] font-bold">
          ✓
        </div>
      </div>
      
      {/* Email Confirmation Dialog */}
      <Dialog open={confirmEmailOpen} onOpenChange={setConfirmEmailOpen}>
        <DialogContent className="max-w-sm rounded-[24px] p-6 border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Confirm your email</DialogTitle>
            <DialogDescription className="text-[15px] text-slate-500 font-medium mt-2">
              We sent a verification link to <span className="font-bold text-slate-700">{email || "your inbox"}</span>. Open that email to finish creating your account, then you will be signed in automatically.
            </DialogDescription>
          </DialogHeader>
          <Button 
            type="button" 
            className="w-full h-12 rounded-[14px] mt-2 bg-slate-900 text-white font-bold" 
            onClick={() => setConfirmEmailOpen(false)}
          >
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
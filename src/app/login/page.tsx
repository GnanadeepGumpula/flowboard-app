"use client";

import { useState, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen w-full flex flex-col-reverse lg:flex-row bg-white selection:bg-black selection:text-white antialiased overflow-hidden" style={{ fontFamily: "var(--font-sans), Inter, -apple-system, sans-serif" }}>
      {/* Embedded Styles for custom keyframes required by the original HTML */}
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
        input::placeholder { color: #a3a3a3; }
      `}</style>

      {/* --- LEFT SIDE: Login Form --- */}
      <div className="w-full lg:w-[52%] bg-white flex flex-col relative shrink-0">
        
        {/* Header Logo */}
        <div className="px-6 sm:px-10 lg:px-12 xl:px-14 pt-7 pb-6 flex items-center gap-2.5">
          <div className="w-[32px] h-[32px] rounded-[10px] bg-black flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M2 7.5C3.5 6 5.5 6 7 7.5C8.5 9 10.5 9 12 7.5C13.5 6 15.5 6 17 7.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M2 11.5C3.5 10 5.5 10 7 11.5C8.5 13 10.5 13 12 11.5C13.5 10 15.5 10 17 11.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
            </svg>
          </div>
          <span className="text-[17px] font-semibold tracking-tight text-black">Flowboard</span>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-12 xl:px-14 py-6 lg:py-0">
          <div className="w-full max-w-[440px]">
            <div className="mb-9">
              <h1 className="text-[38px] sm:text-[44px] lg:text-[48px] font-[800] leading-[0.95] tracking-[-0.03em] text-black">Welcome back</h1>
              <p className="mt-3.5 text-[15px] leading-6 text-[#6b6b76] font-[450]">Log in to your Flowboard workspace to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-[13.5px] font-semibold text-black mb-2 block">Email</label>
                <input 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="you@company.com" 
                  type="email" 
                  required
                  className="w-full h-[52px] bg-[#f6f6f7] border border-[#eeeeef] rounded-[14px] px-4 text-[15px] font-[450] text-black outline-none focus:bg-white focus:border-black focus:ring-[3px] focus:ring-black/10 transition-all placeholder:text-[#a0a0aa]" 
                />
              </div>

              <div>
                <label className="text-[13.5px] font-semibold text-black mb-2 block">Password</label>
                <div className="relative">
                  <input 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="••••••••••" 
                    type="password" 
                    required
                    className="w-full h-[52px] bg-[#f6f6f7] border border-[#eeeeef] rounded-[14px] px-4 text-[15px] font-[450] text-black outline-none focus:bg-white focus:border-black focus:ring-[3px] focus:ring-black/10 transition-all" 
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center transition-all ${rememberMe ? "bg-black border-black" : "bg-white border-[#d8d8dd] group-hover:border-black"}`}>
                    {rememberMe && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="hidden" />
                  <span className="text-[13.5px] font-medium text-[#2a2a30]">Remember me</span>
                </label>
                <Link href="#" className="text-[13.5px] font-semibold text-black underline underline-offset-[3px] decoration-[1.5px] hover:opacity-70 transition-opacity">
                  Forgot password?
                </Link>
              </div>

              <button type="submit" disabled={loading} className="w-full h-[56px] rounded-full bg-black text-white text-[17px] font-semibold tracking-[-0.01em] hover:bg-[#111] active:scale-[0.99] transition-all shadow-[0_8px_24px_rgba(0,0,0,0.16)] mt-1 flex items-center justify-center">
                {loading ? "Signing in..." : "Sign in"}
              </button>

              <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-[#ececef]"></div>
                <span className="text-[12.5px] font-medium text-[#9a9aa3] tracking-wide">or continue with</span>
                <div className="h-px flex-1 bg-[#ececef]"></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" className="h-[48px] rounded-full border border-[#e6e6ea] bg-white flex items-center justify-center gap-2.5 text-[14px] font-semibold text-black hover:border-black hover:bg-[#fafafa] transition-all active:scale-[0.98]">
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09A6.97 6.97 0 015.47 12c0-.71.12-1.4.33-2.05V7.11H2.18A11 11 0 001 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.11l3.66 2.84c.87-2.6 3.3-4.57 6.16-4.57z" />
                  </svg>
                  Google
                </button>
                <button type="button" className="h-[48px] rounded-full border border-[#e6e6ea] bg-white flex items-center justify-center gap-2.5 text-[14px] font-semibold text-black hover:border-black hover:bg-[#fafafa] transition-all active:scale-[0.98]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577v-2.165c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.085 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0112 5.803c1.02.005 2.047.138 3.006.405 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  GitHub
                </button>
              </div>

              <p className="text-center text-[14px] text-[#6b6b76] pt-3">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-semibold text-black underline underline-offset-[3px] decoration-[1.5px] hover:opacity-70">
                  Sign up
                </Link>
              </p>
            </form>
          </div>
        </div>
        <div className="h-6 lg:hidden"></div>
      </div>

      {/* --- RIGHT SIDE: Interactive Visuals --- */}
      <div 
        ref={rightPanelRef} 
        onMouseMove={handleMouseMove} 
        onMouseLeave={handleMouseLeave} 
        className="w-full lg:w-[48%] relative overflow-hidden flex items-center justify-center min-h-[520px] lg:min-h-screen" 
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
      
      {/* Mobile-only gradient overlay for seamless look */}
      <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#b8a9e8]/40 to-transparent pointer-events-none lg:hidden"></div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center font-medium text-slate-500">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
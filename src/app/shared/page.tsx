"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Share2, Sparkles, Folder, LayoutGrid, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Helper to match visual styling of cards
const getGradientStyle = (index: number) => {
  const gradients = [
    "linear-gradient(135deg, #10B981 0%, #3B82F6 100%)", // Green/Blue
    "linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)", // Purple/Pink
    "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)", // Orange/Red
    "linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)", // Purple/Blue
    "linear-gradient(135deg, #3B82F6 0%, #2DD4BF 100%)", // Blue/Teal
    "linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)"  // Pink/Rose
  ];
  return gradients[index % gradients.length];
};

export default function SharedSpacesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 1. Extracted loadBoards for silent background refreshing
  const loadBoards = useCallback(async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    setCurrentUserId(userId ?? null);

    if (!userId) {
      if (!isBackgroundRefresh) setLoading(false);
      return;
    }

    const { data: memberships } = await supabase
      .from("board_members")
      .select("board_id")
      .eq("user_id", userId)
      .eq("status", "Accepted");

    const boardIds = (memberships ?? []).map((entry: any) => entry.board_id).filter(Boolean);
    if (boardIds.length === 0) {
      setBoards([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("boards")
      .select("id, name, description, created_by")
      .in("id", boardIds)
      .neq("created_by", userId)
      .order("name");

    setBoards(data ?? []);
    setLoading(false);
  }, [supabase]);

  // 2. Initial Load
  useEffect(() => {
    loadBoards(false);
  }, [loadBoards]);

  // 3. Real-time Subscription for Shared Boards
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`realtime:shared_${currentUserId}`)
      // Listen for membership changes (e.g., getting added/removed from a board, or accepting an invite)
      .on("postgres_changes", { event: "*", schema: "public", table: "board_members", filter: `user_id=eq.${currentUserId}` }, () => {
        loadBoards(true);
      })
      // Listen for board detail changes (e.g., if a shared board is renamed or deleted by the owner)
      .on("postgres_changes", { event: "*", schema: "public", table: "boards" }, () => {
        loadBoards(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadBoards, supabase]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center h-full">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-10 w-10 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-medium">Loading shared boards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pt-4 max-w-[1200px] mx-auto">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold text-slate-900 tracking-tight">Shared Spaces</h1>
          <p className="mt-1 text-[15px] font-medium text-slate-500">Boards that were shared with you by your team</p>
        </div>
      </div>

      {/* Boards Grid Section */}
      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-200 bg-white/50 px-8 py-24 text-center">
          <div className="mb-5 rounded-[16px] bg-[#10B981] p-4 text-white shadow-xl shadow-[#10B981]/20">
            <Users className="h-8 w-8" />
          </div>
          <h2 className="text-[22px] font-extrabold text-slate-900">No shared boards yet</h2>
          <p className="mt-2 max-w-sm text-[15px] font-medium text-slate-500">
            When teammates invite you to collaborate on their boards, they will appear right here.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {boards.map((board, index) => {
            return (
              <Link 
                href={`/boards/${board.id}`} 
                key={board.id} 
                className="group relative rounded-[24px] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] overflow-hidden flex flex-col h-[260px]"
              >
                
                {/* Colorful Top Gradient Area */}
                <div 
                  className="h-[100px] w-full p-5 relative" 
                  style={{ background: getGradientStyle(index) }}
                >
                  <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]"></div>
                  {/* Shared Tag */}
                  <div className="relative z-10 inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-md rounded-lg px-3 py-1.5 text-[12px] font-bold text-slate-800 shadow-sm">
                    <Share2 className="w-3.5 h-3.5 text-slate-600" />
                    Shared with you
                  </div>
                </div>

                {/* Card Content Area */}
                <div className="p-5 flex flex-col flex-1 relative -mt-4 bg-white rounded-t-[20px]">
                  <h3 className="text-[20px] font-bold text-slate-900 leading-tight mb-2 truncate">{board.name}</h3>
                  <p className="text-[14px] font-medium text-slate-500 line-clamp-2 leading-relaxed mb-auto">
                    {board.description || "A collaborative workspace shared with your team."}
                  </p>
                  
                  {/* Footer (Avatars + Action arrow) */}
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                    <div className="flex items-center">
                      <div className="flex -space-x-2">
                        {/* Mock Avatars matching image UI */}
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden shadow-sm z-30">
                          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${board.id}1`} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden shadow-sm z-20">
                          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${board.id}2`} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 shadow-sm -ml-2 relative z-0">
                        +
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 text-slate-400 group-hover:bg-[#8B5CF6] group-hover:text-white transition-colors">
                      <span className="font-bold text-[16px] leading-none mb-0.5">›</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
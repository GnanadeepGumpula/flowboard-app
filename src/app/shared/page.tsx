"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Share2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SharedSpacesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBoards = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        setLoading(false);
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
    };
    loadBoards();
  }, [supabase]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-500">Shared spaces</p>
        <h1 className="mt-2 text-3xl font-semibold">Boards shared with you</h1>
        <p className="mt-2 text-sm text-slate-500">Only boards that were shared with you and accepted are listed here.</p>
      </div>
      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-sm text-slate-500">Loading shared boards...</div>
      ) : boards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-sm text-slate-500">No accepted shared boards yet.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {boards.map((board) => (
            <Link key={board.id} href={`/boards/${board.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><Share2 className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold">{board.name}</p>
                  <p className="text-sm text-slate-500">{board.description || "Shared workspace"}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

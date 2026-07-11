"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, LayoutGrid, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BoardSummary {
  id: string;
  name: string;
  description: string | null;
  project_id: string | null;
  project_name: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBoards = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        router.replace("/login");
        return;
      }

      const [{ data: ownedBoards }, { data: memberBoards }] = await Promise.all([
        supabase.from("boards").select("id, name, description, project_id, created_by").eq("created_by", userId).order("name"),
        supabase.from("board_members").select("board_id").eq("user_id", userId).eq("status", "Accepted"),
      ]);

      const memberBoardIds = (memberBoards ?? []).map((entry: any) => entry.board_id).filter(Boolean);
      const { data: sharedBoards } = memberBoardIds.length > 0
        ? await supabase.from("boards").select("id, name, description, project_id, created_by").in("id", memberBoardIds).order("name")
        : { data: [] };

      const combinedBoards = [...(ownedBoards ?? []), ...(sharedBoards ?? [])];
      const uniqueBoards = combinedBoards.filter((board, index, self) => index === self.findIndex((entry) => entry.id === board.id));

      const boardsWithProjects = await Promise.all(uniqueBoards.map(async (board) => {
        const { data: projectData } = await supabase.from("projects").select("name").eq("id", board.project_id).single();
        return { ...board, project_name: projectData?.name ?? null } as BoardSummary;
      }));

      setBoards(boardsWithProjects);
      setLoading(false);
    };
    loadBoards();
  }, [router, supabase]);

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading boards...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-500">Overview</p>
          <h1 className="mt-2 text-3xl font-semibold">Recent boards</h1>
          <p className="mt-2 text-sm text-slate-500">Pick up where you left off or create a new board.</p>
        </div>
        <Link href="/boards/new"><Button>New board</Button></Link>
      </div>
      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 px-8 py-20 text-center">
          <div className="mb-4 rounded-2xl bg-indigo-600 p-4 text-white shadow-lg">
            <Sparkles className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-semibold">No boards yet</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">Start your first workflow, optionally connect it to a project, and invite teammates instantly.</p>
          <Button className="mt-6" onClick={() => router.push("/boards/new")}>Create your first board</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {boards.map((board) => (
            <Link href={`/boards/${board.id}`} key={board.id} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{board.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{board.description || "A focused collaboration board for this workflow."}</p>
                </div>
                <div className="rounded-full bg-indigo-50 p-2 text-indigo-600"><LayoutGrid className="h-4 w-4" /></div>
              </div>
              <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
                <CalendarDays className="h-4 w-4" />
                <span>{board.project_name ? `Project: ${board.project_name}` : "Standalone board"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

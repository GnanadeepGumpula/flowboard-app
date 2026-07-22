"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, LayoutGrid, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestBoard, setRequestBoard] = useState<BoardSummary | null>(null);
  const [requestRole, setRequestRole] = useState("Update Progress");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestEmail, setRequestEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 1. Extracted loadBoards to support silent background refreshing
  const loadBoards = useCallback(async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    setCurrentUserId(userId ?? null);
    setRequestEmail(userData.user?.email ?? "");
    
    if (!userId) {
      if (!isBackgroundRefresh) router.replace("/login");
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

    // Only handle the request_board URL param on the initial load, not background refreshes
    if (!isBackgroundRefresh) {
      const requestBoardId = searchParams.get("request_board");
      if (requestBoardId) {
        const alreadyHasAccess = uniqueBoards.some((b) => b.id === requestBoardId);
        if (alreadyHasAccess) {
          toast.info("You already have access to this board.");
          setLoading(false);
          router.push(`/boards/${requestBoardId}`);
          return;
        }

        setRequestBoard({ id: requestBoardId, name: "Loading board...", description: null, project_id: null, project_name: null } as BoardSummary);
        setRequestOpen(true);
        const { data: requestBoardData } = await supabase.from("boards").select("id, name, description, project_id").eq("id", requestBoardId).single();
        if (requestBoardData) {
          const { data: requestProjectData } = requestBoardData.project_id
            ? await supabase.from("projects").select("name").eq("id", requestBoardData.project_id).single()
            : { data: null };

          setRequestBoard({ ...requestBoardData, project_name: requestProjectData?.name ?? null } as BoardSummary);
        }
      }
    }

    setLoading(false);
  }, [router, searchParams, supabase]);

  // 2. Initial Load
  useEffect(() => {
    loadBoards(false);
  }, [loadBoards]);

  // 3. Real-time Subscription for the Dashboard
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`realtime:dashboard_${currentUserId}`)
      // Refresh if any board changes
      .on("postgres_changes", { event: "*", schema: "public", table: "boards" }, () => {
        loadBoards(true);
      })
      // Refresh if any project changes (e.g., project renamed)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => {
        loadBoards(true);
      })
      // Refresh if this user's board memberships change
      .on("postgres_changes", { event: "*", schema: "public", table: "board_members", filter: `user_id=eq.${currentUserId}` }, () => {
        loadBoards(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadBoards, supabase]);

  const sendAccessRequest = async () => {
    if (!requestBoard) return;
    setRequestLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const requester = userData.user;
    if (!requester) {
      toast.error("You need to sign in first.");
      setRequestLoading(false);
      router.push(`/login?next=/dashboard?request_board=${requestBoard.id}`);
      return;
    }

    const { error: upsertError } = await supabase.from("board_members").upsert({
      board_id: requestBoard.id,
      user_id: requester.id,
      role: requestRole,
      status: "Pending",
    }, { onConflict: "board_id,user_id" });

    if (upsertError) {
      toast.error("Unable to send request");
      setRequestLoading(false);
      return;
    }

    const { data: boardDetail } = await supabase.from("boards").select("name, description, created_by, project_id").eq("id", requestBoard.id).single();
    const { data: projectDetail } = boardDetail?.project_id ? await supabase.from("projects").select("name").eq("id", boardDetail.project_id).single() : { data: null };
    const { data: ownerData } = await supabase.from("profiles").select("id, email").eq("id", boardDetail?.created_by).single();

    if (ownerData?.id) {
      await supabase.rpc("create_notification", {
        p_user_id: ownerData.id,
        p_title: "Board access request",
        p_message: `${requester.email || requestEmail || "A teammate"} requested access to "${boardDetail?.name || requestBoard.name}".`,
        p_type: "board_access_request",
        p_related_id: requestBoard.id,
        p_metadata: {
          board_id: requestBoard.id,
          board_name: boardDetail?.name || requestBoard.name,
          board_description: boardDetail?.description || requestBoard.description,
          project_name: projectDetail?.name || requestBoard.project_name,
          requester_id: requester.id,
          requester_email: requester.email || requestEmail,
          requested_role: requestRole,
        },
      });
    }

    toast.success("Access request sent");
    setRequestLoading(false);
    setRequestOpen(false);
  };

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

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Access</DialogTitle>
            <DialogDescription>Ask the board owner for access using your login email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Login email</Label>
              <Input value={requestEmail} disabled />
            </div>
            <div>
              <Label>Board name</Label>
              <Input value={requestBoard?.name || ""} disabled />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={requestBoard?.description || ""} disabled />
            </div>
            <div>
              <Label>Desired role</Label>
              <Select value={requestRole} onValueChange={setRequestRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="View Only">View Only</SelectItem>
                  <SelectItem value="Update Progress">Update Progress</SelectItem>
                  <SelectItem value="Add/Delete Task">Add/Delete Task</SelectItem>
                  <SelectItem value="Editor">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={sendAccessRequest} disabled={requestLoading}>{requestLoading ? "Sending..." : "Send Request"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
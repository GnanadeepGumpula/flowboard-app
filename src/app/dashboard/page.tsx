"use client";

import { useEffect, useMemo, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, LayoutGrid, Sparkles, Filter, Download, ArrowUpRight, Folder, Users, CheckCircle2 } from "lucide-react";
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

// Function to generate the soft gradient backgrounds based on index to match the image UI
const getGradientStyle = (index: number) => {
  const gradients = [
    "linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)", // Purple/Blue
    "linear-gradient(135deg, #3B82F6 0%, #2DD4BF 100%)", // Blue/Teal
    "linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)", // Purple/Pink
    "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)", // Orange/Red
    "linear-gradient(135deg, #10B981 0%, #3B82F6 100%)", // Green/Blue
    "linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)"  // Pink/Rose
  ];
  return gradients[index % gradients.length];
};

function DashboardContent() {
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
  const [stats, setStats] = useState({ totalBoards: 0, activeProjects: 0, teamMembers: 0 });

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

    // Load Stats 
    const { count: projectsCount } = await supabase.from("projects").select("*", { count: 'exact', head: true }).eq("created_by", userId);
    
    // Calculate unique members across all boards accessible
    const allAccessibleBoardIds = uniqueBoards.map(b => b.id);
    let uniqueMembersCount = 0;
    if (allAccessibleBoardIds.length > 0) {
      const { data: allMembers } = await supabase.from("board_members").select("user_id").in("board_id", allAccessibleBoardIds);
      uniqueMembersCount = new Set((allMembers ?? []).map(m => m.user_id)).size;
    }

    setStats({
      totalBoards: uniqueBoards.length,
      activeProjects: projectsCount || 0,
      teamMembers: uniqueMembersCount || 0
    });

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
      .on("postgres_changes", { event: "*", schema: "public", table: "boards" }, () => {
        loadBoards(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => {
        loadBoards(true);
      })
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
    return <div className="py-20 flex justify-center items-center h-full"><div className="animate-pulse flex flex-col items-center"><div className="h-10 w-10 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin"></div><p className="mt-4 text-slate-500 font-medium">Loading boards...</p></div></div>;
  }

  return (
    <div className="space-y-6 lg:space-y-8 py-6 lg:py-8 px-5 lg:px-8">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-[20px] shadow-sm border border-slate-100 p-5 lg:p-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-slate-900">Overview</h1>
          <p className="mt-1 text-[15px] font-medium text-slate-500">Recent boards • Pick up where you left off</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-xl h-10 px-4 font-bold border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50">
            <Filter className="w-4 h-4 mr-2 text-slate-500" /> Filter
          </Button>
          <Button variant="outline" className="rounded-xl h-10 px-4 font-bold border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50">
            <Download className="w-4 h-4 mr-2 text-slate-500" /> Export
          </Button>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Total Boards Stat */}
        <div className="bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[12px] bg-[#6366F1] text-white flex items-center justify-center shadow-md">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <span className="font-bold text-[15px] text-slate-900">Total Boards</span>
          </div>
          <div className="text-[42px] font-extrabold text-slate-900 leading-none mb-3">
            {stats.totalBoards}
          </div>
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#10B981] mt-auto">
            <ArrowUpRight className="w-4 h-4" /> 2 this month
          </div>
        </div>

        {/* Active Projects Stat */}
        <div className="bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[12px] bg-[#8B5CF6] text-white flex items-center justify-center shadow-md">
              <Folder className="w-5 h-5" />
            </div>
            <span className="font-bold text-[15px] text-slate-900">Active Projects</span>
          </div>
          <div className="text-[42px] font-extrabold text-slate-900 leading-none mb-3">
            {stats.activeProjects}
          </div>
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#10B981] mt-auto">
            <CheckCircle2 className="w-4 h-4" /> 1 completed
          </div>
        </div>

        {/* Team Members Stat */}
        <div className="bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[12px] bg-[#1E1B4B] text-white flex items-center justify-center shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <span className="font-bold text-[15px] text-slate-900">Team Members</span>
          </div>
          <div className="text-[42px] font-extrabold text-slate-900 leading-none mb-3">
            {stats.teamMembers}
          </div>
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-500 mt-auto">
            3 invited +
          </div>
        </div>

      </div>

      {/* Boards Grid Section */}
      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-200 bg-white/50 px-8 py-24 text-center">
          <div className="mb-5 rounded-[16px] bg-[#8B5CF6] p-4 text-white shadow-xl shadow-[#8B5CF6]/20">
            <Sparkles className="h-8 w-8" />
          </div>
          <h2 className="text-[22px] font-extrabold text-slate-900">No boards yet</h2>
          <p className="mt-2 max-w-sm text-[15px] font-medium text-slate-500">Start your first workflow, optionally connect it to a project, and invite teammates instantly.</p>
          <Button className="mt-8 rounded-xl h-12 px-6 font-bold bg-slate-900 text-white shadow-md hover:scale-105 transition-transform" onClick={() => router.push("/boards/new")}>
            Create your first board
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {boards.map((board, index) => {
            // Mocking progress for visual fidelity matching the image
            const mockProgress = [68, 42, 91][index % 3]; 
            
            return (
              <Link href={`/boards/${board.id}`} key={board.id} className="group relative rounded-[24px] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] overflow-hidden flex flex-col h-[280px]">
                
                {/* Colorful Top Gradient Area */}
                <div 
                  className="h-[100px] w-full p-5 relative" 
                  style={{ background: getGradientStyle(index) }}
                >
                  <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]"></div>
                  {/* Category Tag */}
                  <div className="relative z-10 inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-md rounded-lg px-3 py-1.5 text-[12px] font-bold text-slate-800 shadow-sm">
                    {board.project_name ? <Folder className="w-3.5 h-3.5 text-slate-600" /> : <LayoutGrid className="w-3.5 h-3.5 text-slate-600" />}
                    {board.project_name || "Standalone"}
                  </div>
                </div>

                {/* Card Content Area */}
                <div className="p-5 flex flex-col flex-1 relative -mt-4 bg-white rounded-t-[20px]">
                  <h3 className="text-[20px] font-bold text-slate-900 leading-tight mb-2 truncate">{board.name}</h3>
                  <p className="text-[14px] font-medium text-slate-500 line-clamp-2 leading-relaxed mb-auto">
                    {board.description || "A focused collaboration board for this workflow."}
                  </p>
                  
                  {/* Progress Bar */}
                  <div className="mt-4 mb-5">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[13px] font-bold text-slate-700">Progress</span>
                      <span className="text-[13px] font-bold text-slate-900">{mockProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#4F46E5] rounded-full" style={{ width: `${mockProgress}%` }}></div>
                    </div>
                  </div>

                  {/* Footer (Avatars + Date) */}
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center">
                      <div className="flex -space-x-2">
                        {/* Mock Avatars matching image UI */}
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden shadow-sm z-30">
                          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${board.id}1`} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden shadow-sm z-20">
                          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${board.id}2`} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden shadow-sm z-10">
                          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${board.id}3`} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 shadow-sm -ml-2 relative z-0">
                        +{Math.floor(Math.random() * 5) + 2}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-700">
                      <CalendarDays className="w-4 h-4 text-slate-400" />
                      Oct 30
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Request Access Glassmorphism Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-[24px] border-white/40 bg-white/60 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.12)] p-6">
          <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-white/40 rounded-[24px] pointer-events-none -z-10"></div>
          
          <DialogHeader className="relative z-10">
            <DialogTitle className="text-xl font-extrabold text-slate-900">Request Access</DialogTitle>
            <DialogDescription className="font-medium text-slate-600 mt-1.5">
              Request access to a board for your team
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-5 mt-5 relative z-10">
            <div>
              <Label className="font-bold text-slate-700 text-[13px]">Email</Label>
              <div className="mt-1.5 rounded-[12px] bg-slate-900/5 border border-slate-200/50 p-3 shadow-inner">
                <div className="text-[13px] font-medium text-slate-500 mb-1">{requestEmail || "you@company.com"}</div>
                <div className="text-[14px] font-bold text-slate-900">alex.chen@company.com</div>
              </div>
            </div>
            
            <div>
              <Label className="font-bold text-slate-700 text-[13px]">Board</Label>
              <div className="mt-1.5 h-11 rounded-[12px] bg-white/80 border border-slate-200/80 px-4 flex items-center justify-between shadow-sm">
                <span className="font-semibold text-[14px] text-slate-900 truncate pr-4">{requestBoard?.name || "Product Launch Q4"}</span>
                <span className="text-slate-400 font-bold">›</span>
              </div>
            </div>
            
            <div>
              <Label className="font-bold text-slate-700 text-[13px]">Role</Label>
              <Select value={requestRole} onValueChange={setRequestRole}>
                <SelectTrigger className="mt-1.5 h-11 rounded-[12px] bg-white/80 border border-slate-200/80 px-4 shadow-sm font-semibold text-[14px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[16px] shadow-xl border-slate-100">
                  <SelectItem value="View Only" className="font-medium">View Only</SelectItem>
                  <SelectItem value="Update Progress" className="font-medium">Update Progress</SelectItem>
                  <SelectItem value="Add/Delete Task" className="font-medium">Add/Delete Task</SelectItem>
                  <SelectItem value="Editor" className="font-medium">Editor</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[12px] font-medium text-slate-500 mt-2 ml-1">Can edit and comment on the board</p>
            </div>
            
            <div className="flex items-center gap-3 pt-2">
              <Button 
                variant="outline" 
                className="flex-1 h-11 rounded-[12px] font-bold bg-white/50 border-slate-200 hover:bg-white text-slate-700 shadow-sm"
                onClick={() => setRequestOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 h-11 rounded-[12px] font-bold bg-[#4338CA] hover:bg-[#3730A3] text-white shadow-md shadow-indigo-500/20"
                onClick={sendAccessRequest} 
                disabled={requestLoading}
              >
                {requestLoading ? "Sending..." : "Send Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Quick inline icon component to replace the missing CheckCircle2 import


export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="py-20 flex justify-center items-center h-full"><div className="animate-pulse flex flex-col items-center"><div className="h-10 w-10 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin"></div><p className="mt-4 text-slate-500 font-medium">Loading boards...</p></div></div>}>
      <DashboardContent />
    </Suspense>
  );
}
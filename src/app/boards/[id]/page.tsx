"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DndContext, closestCenter, DragOverlay, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  CalendarDays, CheckCircle2, Plus, Share2, Sparkles, Pencil, Trash2,
  ListTodo, Target, MoreHorizontal, Flame, Lightbulb, Leaf, Zap, Users
} from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import BoardChat from "@/components/BoardChat";
import LivePresence from "@/components/LivePresence";

interface BoardMember {
  id: string;
  user_id: string;
  role: "View Only" | "Update Progress" | "Add/Delete Task" | "Editor" | "Owner";
  status: string;
  profiles: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
}

interface TaskItem {
  id: string;
  board_id: string;
  name: string;
  description: string | null;
  status: "todo" | "inprogress" | "done";
  due_date: string | null;
  assigned_to: string[] | null;
  created_by?: string | null;
}

interface BoardData {
  id: string;
  name: string;
  description: string | null;
  project_id: string | null;
  created_by: string;
  projects?: { name: string | null } | null;
}

interface InviteDraft {
  id: string;
  email: string;
  role: string;
  status: "Added" | "Verified";
  verifiedUser?: { id: string; email: string | null; full_name: string | null } | null;
}

const CURSOR_COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899"];

function Clock3Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16.5 12"/>
    </svg>
  );
}

const columns = [
  { 
    key: "todo", 
    title: "To Do", 
    bg: "bg-[#FFDFD4]/60", 
    headerBg: "bg-gradient-to-r from-[#FFD3C4] to-[#FFE6DF]",
    text: "text-slate-900", 
    icon: <ListTodo className="h-5 w-5 text-[#E05A33]" />,
    badgeColor: "bg-[#E05A33] text-white"
  },
  { 
    key: "inprogress", 
    title: "In Progress", 
    bg: "bg-[#E5D4FF]/60", 
    headerBg: "bg-gradient-to-r from-[#D7BFFF] to-[#E9D6FF]",
    text: "text-slate-900", 
    icon: <Clock3Icon className="h-5 w-5 text-[#8B5CF6]" />,
    badgeColor: "bg-[#8B5CF6] text-white"
  },
  { 
    key: "done", 
    title: "Done", 
    bg: "bg-[#C6F0E4]/60", 
    headerBg: "bg-gradient-to-r from-[#A5EBD5] to-[#C9F3E8]",
    text: "text-slate-900", 
    icon: <CheckCircle2 className="h-5 w-5 text-[#10B981]" />,
    badgeColor: "bg-white text-slate-700 border border-slate-200"
  },
] as const;

const columnKeys = columns.map((column) => column.key);

const canManageBoard = (role?: string | null) => role === "Owner" || role === "Editor";
const canManageTasks = (role?: string | null) => role === "Owner" || role === "Editor" || role === "Add/Delete Task";
const canUpdateProgress = (role?: string | null) => canManageTasks(role) || role === "Update Progress";

const getPriorityStyling = (status: string, id: string) => {
  const charCode = id ? id.charCodeAt(0) : 0;
  if (status === 'todo') {
    if (charCode % 3 === 0) return { label: "High Priority", bg: "bg-[#EF4444]", icon: <Flame className="w-3 h-3 text-white" />, border: "border-l-[#EF4444]" };
    if (charCode % 3 === 1) return { label: "Medium Priority", bg: "bg-[#8B5CF6]", icon: <Lightbulb className="w-3 h-3 text-white" />, border: "border-l-[#8B5CF6]" };
    return { label: "Low Priority", bg: "bg-[#10B981]", icon: <Leaf className="w-3 h-3 text-white" />, border: "border-l-[#10B981]" };
  }
  if (status === 'inprogress') {
    return { label: "In Progress", bg: "bg-[#8B5CF6]", icon: <Zap className="w-3 h-3 text-white fill-current" />, border: "border-l-[#8B5CF6]" };
  }
  return { label: "Done", bg: "bg-[#10B981]", icon: <CheckCircle2 className="w-3 h-3 text-white" />, border: "border-l-[#10B981]" };
};

function SortableTaskCard({ task, members }: { task: TaskItem; members: BoardMember[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
  };
  
  const assignedMember = task.assigned_to ? members.find((member) => task.assigned_to?.includes(member.user_id)) : undefined;
  const initials = (assignedMember?.profiles?.full_name || assignedMember?.profiles?.email || "U").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const priority = getPriorityStyling(task.status, task.id);

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className={`cursor-grab relative rounded-[20px] bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md border border-slate-100 border-l-[6px] ${priority.border} ${
        isDragging ? "opacity-50 shadow-none pointer-events-none scale-105 rotate-1" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-sm ${priority.bg}`}>
          {priority.icon} {priority.label}
        </div>
      </div>
      
      <h3 className="text-[15px] font-bold text-slate-900 leading-snug mb-2">{task.name}</h3>
      <p className="line-clamp-2 text-[13px] font-medium text-slate-600 mb-4">{task.description || "Add more detail to this task."}</p>
      
      <div className="mt-auto flex items-center justify-between">
        <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-bold ${
          task.status === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
        }`}>
          {task.status === 'done' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <CalendarDays className="w-3.5 h-3.5" />}
          {task.status === 'done' ? `Completed ${task.due_date ? format(new Date(task.due_date), "MMM d") : ""}` : (task.due_date ? `Due ${format(new Date(task.due_date), "MMM d")}` : "No date")}
        </div>
        
        <div className="flex items-center gap-1">
          {assignedMember ? (
            assignedMember.profiles?.avatar_url ? (
              <img src={assignedMember.profiles.avatar_url} alt="Assignee" className="h-7 w-7 rounded-full border-2 border-white object-cover shadow-sm" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-[10px] font-bold text-white shadow-sm">{initials}</div>
            )
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-bold text-slate-500 shadow-sm">?</div>
          )}
          <button className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full p-1 transition-colors">
             <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function BoardColumn({ column, columnTasks, members }: { column: (typeof columns)[number]; columnTasks: TaskItem[]; members: BoardMember[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div ref={setNodeRef} className={`flex min-h-[500px] flex-col rounded-[32px] p-3 shadow-sm transition-all duration-200 ${column.bg} ${isOver ? "ring-2 ring-indigo-400 opacity-90 scale-[1.01]" : ""}`}>
      <div className={`mb-3 flex items-center justify-between rounded-2xl px-4 py-3 shadow-sm ${column.headerBg}`}>
        <div className="flex items-center gap-2.5">
          <div className="bg-white/60 p-1.5 rounded-lg shadow-sm">
            {column.icon}
          </div>
          <h2 className={`font-bold text-[17px] ${column.text}`}>{column.title}</h2>
        </div>
        <div className={`flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-[12px] font-bold shadow-sm ${column.badgeColor}`}>
          {columnTasks.length}
        </div>
      </div>
      
      <SortableContext items={columnTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div id={column.key} className="flex-1 space-y-3 overflow-y-auto px-1 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {columnTasks.map((task) => <SortableTaskCard key={task.id} task={task} members={members} />)}
        </div>
      </SortableContext>
    </div>
  );
}

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const boardId = params?.id as string;
  const supabase = useMemo(() => createClient(), []);

  const [board, setBoard] = useState<BoardData | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [taskName, setTaskName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskStatus, setTaskStatus] = useState<"todo" | "inprogress" | "done">("todo");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("unassigned");
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const [inviteDraftEmail, setInviteDraftEmail] = useState("");
  const [inviteRows, setInviteRows] = useState<InviteDraft[]>([]);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const [pendingDeleteInvite, setPendingDeleteInvite] = useState<{ id: string; label: string } | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [editingBoard, setEditingBoard] = useState(false);
  const [boardNameInput, setBoardNameInput] = useState("");
  const [boardDescriptionInput, setBoardDescriptionInput] = useState("");
  const [boardSaving, setBoardSaving] = useState(false);
  const [inviteRoleOptions] = useState<string[]>(["View Only", "Update Progress", "Add/Delete Task", "Editor", "Owner"]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ full_name: string | null; email: string | null; avatar_url: string | null } | null>(null);
  
  const [onlineUsers, setOnlineUsers] = useState<Map<string, any>>(new Map());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 2 } }));

  const loadBoardData = async (isBackgroundRefresh = false) => {
    if (!boardId) return;
    if (!isBackgroundRefresh) setLoading(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      setCurrentUserId(userData.user?.id ?? null);

      if (userData.user?.id) {
        const { data: profile } = await supabase.from("profiles").select("full_name, email, avatar_url").eq("id", userData.user.id).single();
        setCurrentUserProfile(profile);
      }
      
      const [{ data: boardData }, { data: membersData }, { data: tasksData }] = await Promise.all([
        supabase.from("boards").select("id, name, description, project_id, created_by").eq("id", boardId).single(),
        supabase.from("board_members").select("id, user_id, role, status").eq("board_id", boardId),
        supabase.from("tasks").select("id, board_id, name, description, status, due_date, assigned_to, created_by").eq("board_id", boardId).order("id"),
      ]);

      const memberUserIds = [...new Set((membersData ?? []).map((member: any) => member.user_id).filter(Boolean))];
      let profilesByUserId = new Map<string, any>();
      if (memberUserIds.length > 0) {
        const { data: profilesData } = await supabase.from("profiles").select("id, email, full_name, avatar_url").in("id", memberUserIds);
        (profilesData ?? []).forEach((profile: any) => profilesByUserId.set(profile.id, profile));
      }

      let projectName: string | null = null;
      if (boardData?.project_id) {
        const { data: projectData } = await supabase.from("projects").select("name").eq("id", boardData.project_id).single();
        projectName = projectData?.name ?? null;
      }

      setBoard({
        id: boardData?.id ?? boardId,
        name: boardData?.name ?? "Untitled board",
        description: boardData?.description ?? null,
        project_id: boardData?.project_id ?? null,
        created_by: boardData?.created_by ?? "",
        projects: projectName ? { name: projectName } : null,
      } as BoardData);
      
      setMembers(
        (membersData ?? []).map((member: any) => ({
          ...member,
          profiles: profilesByUserId.get(member.user_id) ?? null,
        })) as BoardMember[],
      );
      
      setTasks((tasksData ?? []) as TaskItem[]);
    } catch (err) {
      console.error("Error loading board data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (boardId) loadBoardData();
  }, [boardId]);

  useEffect(() => {
    if (!boardId || !currentUserId || !currentUserProfile) return;

    const presenceChannel = supabase.channel(`presence:board_${boardId}`, {
      config: { presence: { key: currentUserId } },
    });

    presenceChannel.on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      const users = new Map();
      for (const [key, presenceArray] of Object.entries(state)) {
        if (presenceArray.length > 0) {
          const p = presenceArray[0] as any;
          let hash = 0;
          for (let i = 0; i < p.user_id.length; i++) hash = p.user_id.charCodeAt(i) + ((hash << 5) - hash);
          const color = CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
          users.set(key, { ...p, color });
        }
      }
      setOnlineUsers(users);
    });

    presenceChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({
          user_id: currentUserId,
          full_name: currentUserProfile.full_name || currentUserProfile.email || "Teammate",
          avatar_url: currentUserProfile.avatar_url,
        });
      }
    });

    const dbChannel = supabase
      .channel(`realtime:board_${boardId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `board_id=eq.${boardId}` }, (payload) => {
        if (payload.eventType === "INSERT") setTasks((current) => current.some((t) => t.id === payload.new.id) ? current : [...current, payload.new as TaskItem]);
        else if (payload.eventType === "UPDATE") setTasks((current) => current.map((t) => (t.id === payload.new.id ? (payload.new as TaskItem) : t)));
        else if (payload.eventType === "DELETE") setTasks((current) => current.filter((t) => t.id !== payload.old.id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "board_members", filter: `board_id=eq.${boardId}` }, () => {
        loadBoardData(true);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "boards", filter: `id=eq.${boardId}` }, (payload) => {
        setBoard((current) => current ? { ...current, name: payload.new.name, description: payload.new.description } : null);
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(presenceChannel); 
      supabase.removeChannel(dbChannel); 
    };
  }, [boardId, currentUserId, currentUserProfile, supabase]);

  const resetTaskForm = () => {
    setTaskName("");
    setTaskDescription("");
    setTaskStatus("todo");
    setTaskDueDate("");
    setTaskAssignees([]);
    setTaskModalOpen(false);
  };

  const addInviteDraft = () => {
    const email = inviteDraftEmail.trim().toLowerCase();
    if (!email) return;
    if (inviteRows.some((row) => row.email.toLowerCase() === email)) { toast.error("Email already queued."); return; }
    setInviteRows((current) => [...current, { id: crypto.randomUUID(), email, role: "Update Progress", status: "Added", verifiedUser: null }]);
    setInviteDraftEmail("");
  };

  const updateInviteDraft = (draftId: string, updates: Partial<InviteDraft>) => {
    setInviteRows((current) => current.map((row) => (row.id === draftId ? { ...row, ...updates } : row)));
  };

  const verifyInviteDraft = async (draft: InviteDraft) => {
    setInviteActionId(draft.id);
    const { data } = await supabase.from("profiles").select("id, email, full_name").eq("email", draft.email).single();
    if (!data) { toast.error("User must create an account first."); setInviteActionId(null); return; }
    updateInviteDraft(draft.id, { status: "Verified", verifiedUser: data });
    toast.success("User verified");
    setInviteActionId(null);
  };

  const sendInviteDraft = async (draft: InviteDraft) => {
    if (!draft.verifiedUser || !boardId) return;
    setInviteActionId(draft.id);
    const { error } = await supabase.from("board_members").insert({ board_id: boardId, user_id: draft.verifiedUser.id, role: draft.role, status: "Pending" });
    if (error) { toast.error("Unable to send invite"); setInviteActionId(null); return; }
    setInviteRows((current) => current.filter((row) => row.id !== draft.id));
    setInviteActionId(null);
    toast.success("Invitation sent");
    loadBoardData();
  };

  const saveTask = async () => {
    if (!taskName.trim() || !boardId) return;
    if (!canCreateTaskAllowed) { toast.error("No permission to create tasks."); return; }
    if (!currentUserId) { toast.error("Please sign in first."); return; }

    setTaskLoading(true);
    const payload = {
      board_id: boardId,
      created_by: currentUserId,
      name: taskName,
      description: taskDescription,
      status: taskStatus,
      due_date: taskDueDate || null,
      assigned_to: taskAssignees.length === 0 ? null : (typeof (taskAssignees as any)[0] === 'object' ? (taskAssignees as any)[0].id : (taskAssignees as any)[0]),
    };
    
    const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
    if (error || !data) { toast.error(error?.message || "Unable to create task"); setTaskLoading(false); return; }
    
    setTasks((current) => [...current, { ...payload, id: data.id, created_by: currentUserId } as TaskItem]);
    toast.success("Task created");
    resetTaskForm();
    setTaskLoading(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(tasks.find((item) => item.id === String(event.active.id)) ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over, active } = event;
    setActiveTask(null);
    if (!over || active.id === over.id) return;
    if (!canUpdateProgress(currentUserRole)) { toast.error("No permission to move tasks."); return; }

    const taskId = String(active.id);
    const overId = String(over.id);
    const nextStatus = columnKeys.includes(overId as typeof columnKeys[number]) ? (overId as "todo" | "inprogress" | "done") : tasks.find((task) => task.id === overId)?.status;

    if (!nextStatus) return;
    const previousTasks = tasks;
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask || currentTask.status === nextStatus) return;

    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task)));

    try {
      const { error } = await supabase.from("tasks").update({ status: nextStatus }).eq("id", taskId);
      if (error) throw error;
    } catch {
      setTasks(previousTasks);
      toast.error("Failed to move task");
    }
  };

  const updateMemberRole = async (memberId: string, role: BoardMember["role"]) => {
    if (!isCurrentUserOwner) { toast.error("No permission to update member roles."); return; }
    const { error } = await supabase.from("board_members").update({ role }).eq("id", memberId);
    if (error) { toast.error("Unable to update member access"); return; }
    setMembers((current) => current.map((member) => member.id === memberId ? { ...member, role } : member));
    toast.success("Access updated");
  };

  const removeMember = async (memberId: string) => {
    if (!isCurrentUserOwner) { toast.error("No permission to remove members."); return; }
    const { error } = await supabase.from("board_members").delete().eq("id", memberId);
    if (error) { toast.error("Unable to remove member"); return; }
    setMembers((current) => current.filter((member) => member.id !== memberId));
    toast.success("Member removed");
  };

  const cancelInviteRequest = async () => {
    if (!isCurrentUserOwnerOnly || !pendingDeleteInvite) return;
    const member = members.find((item) => item.id === pendingDeleteInvite.id);
    if (!member) { setPendingDeleteInvite(null); return; }
    const { error } = await supabase.from("board_members").delete().eq("id", member.id);
    if (error) { toast.error("Unable to delete request"); return; }
    setMembers((current) => current.filter((item) => item.id !== member.id));
    setPendingDeleteInvite(null);
    toast.success("Request deleted");
  };

  const copyShareLink = async () => {
    if (!canManageBoard(currentUserRole)) { toast.error("No permission to generate share links."); return; }
    await navigator.clipboard.writeText(`${window.location.origin}/dashboard?request_board=${boardId}`);
    toast.success("Share link copied");
  };

  const handleDeleteBoard = async () => {
    if (!isCurrentUserOwnerOnly) { toast.error("No permission to delete board."); return; }
    const { error } = await supabase.from("boards").delete().eq("id", boardId);
    if (error) { toast.error("Unable to delete board"); return; }
    toast.success("Board deleted");
    router.push("/dashboard");
  };

  const currentUserRole = currentUserId ? members.find((member) => member.user_id === currentUserId)?.role ?? null : null;
  const isCurrentUserOwner = Boolean(currentUserId && (board?.created_by === currentUserId || currentUserRole === "Owner"));
  const isCurrentUserOwnerOnly = isCurrentUserOwner;
  const canCreateTaskAllowed = canManageTasks(currentUserRole);

  const onlineArray = Array.from(onlineUsers.values());

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const inProgressTasks = tasks.filter((t) => t.status === "inprogress").length;
  const todoTasks = tasks.filter((t) => t.status === "todo").length;
  
  // Progress formula updated so In Progress counts as 50%
  const completionRate = totalTasks === 0 ? 0 : Math.round(((doneTasks * 1) + (inProgressTasks * 0.5)) / totalTasks * 100);

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center h-screen bg-transparent">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-10 w-10 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-medium">Loading board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-10 font-sans">
      <div className="max-w-[1400px] mx-auto pt-4 md:pt-8">
        
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            {!editingBoard ? (
              <div className="min-w-0 flex-1">
                <h1 className="text-[28px] md:text-[40px] font-extrabold text-slate-900 tracking-tight flex items-center gap-2 md:gap-3 truncate">
                  <span className="truncate">{board?.name}</span>
                </h1>
                <p className="text-[14px] md:text-[15px] text-slate-600 mt-1 md:mt-2 font-medium leading-relaxed truncate hidden md:block">
                  {board?.description || "Launch the new marketing site for Q3 — landing pages, analytics, and campaign tracking"}
                </p>
              </div>
            ) : (
              <div className="space-y-3 flex-1 max-w-2xl bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <Input value={boardNameInput} onChange={(e) => setBoardNameInput(e.target.value)} placeholder="Board name" className="text-lg font-bold" />
                <Input value={boardDescriptionInput} onChange={(e) => setBoardDescriptionInput(e.target.value)} placeholder="Description" />
                <div className="flex gap-2">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={async () => { setBoardSaving(true); const { error } = await supabase.from("boards").update({ name: boardNameInput.trim(), description: boardDescriptionInput.trim() }).eq("id", boardId); setBoardSaving(false); if (error) { toast.error("Failed to save"); return; } toast.success("Saved"); setEditingBoard(false); loadBoardData(true); }} disabled={boardSaving}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingBoard(false)}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              
              {/* Online Users driven by Supabase Presence - hidden on very small screens */}
              <div className="hidden sm:flex items-center bg-white/70 backdrop-blur-md rounded-full pl-2 pr-4 py-1.5 border border-white shadow-sm">
                <div className="flex -space-x-3 mr-4">
                  {onlineArray.slice(0, 4).map((user, i) => (
                    <div key={user.user_id} className="h-8 w-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden shadow-sm relative" style={{ zIndex: 10 - i }}>
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center font-bold text-white text-[11px]" style={{ backgroundColor: user.color || '#8B5CF6' }}>
                          {user.full_name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
                  {onlineArray.length > 4 && (
                    <div className="h-8 w-8 rounded-full border-2 border-white bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shadow-sm relative" style={{ zIndex: 1 }}>+{onlineArray.length - 4}</div>
                  )}
                  {onlineArray.length === 0 && (
                    <div className="h-8 w-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center shadow-sm relative">
                      <span className="text-[10px] font-bold text-slate-400">?</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 bg-[#F1EBFF] text-[#8B5CF6] text-xs font-bold px-2.5 py-1 rounded-full">
                  {onlineArray.length} online <span className="w-2 h-2 rounded-full bg-[#10B981] ml-0.5"></span>
                </div>
              </div>

              {canCreateTaskAllowed && (
                <Button className="bg-gradient-to-r from-[#A555F5] to-[#EC4899] hover:opacity-90 text-white font-bold rounded-xl h-11 w-11 md:w-auto md:px-6 shadow-md border-0 transition-transform active:scale-95 flex items-center justify-center gap-2 p-0 md:p-auto" onClick={() => { setTaskStatus("todo"); setTaskModalOpen(true); }}>
                  <Plus className="w-[18px] h-[18px]" />
                  <span className="hidden md:inline">Add Task</span>
                </Button>
              )}

              {/* 3-dots actions menu */}
              {/* 3-dots actions menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-11 w-11 rounded-[14px] bg-white border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 transition-colors shrink-0 outline-none">
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-[16px] p-2 shadow-xl border-slate-100 mt-1 z-50 bg-white/95 backdrop-blur-xl">
                  {canManageBoard(currentUserRole) && (
                    <>
                      <DropdownMenuItem className="rounded-[10px] font-bold text-slate-700 cursor-pointer p-3 hover:bg-slate-50 hover:text-slate-900 outline-none" onClick={() => setEditingBoard(true)}>
                        <Pencil className="w-4 h-4 mr-2.5 text-slate-500" /> Edit Board
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-[10px] font-bold text-slate-700 cursor-pointer p-3 hover:bg-slate-50 hover:text-slate-900 outline-none" onClick={copyShareLink}>
                        <Share2 className="w-4 h-4 mr-2.5 text-slate-500" /> Share Link
                      </DropdownMenuItem>
                    </>
                  )}
                  {canManageTasks(currentUserRole) && (
                    <DropdownMenuItem className="rounded-[10px] font-bold text-slate-700 cursor-pointer p-3 hover:bg-slate-50 hover:text-slate-900 outline-none" onClick={() => setInviteModalOpen(true)}>
                      <Users className="w-4 h-4 mr-2.5 text-slate-500" /> Invite / Members
                    </DropdownMenuItem>
                  )}
                  {isCurrentUserOwnerOnly && (
                    <>
                      <div className="h-px bg-slate-100 my-1 mx-2" />
                      <DropdownMenuItem className="rounded-[10px] font-bold cursor-pointer p-3 text-rose-600 focus:text-rose-600 focus:bg-rose-50 outline-none" onClick={async () => { const { error } = await supabase.from("boards").delete().eq("id", boardId); if (error) { toast.error("Unable to delete board"); return; } toast.success("Board deleted"); router.push("/dashboard"); }}>
                        <Trash2 className="w-4 h-4 mr-2.5" /> Delete Board
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

            </div>
          </div>
          
          <p className="text-[14px] text-slate-600 mt-2 font-medium leading-relaxed md:hidden">
            {board?.description || "Launch the new marketing site for Q3 — landing pages, analytics, and campaign tracking"}
          </p>
        </div>

        {/* Progress Bar Section (Inline and Scrollable on Mobile) */}
        <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[24px] p-2.5 mb-6 md:mb-8 flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4 shadow-sm relative z-10">
          <div className="flex flex-row overflow-x-auto gap-2 pb-1 md:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full xl:w-auto">
            <div className="flex items-center gap-2 bg-[#FFEFEA] text-[#E05A33] px-4 py-1.5 rounded-[14px] font-bold text-[13px] shadow-sm shrink-0">
              <CalendarDays className="w-4 h-4" /> To Do • {todoTasks}
            </div>
            <div className="flex items-center gap-2 bg-[#F1EBFF] text-[#8B5CF6] px-4 py-1.5 rounded-[14px] font-bold text-[13px] shadow-sm shrink-0">
              <Zap className="w-4 h-4" /> In Progress • {inProgressTasks}
            </div>
            <div className="flex items-center gap-2 bg-[#E6F8F3] text-[#10B981] px-4 py-1.5 rounded-[14px] font-bold text-[13px] shadow-sm shrink-0">
              <CheckCircle2 className="w-4 h-4" /> Done • {doneTasks}
            </div>
          </div>
          
          <div className="flex items-center gap-4 px-2 w-full xl:w-auto shrink-0 pb-1 md:pb-0">
            <span className="text-[14px] font-bold text-slate-800">Overall progress {completionRate}%</span>
            <div className="w-full sm:w-48 h-2.5 rounded-full bg-slate-200/80 relative flex items-center shadow-inner">
              <div className="h-full bg-gradient-to-r from-[#A555F5] via-[#4F46E5] to-[#10B981] rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }}></div>
              <div className="absolute bg-white rounded-full p-[3px] shadow-md border border-slate-100 flex items-center justify-center transition-all duration-500" style={{ left: `calc(${completionRate}% - 12px)` }}>
                <Target className="w-4 h-4 text-[#8B5CF6]" />
              </div>
            </div>
          </div>
        </div>

        {/* Invite Dialog */}
        <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
          <DialogContent className="max-w-4xl rounded-[24px] p-6 border-slate-100 shadow-xl bg-white/95 backdrop-blur-xl">
            <DialogHeader className="flex flex-row justify-between items-start pt-2">
              <div>
                <DialogTitle className="text-2xl font-bold text-slate-900">Invite / Members</DialogTitle>
                <DialogDescription className="text-[15px] text-slate-500 font-medium mt-1">Add people, verify their account, and manage board access.</DialogDescription>
              </div>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <div className="rounded-[16px] border border-slate-100 bg-slate-50 p-5 shadow-inner">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label className="text-slate-700 font-semibold ml-1">Email address</Label>
                    <Input className="mt-1.5 h-11 rounded-xl border-slate-200 bg-white" value={inviteDraftEmail} onChange={(e) => setInviteDraftEmail(e.target.value)} placeholder="teammate@example.com" />
                  </div>
                  <Button type="button" className="h-11 rounded-xl px-6 font-bold bg-slate-900 text-white" onClick={addInviteDraft}>Add to queue</Button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-[15px] font-bold text-slate-800 ml-1">Manage Access</h3>
                <div className="overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-sm">
                  <div className="grid grid-cols-[minmax(0,1fr)_160px_180px] gap-3 border-b border-slate-100 bg-[#FAF9FC] px-5 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <div>User</div>
                    <div>Action</div>
                    <div>Role</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {inviteRows.map((row) => (
                      <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_160px_180px] items-center gap-3 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-bold text-slate-900">{row.email}</p>
                          <p className="text-[12px] font-semibold text-amber-500">{row.status}</p>
                        </div>
                        <Button type="button" className="rounded-xl h-9 text-xs font-bold" variant={row.status === "Verified" ? "default" : "secondary"} disabled={inviteActionId === row.id} onClick={() => (row.status === "Added" ? verifyInviteDraft(row) : sendInviteDraft(row))}>
                          {inviteActionId === row.id ? "Working..." : (row.status === "Added" ? "Verify Account" : "Send Invitation")}
                        </Button>
                        <Select value={row.role} onValueChange={(value) => updateInviteDraft(row.id, { role: value })}>
                          <SelectTrigger className="rounded-xl h-9 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                            {inviteRoleOptions.map((option) => <SelectItem key={option} value={option} className="font-medium">{option}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}

                    {members.map((member) => {
                      const displayName = member.profiles?.full_name || member.profiles?.email || "Member";
                      const isBoardCreatorRow = board?.created_by === member.user_id;
                      return (
                        <div key={member.id} className="grid grid-cols-[minmax(0,1fr)_160px_180px] items-center gap-3 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                          <div className="min-w-0 flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-slate-200">
                              {member.profiles?.avatar_url ? <img src={member.profiles.avatar_url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center bg-indigo-50 text-indigo-700 font-bold text-xs">{displayName.charAt(0).toUpperCase()}</div>}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-bold text-slate-900">{displayName}</p>
                              <p className={`text-[12px] font-semibold ${member.status === 'Pending' ? 'text-amber-500' : 'text-slate-500'}`}>{member.status === 'Pending' ? 'Invite Sent' : 'Active Member'}</p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            className="rounded-xl h-9 text-xs font-bold"
                            variant={member.status === "Pending" ? "secondary" : (isBoardCreatorRow ? "ghost" : "destructive")}
                            disabled={!isCurrentUserOwnerOnly || isBoardCreatorRow}
                            onClick={() => {
                              if (member.status === "Pending") setPendingDeleteInvite({ id: member.id, label: displayName });
                              else if (isCurrentUserOwnerOnly) removeMember(member.id);
                            }}
                          >
                            {member.status === "Pending" ? "Revoke" : (isBoardCreatorRow ? "Owner" : "Remove")}
                          </Button>
                          <Select value={member.role} onValueChange={(value) => updateMemberRole(member.id, value as BoardMember["role"])} disabled={!isCurrentUserOwnerOnly || isBoardCreatorRow}>
                            <SelectTrigger className="rounded-xl h-9 border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200 shadow-lg">
                              {inviteRoleOptions.map((option) => <SelectItem key={option} value={option} className="font-medium">{option}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                    {inviteRows.length === 0 && members.length === 0 ? <div className="px-5 py-10 text-center text-[14px] font-medium text-slate-500">No members found.</div> : null}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Task Creation Dialog */}
        {canCreateTaskAllowed && (
          <Dialog open={taskModalOpen} onOpenChange={(open: boolean) => { if (!open) resetTaskForm(); setTaskModalOpen(open); }}>
            <DialogContent className="sm:max-w-[425px] rounded-[24px] p-6 border-slate-100 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-slate-900">Create new task</DialogTitle>
                <DialogDescription className="text-sm font-medium text-slate-500">Capture the details and assign it to a teammate.</DialogDescription>
              </DialogHeader>
              <div className="space-y-5 mt-4">
                <div>
                  <Label className="text-slate-700 font-semibold">Task Name</Label>
                  <Input className="mt-1.5 h-11 rounded-xl border-slate-200 bg-slate-50/50" value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="e.g., Design new homepage" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-700 font-semibold">Status</Label>
                    <Select value={taskStatus} onValueChange={(value: string) => setTaskStatus(value as "todo" | "inprogress" | "done") }>
                      <SelectTrigger className="mt-1.5 h-11 rounded-xl border-slate-200 bg-slate-50/50"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                        <SelectItem value="todo" className="font-medium">To Do</SelectItem>
                        <SelectItem value="inprogress" className="font-medium">In Progress</SelectItem>
                        <SelectItem value="done" className="font-medium">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-700 font-semibold">Due date</Label>
                    <Input className="mt-1.5 h-11 rounded-xl border-slate-200 bg-slate-50/50" type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-700 font-semibold">Description</Label>
                  <Input className="mt-1.5 h-11 rounded-xl border-slate-200 bg-slate-50/50" value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Add more details..." />
                </div>
                <div>
                  <Label className="text-slate-700 font-semibold">Assignee(s)</Label>
                  <div className="mt-2 flex max-h-40 flex-col gap-2 overflow-auto pr-1">
                      <button type="button" onClick={() => { setTaskAssignees([]); setTaskAssignee('unassigned'); }} className={`text-left rounded-xl px-3 py-2.5 transition-colors ${taskAssignees.length === 0 ? 'bg-indigo-50 border border-indigo-200 shadow-sm' : 'border border-slate-100 hover:bg-slate-50'}`}>
                      <span className="text-[14px] font-semibold text-slate-700">Unassigned</span>
                    </button>
                    {members.map((member) => {
                      const selected = taskAssignees.includes(member.user_id);
                      return (
                        <button key={member.id} type="button" onClick={() => {
                          setTaskAssignee('');
                          setTaskAssignees((current) => selected ? current.filter((id) => id !== member.user_id) : [...current, member.user_id]);
                        }} className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${selected ? 'bg-indigo-50 border border-indigo-200 shadow-sm' : 'border border-slate-100 hover:bg-slate-50'}`}>
                          <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 border border-slate-200 bg-white">
                            {member.profiles?.avatar_url ? (
                              <img src={member.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-slate-800 text-xs font-bold text-white">{(member.profiles?.full_name || member.profiles?.email || 'U').charAt(0).toUpperCase()}</div>
                            )}
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="text-[14px] font-bold text-slate-900 truncate">{member.profiles?.full_name || member.profiles?.email}</div>
                            <div className="text-[11px] font-semibold text-slate-500">{member.role}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="pt-2">
                  <Button className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[15px]" onClick={saveTask} disabled={taskLoading}>{taskLoading ? "Creating..." : "Create task"}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Kanban Board Area (Horizontal Scrolling on Mobile) */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex flex-row overflow-x-auto gap-4 md:gap-6 pb-20 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {columns.map((column) => {
              const columnTasks = tasks.filter((task) => task.status === column.key);
              return (
                <div key={column.key} className="w-[85vw] sm:w-[360px] xl:w-auto xl:flex-1 shrink-0 snap-center">
                  <BoardColumn
                    column={column}
                    columnTasks={columnTasks}
                    members={members}
                  />
                </div>
              );
            })}
          </div>
          {typeof window !== "undefined" &&
            createPortal(
              <DragOverlay zIndex={9999}>
                {activeTask ? (
                  <div className="w-[300px] scale-105 rotate-3 rounded-[20px] border-l-[6px] border-[#A555F5] bg-white p-4 shadow-2xl cursor-grabbing opacity-95">
                    <h3 className="text-[15px] font-bold text-slate-900 leading-snug">{activeTask.name}</h3>
                    <p className="mt-2 text-[13px] font-medium text-slate-600 line-clamp-2">{activeTask.description}</p>
                  </div>
                ) : null}
              </DragOverlay>,
              document.body
            )}
        </DndContext>

      </div>

      <Dialog open={Boolean(pendingDeleteInvite)} onOpenChange={(open) => { if (!open) setPendingDeleteInvite(null); }}>
        <DialogContent className="max-w-sm rounded-[24px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Delete request?</DialogTitle>
            <DialogDescription className="font-medium text-slate-500">
              This will cancel the pending invitation for {pendingDeleteInvite?.label || "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-3 mt-4">
            <Button variant="outline" className="rounded-xl font-bold h-11" onClick={() => setPendingDeleteInvite(null)}>Cancel</Button>
            <Button variant="destructive" className="rounded-xl font-bold h-11" onClick={cancelInviteRequest}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Real-time Presence Cursor Overlay */}
      {boardId && (
        <LivePresence 
          boardId={boardId} 
          currentUserId={currentUserId} 
          onlineUsers={onlineArray}
        />
      )}
      
      {/* Human Board Chat */}
      {boardId && (
        <BoardChat 
          boardId={boardId} 
          currentUserId={currentUserId} 
          members={members} 
        />
      )}
    </div>
  );
}
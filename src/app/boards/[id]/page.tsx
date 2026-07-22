"use client";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { DndContext, closestCenter, DragOverlay, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, CheckCircle2, Clock3, Plus, Users, Share2, Sparkles, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

const columns = [
  { key: "todo", title: "To Do", accent: "bg-slate-100 text-slate-700" },
  { key: "inprogress", title: "In Progress", accent: "bg-amber-100 text-amber-700" },
  { key: "done", title: "Done", accent: "bg-emerald-100 text-emerald-700" },
] as const;
const columnKeys = columns.map((column) => column.key);

const isValidUuid = (value: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
const canManageBoard = (role?: string | null) => role === "Owner" || role === "Editor";
const canManageTasks = (role?: string | null) => role === "Owner" || role === "Editor" || role === "Add/Delete Task";
const canUpdateProgress = (role?: string | null) => canManageTasks(role) || role === "Update Progress";

function SortableTaskCard({ task, members, canDeleteTask, onDeleteTask }: { task: TaskItem; members: BoardMember[]; canDeleteTask: boolean; onDeleteTask: (taskId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
  };
  
  const assignedMember = task.assigned_to ? members.find((member) => task.assigned_to?.includes(member.user_id)) : undefined;
  const initials = (assignedMember?.profiles?.full_name || assignedMember?.profiles?.email || "U").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners} 
      className={`cursor-grab rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md ${
        isDragging ? "opacity-30 border-dashed border-indigo-300 shadow-none pointer-events-none" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{task.name}</p>
        {canDeleteTask ? (
          <button 
            type="button" 
            onClick={(event) => { event.stopPropagation(); onDeleteTask(task.id); }} 
            className="rounded-md border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-500">{task.description || "Add more detail to this task."}</p>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-1">{task.due_date ? format(new Date(task.due_date), "MMM d") : "No due date"}</span>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
          {assignedMember ? (
            assignedMember.profiles?.avatar_url ? (
              <img src={assignedMember.profiles.avatar_url} alt={assignedMember.profiles.full_name || assignedMember.profiles.email || "Assignee"} className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">{initials}</div>
            )
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">U</div>
          )}
          <span className="max-w-[90px] truncate">{task.assigned_to && task.assigned_to.length > 0 ? (assignedMember?.profiles?.full_name || assignedMember?.profiles?.email || "Assignees") + (task.assigned_to.length > 1 ? ` +${task.assigned_to.length - 1}` : "") : "Unassigned"}</span>
        </div>
      </div>
    </div>
  );
}

function BoardColumn({
  column,
  columnTasks,
  members,
  canCreateTask,
  canDeleteTask,
  setTaskStatus,
  setTaskModalOpen,
  onDeleteTask,
}: {
  column: (typeof columns)[number];
  columnTasks: TaskItem[];
  members: BoardMember[];
  canCreateTask: boolean;
  canDeleteTask: boolean;
  setTaskStatus: (status: "todo" | "inprogress" | "done") => void;
  setTaskModalOpen: (open: boolean) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div ref={setNodeRef} className={`flex min-h-[420px] flex-col rounded-3xl border p-3 shadow-sm transition-all duration-200 ${isOver ? "border-indigo-300 bg-indigo-50/80 shadow-md" : "border-slate-200 bg-slate-50/70"}`}>
      <div className={`flex items-center justify-between rounded-2xl px-3 py-2 ${column.accent}`}>
        <div className="flex items-center gap-2">
          {column.key === "done" ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          <h2 className="font-semibold">{column.title}</h2>
        </div>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs">{columnTasks.length}</span>
      </div>
      <SortableContext items={columnTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div id={column.key} className={`mt-3 flex-1 space-y-3 overflow-y-auto pr-1 ${isOver ? "rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 p-2" : ""}`}>
          {isOver && <div className="rounded-xl border border-dashed border-indigo-300 bg-white/70 px-3 py-2 text-center text-xs font-medium text-indigo-600">Drop task here</div>}
          {columnTasks.map((task) => <SortableTaskCard key={task.id} task={task} members={members} canDeleteTask={canDeleteTask} onDeleteTask={onDeleteTask} />)}
          {canCreateTask ? (
            <button onClick={() => { setTaskStatus(column.key as "todo" | "inprogress" | "done"); setTaskModalOpen(true); }} className="flex w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-3 py-4 text-sm font-medium text-slate-500 transition hover:scale-[1.01] hover:bg-white">
              <Plus className="mr-2 h-4 w-4" /> Add Card
            </button>
          ) : null}
        </div>
      </SortableContext>
    </div>
  );
}

export default function BoardPage() {
  const params = useParams();
  const boardId = params.id as string;
  const supabase = useMemo(() => createClient(), []);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
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
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [editingBoard, setEditingBoard] = useState(false);
  const [boardNameInput, setBoardNameInput] = useState("");
  const [boardDescriptionInput, setBoardDescriptionInput] = useState("");
  const [boardSaving, setBoardSaving] = useState(false);
  const [inviteRoleOptions] = useState<string[]>(["View Only", "Update Progress", "Add/Delete Task", "Editor", "Owner"]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ full_name: string | null; email: string | null; avatar_url: string | null } | null>(null);
  
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 2 } }));

  const loadBoardData = async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setLoading(true);
    
    // 1. Fetch user EXACTLY ONCE
    const { data: userData } = await supabase.auth.getUser();
    setCurrentUserId(userData.user?.id ?? null);

    // 2. Grab the current user's profile to pass to LivePresence
    if (userData.user?.id) {
      const { data: profile } = await supabase.from("profiles").select("full_name, email, avatar_url").eq("id", userData.user.id).single();
      setCurrentUserProfile(profile);
    }
    
    // 3. Fetch the rest of the board data
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
    setLoading(false);
  };

  useEffect(() => {
    loadBoardData();
  }, [boardId, supabase]);

  // --- REAL-TIME SUBSCRIPTION ---
  useEffect(() => {
    const channel = supabase
      .channel(`realtime:board_${boardId}`)
      // 1. Listen for Task Changes (Moving, Creating, Deleting)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `board_id=eq.${boardId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setTasks((current) => {
            // Prevent duplicates if the user created it themselves
            if (current.some((t) => t.id === payload.new.id)) return current;
            return [...current, payload.new as TaskItem];
          });
        } else if (payload.eventType === "UPDATE") {
          setTasks((current) => current.map((t) => (t.id === payload.new.id ? (payload.new as TaskItem) : t)));
        } else if (payload.eventType === "DELETE") {
          setTasks((current) => current.filter((t) => t.id !== payload.old.id));
        }
      })
      // 2. Listen for Member Changes (Invites accepted, roles changed, members removed)
      .on("postgres_changes", { event: "*", schema: "public", table: "board_members", filter: `board_id=eq.${boardId}` }, () => {
        // Because member data requires joining with profiles (for names/avatars),
        // we just quietly re-fetch the board data in the background when this changes.
        loadBoardData();
      })
      // 3. Listen for Board Detail Changes (Renaming, Description changes)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "boards", filter: `id=eq.${boardId}` }, (payload) => {
        setBoard((current) => current ? { ...current, name: payload.new.name, description: payload.new.description } : null);
      })
      .subscribe();

    // Cleanup the subscription when the user leaves the page
    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, supabase]);

  useEffect(() => {
    if (board) {
      setBoardNameInput(board.name);
      setBoardDescriptionInput(board.description ?? "");
    }
  }, [board]);

  const resetTaskForm = () => {
    setEditingTask(null);
    setTaskName("");
    setTaskDescription("");
    setTaskStatus("todo");
    setTaskDueDate("");
    setTaskAssignee("unassigned");
    setTaskAssignees([]);
    setTaskModalOpen(false);
  };

  const deleteTask = async (taskId: string) => {
    if (!canDeleteTaskAllowed) {
      toast.error("You do not have permission to delete tasks.");
      return;
    }
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      toast.error("Unable to delete task");
      return;
    }
    setTasks((current) => current.filter((task) => task.id !== taskId));
    toast.success("Task deleted");
    resetTaskForm();
  };

  const addInviteDraft = () => {
    const email = inviteDraftEmail.trim().toLowerCase();
    if (!email) return;

    const existing = inviteRows.some((row) => row.email.toLowerCase() === email);
    if (existing) {
      toast.error("That email is already queued.");
      return;
    }

    setInviteRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        email,
        role: "Update Progress",
        status: "Added",
        verifiedUser: null,
      },
    ]);
    setInviteDraftEmail("");
  };

  const updateInviteDraft = (draftId: string, updates: Partial<InviteDraft>) => {
    setInviteRows((current) => current.map((row) => (row.id === draftId ? { ...row, ...updates } : row)));
  };

  const verifyInviteDraft = async (draft: InviteDraft) => {
    setInviteActionId(draft.id);
    const { data } = await supabase.from("profiles").select("id, email, full_name").eq("email", draft.email).single();
    if (!data) {
      toast.error("User must create an account first.");
      setInviteActionId(null);
      return;
    }

    updateInviteDraft(draft.id, { status: "Verified", verifiedUser: data });
    toast.success("User verified");
    setInviteActionId(null);
  };

  const sendInviteDraft = async (draft: InviteDraft) => {
    if (!draft.verifiedUser) return;
    setInviteActionId(draft.id);
    const { error } = await supabase.from("board_members").insert({
      board_id: boardId,
      user_id: draft.verifiedUser.id,
      role: draft.role,
      status: "Pending",
    });

    if (error) {
      toast.error("Unable to send invite");
      setInviteActionId(null);
      return;
    }

    setInviteRows((current) => current.filter((row) => row.id !== draft.id));
    setInviteActionId(null);
    toast.success("Invitation sent");
    loadBoardData();
  };

  const saveTask = async () => {
    if (!taskName.trim()) return;
    if (!canCreateTaskAllowed) {
      toast.error("You do not have permission to create tasks.");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData.user?.id;
    if (!currentUserId) {
      toast.error("You need to sign in before creating tasks.");
      return;
    }

    setTaskLoading(true);
    const payload = {
      board_id: boardId,
      created_by: currentUserId,
      name: taskName,
      description: taskDescription,
      status: taskStatus,
      due_date: taskDueDate || null,
      assigned_to: taskAssignees.length === 0 
        ? null 
        : (typeof (taskAssignees as any)[0] === 'object' 
            ? (taskAssignees as any)[0].id 
            : (taskAssignees as any)[0]),
    };
    
    const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
    if (error || !data) {
      console.error("Task create error", error);
      toast.error(error?.message || "Unable to create task");
      setTaskLoading(false);
      return;
    }
    
    setTasks((current) => [...current, { ...payload, id: data.id, created_by: currentUserId } as TaskItem]);
    toast.success("Task created");
    resetTaskForm();
    setTaskLoading(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeTaskId = String(event.active.id);
    const task = tasks.find((item) => item.id === activeTaskId) ?? null;
    setActiveTask(task);
  };

  const serializeError = (error: unknown) => {
    if (!error) return null;
    try {
      if (error instanceof Error) {
        return {
          message: error.message,
          stack: error.stack,
          name: error.name,
          ...Object.getOwnPropertyNames(error).reduce((acc, key) => ({
            ...acc,
            [key]: (error as any)[key],
          }), {} as Record<string, unknown>),
        };
      }
      return JSON.parse(JSON.stringify(error));
    } catch {
      return String(error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over, active } = event;
    setActiveTask(null);
    if (!over || active.id === over.id) return;

    if (!canUpdateProgress(currentUserRole)) {
      toast.error("You do not have permission to move tasks.");
      return;
    }

    const taskId = String(active.id);
    if (!isValidUuid(taskId)) {
      console.error("Invalid task id for drag end", { taskId, active });
      return;
    }

    const overId = String(over.id);
    const nextStatus = columnKeys.includes(overId as typeof columnKeys[number])
      ? (overId as "todo" | "inprogress" | "done")
      : tasks.find((task) => task.id === overId)?.status;

    if (!nextStatus) {
      console.warn("Drag ended over unknown droppable target", { overId, taskId });
      return;
    }

    const previousTasks = tasks;
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask || currentTask.status === nextStatus) return;

    setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task)));

    try {
      const { data, error } = await supabase.from("tasks").update({ status: nextStatus }).eq("id", taskId).select("id").single();
      if (error || !data) {
        const errorPayload = {
          taskId,
          overId,
          nextStatus,
          currentTask,
          supabaseError: serializeError(error),
          rawError: error,
          stringError: error ? String(error) : null,
          data,
        };
        try {
          console.error("Task move error:", JSON.stringify(errorPayload, null, 2));
        } catch {
          console.error("Task move error", errorPayload);
        }
        setTasks(previousTasks);
        toast.error(error?.message || "Failed to move task");
        return;
      }
      toast.success("Task moved");
    } catch (caught) {
      console.error("Task move exception", {
        taskId,
        overId,
        nextStatus,
        currentTask,
        caught: serializeError(caught),
      });
      setTasks(previousTasks);
      toast.error("Failed to move task");
    }
  };

  const updateMemberRole = async (memberId: string, role: BoardMember["role"]) => {
    if (!isCurrentUserOwner) {
      toast.error("You do not have permission to update member roles.");
      return;
    }
    const { error } = await supabase.from("board_members").update({ role }).eq("id", memberId);
    if (error) {
      toast.error("Unable to update member access");
      return;
    }
    setMembers((current) => current.map((member) => member.id === memberId ? { ...member, role } : member));
    toast.success("Access updated");
  };

  const removeMember = async (memberId: string) => {
    if (!isCurrentUserOwner) {
      toast.error("You do not have permission to remove members.");
      return;
    }
    const { error } = await supabase.from("board_members").delete().eq("id", memberId);
    if (error) {
      toast.error("Unable to remove member");
      return;
    }
    setMembers((current) => current.filter((member) => member.id !== memberId));
    toast.success("Member removed");
  };

  const cancelInviteRequest = async () => {
    if (!isCurrentUserOwnerOnly) {
      toast.error("You do not have permission to delete requests.");
      return;
    }
    if (!pendingDeleteInvite) return;
    const member = members.find((item) => item.id === pendingDeleteInvite.id);
    if (!member) {
      setPendingDeleteInvite(null);
      return;
    }

    const { error } = await supabase.from("board_members").delete().eq("id", member.id);
    if (error) {
      toast.error("Unable to delete request");
      return;
    }

    setMembers((current) => current.filter((item) => item.id !== member.id));
    setPendingDeleteInvite(null);
    toast.success("Request deleted");
  };

  const copyShareLink = async () => {
    if (!canManageBoard(currentUserRole)) {
      toast.error("You do not have permission to generate share links.");
      return;
    }
    const shareLink = `${window.location.origin}/dashboard?request_board=${boardId}`;
    await navigator.clipboard.writeText(shareLink);
    setShareLinkCopied(true);
    toast.success("Share link copied");
    setTimeout(() => setShareLinkCopied(false), 2000);
  };

  const isBoardOwner = board?.created_by;
  const currentUserRole = currentUserId ? members.find((member) => member.user_id === currentUserId)?.role ?? null : null;
  const isCurrentUserOwner = Boolean(currentUserId && (board?.created_by === currentUserId || currentUserRole === "Owner"));
  const isCurrentUserOwnerOnly = isCurrentUserOwner;
  const canCreateTaskAllowed = canManageTasks(currentUserRole);
  const canDeleteTaskAllowed = canManageTasks(currentUserRole);
  const canMoveTaskAllowed = canUpdateProgress(currentUserRole);

  if (loading) return <div className="py-20 text-center text-slate-500">Loading board...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-slate-50 p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-500">Board</p>
          {!editingBoard ? (
            <>
              <h1 className="mt-2 text-3xl font-semibold">{board?.name}</h1>
              <p className="mt-2 text-sm text-slate-500">{board?.description || "A collaborative workspace for this board."} {board?.projects?.name ? `Connected to ${board.projects.name}` : "Standalone board"}</p>
            </>
          ) : (
            <div className="mt-2 space-y-3">
              <Input value={boardNameInput} onChange={(e) => setBoardNameInput(e.target.value)} placeholder="Board name" />
              <Input value={boardDescriptionInput} onChange={(e) => setBoardDescriptionInput(e.target.value)} placeholder="Description" />
              <div className="flex gap-2">
                <Button size="sm" onClick={async () => { setBoardSaving(true); const { error } = await supabase.from("boards").update({ name: boardNameInput.trim(), description: boardDescriptionInput.trim() }).eq("id", boardId); setBoardSaving(false); if (error) { toast.error("Unable to update board"); return; } toast.success("Board updated"); setEditingBoard(false); loadBoardData(); }} disabled={boardSaving}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingBoard(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canManageBoard(currentUserRole) && <Button variant="outline" onClick={() => setEditingBoard((value) => !value)}><Pencil className="mr-2 h-4 w-4" /> {editingBoard ? "Cancel edit" : "Edit board"}</Button>}
          {canManageBoard(currentUserRole) && <Button variant="outline" onClick={copyShareLink}><Share2 className="mr-2 h-4 w-4" /> {shareLinkCopied ? "Link copied" : "Share link"}</Button>}
          {isCurrentUserOwnerOnly && <Button variant="outline" className="text-rose-600" onClick={async () => { const { error } = await supabase.from("boards").delete().eq("id", boardId); if (error) { toast.error("Unable to delete board"); return; } toast.success("Board deleted"); window.location.href = "/dashboard"; }}><Trash2 className="mr-2 h-4 w-4" /> Delete board</Button>}
          
          <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
            <DialogTrigger asChild>
              {/* FIX: Checking canManageTasks instead of canManageBoard so Add/Delete Task users see the "Invite" text too */}
              <Button variant="outline"><Users className="mr-2 h-4 w-4" /> {canManageTasks(currentUserRole) ? "Invite / Members" : "Board Members"}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Invite / Members</DialogTitle>
                <DialogDescription>Add people, verify their account, and manage board access from one place.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <Label>Email</Label>
                      <Input value={inviteDraftEmail} onChange={(e) => setInviteDraftEmail(e.target.value)} placeholder="teammate@example.com" />
                    </div>
                    <Button type="button" onClick={addInviteDraft}>Add</Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">Section 2: Invite queue and members</h3>
                    <p className="text-xs text-slate-500">Action flow: Added → Verified → Sent → Accepted</p>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="grid grid-cols-[minmax(0,1fr)_160px_180px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      <div>Email</div>
                      <div>Action</div>
                      <div>Role</div>
                    </div>
                    <div className="divide-y divide-slate-200 bg-white">
                      {inviteRows.map((row) => {
                        const actionLabel = row.status === "Added" ? "Verify" : "Send Invitation";
                        return (
                          <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_160px_180px] items-center gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">{row.email}</p>
                              <p className="text-xs text-slate-500">{row.status}</p>
                            </div>
                            <Button type="button" variant={row.status === "Verified" ? "default" : "secondary"} disabled={inviteActionId === row.id} onClick={() => (row.status === "Added" ? verifyInviteDraft(row) : sendInviteDraft(row))}>
                              {inviteActionId === row.id ? "Working..." : actionLabel}
                            </Button>
                            <Select value={row.role} onValueChange={(value) => updateInviteDraft(row.id, { role: value })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {inviteRoleOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}

                      {members.map((member) => {
                        const displayName = member.profiles?.full_name || member.profiles?.email || "Member";
                        const isBoardCreatorRow = board?.created_by === member.user_id;
                        const actionText = member.status === "Pending" ? "Request Sent" : isBoardCreatorRow ? "Owner" : "Delete";
                        return (
                          <div key={member.id} className="grid grid-cols-[minmax(0,1fr)_160px_180px] items-center gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">{displayName}</p>
                              <p className="text-xs text-slate-500">{member.status}</p>
                            </div>
                            <Button
                              type="button"
                              variant={member.status === "Pending" ? "secondary" : "destructive"}
                              disabled={!isCurrentUserOwnerOnly}
                              onClick={() => {
                                if (member.status === "Pending") {
                                  setPendingDeleteInvite({ id: member.id, label: displayName });
                                  return;
                                }
                                if (isCurrentUserOwnerOnly) {
                                  removeMember(member.id);
                                }
                              }}
                            >
                              {actionText}
                            </Button>
                            <Select value={member.role} onValueChange={(value) => updateMemberRole(member.id, value as BoardMember["role"])} disabled={!isCurrentUserOwnerOnly}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {inviteRoleOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                      {inviteRows.length === 0 && members.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-slate-500">No members or pending invites yet.</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* FIX: Task creation Dialog wrapped in canCreateTaskAllowed to hide it for View Only / Update Progress users */}
          {canCreateTaskAllowed && (
            <Dialog open={taskModalOpen} onOpenChange={(open: boolean) => { if (!open) resetTaskForm(); setTaskModalOpen(open); }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> Add task</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create task</DialogTitle>
                  <DialogDescription>Capture the details and assign it to a teammate.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Task name</Label>
                    <Input value={taskName} onChange={(e) => setTaskName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={taskStatus} onValueChange={(value: string) => setTaskStatus(value as "todo" | "inprogress" | "done") }>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="inprogress">In Progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} />
                  </div>
                  <div>
                    <Label>Due date</Label>
                    <Input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Assignee(s)</Label>
                    <div className="mt-2 flex max-h-40 flex-col gap-2 overflow-auto">
                        <button type="button" onClick={() => { setTaskAssignees([]); setTaskAssignee('unassigned'); }} className={`text-left rounded-lg px-3 py-2 ${taskAssignees.length === 0 ? 'bg-indigo-50 border border-indigo-200' : 'border border-slate-100'}`}>
                        Unassigned
                      </button>
                      {members.map((member) => {
                        const selected = taskAssignees.includes(member.user_id);
                        return (
                          <button key={member.id} type="button" onClick={() => {
                            setTaskAssignee('');
                            setTaskAssignees((current) => selected ? current.filter((id) => id !== member.user_id) : [...current, member.user_id]);
                          }} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left ${selected ? 'bg-indigo-50 border border-indigo-200' : 'border border-slate-100'}`}>
                            {member.profiles?.avatar_url ? (
                              <img src={member.profiles.avatar_url} alt={member.profiles.full_name || member.profiles.email || 'Member'} className="h-6 w-6 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{(member.profiles?.full_name || member.profiles?.email || 'U').charAt(0).toUpperCase()}</div>
                            )}
                            <div className="min-w-0">
                              <div className="text-sm">{member.profiles?.full_name || member.profiles?.email}</div>
                              <div className="text-xs text-slate-500">{member.status === 'Pending' ? 'Pending' : member.role}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveTask} disabled={taskLoading}>{taskLoading ? "Saving..." : "Create task"}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid gap-4 xl:grid-cols-3">
          {columns.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column.key);
            return (
              <BoardColumn
                key={column.key}
                column={column}
                columnTasks={columnTasks}
                members={members}
                setTaskStatus={setTaskStatus}
                setTaskModalOpen={setTaskModalOpen}
                canCreateTask={canCreateTaskAllowed}
                canDeleteTask={canDeleteTaskAllowed}
                onDeleteTask={deleteTask}
              />
            );
          })}
        </div>
        {typeof window !== "undefined" &&
          createPortal(
            <DragOverlay zIndex={9999}>
              {activeTask ? (
                <div className="w-72 scale-105 rotate-1 rounded-2xl border border-indigo-300 bg-white p-3 shadow-2xl ring-2 ring-indigo-200 cursor-grabbing pointer-events-none">
                  <p className="text-sm font-semibold text-slate-900">{activeTask.name}</p>
                  <p className="mt-2 text-sm text-slate-500 line-clamp-2">{activeTask.description || "Dragging task"}</p>
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}
      </DndContext>

      <Dialog open={Boolean(pendingDeleteInvite)} onOpenChange={(open) => { if (!open) setPendingDeleteInvite(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete request?</DialogTitle>
            <DialogDescription>
              This will cancel the pending invitation for {pendingDeleteInvite?.label || "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingDeleteInvite(null)}>Cancel</Button>
            <Button variant="destructive" onClick={cancelInviteRequest}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
      <BoardChat 
        boardId={boardId} 
        currentUserId={currentUserId} 
        members={members} 
      />
      <LivePresence 
        boardId={boardId} 
        currentUserId={currentUserId} 
        currentUserProfile={currentUserProfile}
      />
    </div>
  );
}
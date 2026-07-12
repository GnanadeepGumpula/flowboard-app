"use client";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { DndContext, closestCenter, DragOverlay, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, CheckCircle2, Clock3, Plus, Users, UserPlus, Sparkles, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface BoardMember {
  id: string;
  user_id: string;
  role: string;
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
  projects?: { name: string | null } | null;
}

const columns = [
  { key: "todo", title: "To Do", accent: "bg-slate-100 text-slate-700" },
  { key: "inprogress", title: "In Progress", accent: "bg-amber-100 text-amber-700" },
  { key: "done", title: "Done", accent: "bg-emerald-100 text-emerald-700" },
] as const;
const columnKeys = columns.map((column) => column.key);

const isValidUuid = (value: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);

function SortableTaskCard({ task, members, onDeleteTask }: { task: TaskItem; members: BoardMember[]; onDeleteTask: (taskId: string) => void }) {
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
        <button 
          type="button" 
          onClick={(event) => { event.stopPropagation(); onDeleteTask(task.id); }} 
          className="rounded-md border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
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
  setTaskStatus,
  setTaskModalOpen,
  onDeleteTask,
}: {
  column: (typeof columns)[number];
  columnTasks: TaskItem[];
  members: BoardMember[];
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
          {columnTasks.map((task) => <SortableTaskCard key={task.id} task={task} members={members} onDeleteTask={onDeleteTask} />)}
          <button onClick={() => { setTaskStatus(column.key as "todo" | "inprogress" | "done"); setTaskModalOpen(true); }} className="flex w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-3 py-4 text-sm font-medium text-slate-500 transition hover:scale-[1.01] hover:bg-white">
            <Plus className="mr-2 h-4 w-4" /> Add Card
          </button>
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Update Progress");
  const [verifiedUser, setVerifiedUser] = useState<any>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [editingBoard, setEditingBoard] = useState(false);
  const [boardNameInput, setBoardNameInput] = useState("");
  const [boardDescriptionInput, setBoardDescriptionInput] = useState("");
  const [boardSaving, setBoardSaving] = useState(false);
  const [inviteRoleOptions] = useState<string[]>(["View Only", "Update Progress", "Add/Delete Task", "Owner"]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberRoleInput, setMemberRoleInput] = useState("Update Progress");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 2 } }));

  const loadBoardData = async () => {
    setLoading(true);
    const [{ data: boardData }, { data: membersData }, { data: tasksData }] = await Promise.all([
      supabase.from("boards").select("id, name, description, project_id").eq("id", boardId).single(),
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
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      toast.error("Unable to delete task");
      return;
    }
    setTasks((current) => current.filter((task) => task.id !== taskId));
    toast.success("Task deleted");
    resetTaskForm();
  };

  const saveTask = async () => {
    if (!taskName.trim()) return;
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
      assigned_to: taskAssignees.length === 0 ? null : taskAssignees,
    };
    const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
    if (error || !data) {
      console.error("Task create error", error);
      toast.error(error?.message || "Unable to create task");
      setTaskLoading(false);
      return;
    }
    if (taskAssignees.length > 0) {
      const currentUserName = userData.user?.user_metadata?.full_name || userData.user?.email || "A teammate";
      const { data: boardData } = await supabase.from("boards").select("name").eq("id", boardId).single();
      for (const assignee of taskAssignees) {
        await supabase.rpc("create_notification", {
          p_user_id: assignee,
          p_title: "Task assignment request",
          p_message: `${currentUserName} assigned you to "${taskName}" in "${boardData?.name || "a board"}".`,
          p_type: "task_assignment_request",
          p_related_id: data.id,
        });
      }
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

  const verifyInvite = async () => {
    const { data } = await supabase.from("profiles").select("id, email, full_name").eq("email", inviteEmail).single();
    if (!data) {
      setVerifiedUser(null);
      toast.error("User must create an account first.");
      return;
    }
    setVerifiedUser(data);
    toast.success("User verified");
  };

  const sendInvite = async () => {
    if (!verifiedUser) return;
    setInviteLoading(true);
    const { error } = await supabase.from("board_members").insert({ board_id: boardId, user_id: verifiedUser.id, role: inviteRole, status: "Pending" });
    if (error) {
      toast.error("Unable to send invite");
      setInviteLoading(false);
      return;
    }
    toast.success("User invited");
    setInviteModalOpen(false);
    setInviteEmail("");
    setInviteRole("Update Progress");
    setVerifiedUser(null);
    setInviteLoading(false);
    loadBoardData();
  };

  const updateMemberRole = async (memberId: string) => {
    const { error } = await supabase.from("board_members").update({ role: memberRoleInput }).eq("id", memberId);
    if (error) {
      toast.error("Unable to update member access");
      return;
    }
    setMembers((current) => current.map((member) => member.id === memberId ? { ...member, role: memberRoleInput } : member));
    setEditingMemberId(null);
    toast.success("Access updated");
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from("board_members").delete().eq("id", memberId);
    if (error) {
      toast.error("Unable to remove member");
      return;
    }
    setMembers((current) => current.filter((member) => member.id !== memberId));
    toast.success("Member removed");
  };

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
          <Button variant="outline" onClick={() => setEditingBoard((value) => !value)}><Pencil className="mr-2 h-4 w-4" /> {editingBoard ? "Cancel edit" : "Edit board"}</Button>
          <Button variant="outline" className="text-rose-600" onClick={async () => { const { error } = await supabase.from("boards").delete().eq("id", boardId); if (error) { toast.error("Unable to delete board"); return; } toast.success("Board deleted"); window.location.href = "/dashboard"; }}><Trash2 className="mr-2 h-4 w-4" /> Delete board</Button>
          <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><UserPlus className="mr-2 h-4 w-4" /> Invite user</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite teammate</DialogTitle>
                <DialogDescription>Verify an account and send a collaboration invite.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@example.com" />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {inviteRoleOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="secondary" onClick={verifyInvite}>Verify</Button>
                {verifiedUser ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">✓ {verifiedUser.full_name || verifiedUser.email}</div> : <p className="text-sm text-slate-500">Enter an email to verify the user.</p>}
                <Button onClick={sendInvite} disabled={inviteLoading}>Send invite</Button>
              </div>
            </DialogContent>
          </Dialog>
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
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-700">Board members</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {members.map((member) => (
            <div key={member.id} className={`rounded-2xl border border-slate-200 px-3 py-3 ${member.status === "Pending" ? "opacity-60" : "opacity-100"}`}>
              <div className="flex items-center gap-2">
                {member.profiles?.avatar_url ? (
                  <img src={member.profiles.avatar_url} alt={member.profiles.full_name || member.profiles.email || "Member"} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">{(member.profiles?.full_name || member.profiles?.email || "U").charAt(0).toUpperCase()}</div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{member.profiles?.full_name || member.profiles?.email}</p>
                  <p className="text-xs text-slate-500">{member.role} · {member.status}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={() => { setEditingMemberId(member.id); setMemberRoleInput(member.role); }} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">Edit access</button>
                <button onClick={() => removeMember(member.id)} className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">Remove</button>
              </div>
              {editingMemberId === member.id && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select value={memberRoleInput} onValueChange={setMemberRoleInput}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {inviteRoleOptions.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => updateMemberRole(member.id)}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingMemberId(null)}>Cancel</Button>
                </div>
              )}
            </div>
          ))}
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
    </div>
  );
}
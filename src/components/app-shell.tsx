"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LayoutGrid, Plus, FolderKanban, Share2, LogOut, Sparkles, PanelsTopLeft, Menu, X, UserCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface AppShellProps {
  children: React.ReactNode;
}

interface ProjectOption {
  id: string;
  name: string;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [boardName, setBoardName] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    const loadProjects = async () => {
      const { data } = await supabase.from("projects").select("id, name").eq("created_by", user.id).order("name");
      setProjects((data ?? []) as ProjectOption[]);
    };
    loadProjects();
  }, [user, supabase]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user) return;
    const loadNotifications = async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).eq("is_read", false).order("id", { ascending: false });
      setNotifications((data ?? []) as any[]);
    };
    loadNotifications();

    const channel = supabase.channel("notifications-realtime").on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
      (payload) => {
        setNotifications((current) => [payload.new as any, ...current]);
        toast.success("New notification received");
      },
    ).subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user]);

  const handleBoardCreate = async () => {
    if (!user || !boardName.trim()) return;
    setCreatingBoard(true);
    const { data, error } = await supabase.from("boards").insert({
      name: boardName,
      description: boardDescription,
      created_by: user.id,
      project_id: selectedProjectId || null,
    }).select("id").single();
    if (error || !data) {
      toast.error("Unable to create board");
      setCreatingBoard(false);
      return;
    }
    await supabase.from("board_members").insert({
      board_id: data.id,
      user_id: user.id,
      role: "Owner",
      status: "Accepted",
    });
    toast.success("Board created");
    setCreatingBoard(false);
    router.push(`/boards/${data.id}`);
  };

  const handleProjectCreate = async () => {
    if (!user || !projectName.trim()) return;
    setCreatingProject(true);
    const { error } = await supabase.from("projects").insert({
      name: projectName,
      description: "",
      created_by: user.id,
    });
    if (error) {
      toast.error("Unable to create project");
      setCreatingProject(false);
      return;
    }
    toast.success("Project created");
    setCreatingProject(false);
    setProjectName("");
    window.location.reload();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const acceptInvite = async (notification: any) => {
    if (!notification.related_id) return;
    const { error } = await supabase.from("board_members").update({ status: "Accepted" }).eq("board_id", notification.related_id).eq("user_id", user.id);
    if (!error) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      toast.success("Invite accepted");
    }
  };

  const respondToAssignment = async (notification: any, accepted: boolean) => {
    if (!notification.related_id || !user) return;
    const taskId = notification.related_id;
    
    const { data: taskData } = await supabase.from("tasks").select("id, name, created_by, board_id, assigned_to").eq("id", taskId).single();
    if (!taskData) return;
    
    const { data: boardData } = await supabase.from("boards").select("name").eq("id", taskData.board_id).single();
    const boardName = boardData?.name || "a board";

    // 💡 FIX: Assign a plain string instead of building a string array
    const newAssignedValue = accepted ? user.id : null;

    const { error } = await supabase
      .from("tasks")
      .update({ assigned_to: newAssignedValue }) // Perfect string mapping now!
      .eq("id", taskId);

    if (error) {
      toast.error("Unable to update assignment");
      return;
    }

    if (accepted && taskData.created_by && taskData.created_by !== user.id) {
      await supabase.rpc("create_notification", {
        p_user_id: taskData.created_by,
        p_title: "Assignment accepted",
        p_message: `${user.email || "A teammate"} accepted "${taskData.name}" in "${boardName}".`,
        p_type: "task_assignment_accepted",
        p_related_id: taskId,
      });
    } else if (!accepted && taskData.created_by && taskData.created_by !== user.id) {
      await supabase.rpc("create_notification", {
        p_user_id: taskData.created_by,
        p_title: "Assignment declined",
        p_message: `${user.email || "A teammate"} declined "${taskData.name}" in "${boardName}".`,
        p_type: "task_assignment_declined",
        p_related_id: taskId,
      });
    }

    await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
    toast.success(accepted ? "Assignment accepted" : "Assignment declined");
  };

  const dismissNotification = async (notification: any) => {
    if (notification.id?.toString().startsWith("reminder-")) {
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      return;
    }
    await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
  };

  const navItems = [
    { href: "/dashboard", label: "Recent Boards", icon: LayoutGrid },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/shared", label: "Shared Spaces", icon: Share2 },
    { href: "/profile", label: "Profile", icon: UserCircle2 },
  ];

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(120,119,198,0.2),_transparent_30%),linear-gradient(135deg,_#f8fafc,_#eef2ff)] text-slate-800">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 lg:px-6">
        <header className="mb-4 flex items-center justify-between rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-2 text-white"><PanelsTopLeft className="h-5 w-5" /></div>
            <div>
              <p className="text-lg font-semibold">Flowboard</p>
              <p className="text-xs text-slate-500">Real-time project planning</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="h-10 w-10 p-0 lg:hidden" onClick={() => setMobileMenuOpen((value) => !value)} aria-label="Toggle navigation">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" /> New
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <Dialog>
                  <DialogTrigger asChild>
                    <DropdownMenuItem>New board</DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create a board</DialogTitle>
                      <DialogDescription>Start a fresh workflow or connect it to a project.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Name</Label>
                        <Input value={boardName} onChange={(e) => setBoardName(e.target.value)} placeholder="Sprint planning" />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Input value={boardDescription} onChange={(e) => setBoardDescription(e.target.value)} placeholder="What is this board for?" />
                      </div>
                      <div>
                        <Label>Project</Label>
                        <Select onValueChange={setSelectedProjectId} value={selectedProjectId}>
                          <SelectTrigger>
                            <SelectValue placeholder="No project connection" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No project connection</SelectItem>
                            {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleBoardCreate} disabled={creatingBoard}>Create board</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog>
                  <DialogTrigger asChild>
                    <DropdownMenuItem>New project</DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create a project</DialogTitle>
                      <DialogDescription>Group boards under a shared initiative.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Project name</Label>
                        <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Launch 2026" />
                      </div>
                      <Button onClick={handleProjectCreate} disabled={creatingProject}>Create project</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                  <Bell className="h-5 w-5" />
                  {notifications.length > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                {notifications.length === 0 ? <div className="p-3 text-sm text-slate-500">No notifications yet.</div> : notifications.map((notification) => (
                  <div key={notification.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{notification.title}</p>
                      {notification.type === "board_invite" ? <Sparkles className="h-4 w-4 text-indigo-500" /> : <Bell className="h-4 w-4 text-slate-400" />}
                    </div>
                    <p className="mb-2 text-sm text-slate-500">{notification.message}</p>
                    <div className="flex flex-wrap gap-2">
                      {notification.type === "board_invite" && (
                        <Button size="sm" onClick={() => acceptInvite(notification)}>Accept invite</Button>
                      )}
                      {notification.type === "task_assignment_request" && (
                        <>
                          <Button size="sm" onClick={() => respondToAssignment(notification, true)}>Accept</Button>
                          <Button size="sm" variant="outline" onClick={() => respondToAssignment(notification, false)}>Decline</Button>
                        </>
                      )}
                      {notification.type === "task_due" && (
                        <Button size="sm" variant="outline" onClick={() => dismissNotification(notification)}>Okay</Button>
                      )}
                      {notification.type !== "task_due" && notification.type !== "board_invite" && notification.type !== "task_assignment_request" && (
                        <Button size="sm" variant="outline" onClick={() => dismissNotification(notification)}>Okay</Button>
                      )}
                    </div>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full px-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">{user?.email?.[0]?.toUpperCase() ?? "U"}</div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push("/profile")}>Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut} className="text-rose-600">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {mobileMenuOpen && (
          <div className="mb-4 rounded-2xl border border-white/70 bg-white/70 p-3 shadow-sm backdrop-blur-xl lg:hidden">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className={active ? "flex items-center gap-3 rounded-xl bg-indigo-50 px-3 py-3 text-sm font-medium text-indigo-700" : "flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 hover:bg-slate-100"}>
                    <Icon className="h-4 w-4" /> {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
        <div className="flex flex-1 gap-4">
          <aside className="hidden w-72 rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-xl lg:block">
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-white">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Workspace</span>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link key={item.href} href={item.href} className={active ? "flex items-center gap-3 rounded-xl bg-indigo-50 px-3 py-3 text-sm font-medium text-indigo-700" : "flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 hover:bg-slate-100"}>
                    <Icon className="h-4 w-4" /> {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="flex-1 rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-xl">{children}</main>
        </div>
      </div>
    </div>
  );
}

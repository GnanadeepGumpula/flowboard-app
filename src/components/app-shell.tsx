"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Bell, Plus, LogOut, Sparkles, UserCircle2, 
  Search, Globe, Smartphone, Layers, Folder, Users,
  Grid3X3, User, Menu, X
} from "lucide-react";
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

// Custom 9-Dot Logo matching the UI design
const BrandLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="5" cy="5" r="2.5" />
    <circle cx="12" cy="5" r="2.5" />
    <circle cx="19" cy="5" r="2.5" />
    <circle cx="5" cy="12" r="2.5" />
    <circle cx="12" cy="12" r="2.5" />
    <circle cx="19" cy="12" r="2.5" />
    <circle cx="5" cy="19" r="2.5" />
    <circle cx="12" cy="19" r="2.5" />
    <circle cx="19" cy="19" r="2.5" />
  </svg>
);

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  
  const [user, setUser] = useState<any>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // Board & Project Creation State
  const [boardName, setBoardName] = useState("");
  const [boardDescription, setBoardDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  
  const [approvalNotification, setApprovalNotification] = useState<any | null>(null);
  const [approvalRole, setApprovalRole] = useState("Update Progress");
  const [approvalLoading, setApprovalLoading] = useState(false);

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
    setBoardName("");
    setBoardDescription("");
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

  const openBoardAccessRequest = (notification: any) => {
    setApprovalNotification(notification);
    const requestedRole = notification.metadata?.requested_role;
    setApprovalRole(typeof requestedRole === "string" ? requestedRole : "Update Progress");
  };

  const approveBoardAccessRequest = async () => {
    if (!approvalNotification?.metadata) return;
    const { board_id, requester_id } = approvalNotification.metadata as any;
    if (!board_id || !requester_id) return;

    setApprovalLoading(true);
    const { error } = await supabase.from("board_members").update({ status: "Accepted", role: approvalRole }).eq("board_id", board_id).eq("user_id", requester_id);
    if (error) {
      toast.error("Unable to approve request");
      setApprovalLoading(false);
      return;
    }

    await supabase.from("notifications").update({ is_read: true }).eq("id", approvalNotification.id);
    setNotifications((current) => current.filter((item) => item.id !== approvalNotification.id));
    setApprovalNotification(null);
    setApprovalLoading(false);
    toast.success("Access approved");
  };

  const respondToAssignment = async (notification: any, accepted: boolean) => {
    if (!notification.related_id || !user) return;
    const taskId = notification.related_id;
    
    const { data: taskData } = await supabase.from("tasks").select("id, name, created_by, board_id, assigned_to").eq("id", taskId).single();
    if (!taskData) return;
    
    const { data: boardData } = await supabase.from("boards").select("name").eq("id", taskData.board_id).single();
    const boardName = boardData?.name || "a board";

    const newAssignedValue = accepted ? user.id : null;

    const { error } = await supabase
      .from("tasks")
      .update({ assigned_to: newAssignedValue })
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

  if (isAuthRoute) {
    return <>{children}</>;
  }

  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? "U";

  // Reusable Nav Icon Component for Sidebar and Mobile Bottom Nav
  const NavIcon = ({ icon: Icon, label, href, active }: any) => {
    const content = (
      <div className={`flex items-center justify-center transition-all duration-200 cursor-pointer 
        w-12 h-12 rounded-[16px] lg:w-11 lg:h-11 lg:rounded-[14px]
        ${active 
          ? "bg-[#8B5CF6] text-white shadow-md scale-105 lg:scale-100" 
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`}>
        <Icon className={active ? "w-[22px] h-[22px] lg:w-[20px] lg:h-[20px]" : "w-[24px] h-[24px] lg:w-[22px] lg:h-[22px] stroke-[1.5px]"} />
      </div>
    );

    return (
      <div className="relative group flex items-center justify-center flex-1 lg:flex-none w-full">
        {href ? <Link href={href} className="w-full flex justify-center outline-none">{content}</Link> : content}
        <div className="absolute lg:left-[110%] bottom-full mb-3 lg:mb-0 lg:bottom-auto lg:ml-2 px-3 py-1.5 bg-slate-800 text-white text-[12px] font-bold rounded-lg opacity-0 pointer-events-none lg:group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
          {label}
        </div>
      </div>
    );
  };

  // Reusable Create Dropdown (Used in both Desktop Sidebar and Mobile Nav)
  const renderCreateDropdown = () => (
    <DropdownMenu>
      <div className="relative group flex items-center justify-center outline-none flex-1 lg:flex-none w-full">
        <DropdownMenuTrigger asChild>
          <button className="w-12 h-12 lg:w-10 lg:h-10 flex items-center justify-center rounded-[16px] lg:rounded-[14px] bg-[#8B5CF6] hover:bg-[#7C3AED] text-white transition-colors shadow-md outline-none">
            <Plus className="w-[24px] h-[24px] lg:w-[22px] lg:h-[22px]" />
          </button>
        </DropdownMenuTrigger>
        
        {/* Hover Tooltip */}
        <div className="absolute lg:left-[110%] bottom-full mb-3 lg:mb-0 lg:bottom-auto lg:ml-3 px-3 py-1.5 bg-slate-800 text-white text-[12px] font-bold rounded-lg opacity-0 pointer-events-none lg:group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl">
          Create New
        </div>
      </div>

      <DropdownMenuContent align="center" sideOffset={16} className="w-56 rounded-[20px] p-2 shadow-xl border-slate-100 z-50 bg-white">
        
        {/* New Board Modal */}
        <Dialog>
          <DialogTrigger asChild>
            <DropdownMenuItem className="rounded-xl font-bold text-slate-700 cursor-pointer p-3 hover:bg-slate-50 hover:text-slate-900 outline-none" onSelect={(e) => e.preventDefault()}>
              New board
            </DropdownMenuItem>
          </DialogTrigger>
          <DialogContent className="rounded-[24px] border-slate-100 shadow-2xl p-6 sm:max-w-[425px] bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900">Create a board</DialogTitle>
              <DialogDescription className="font-medium text-slate-500">Start a fresh workflow or connect it to a project.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 mt-4">
              <div>
                <Label className="font-bold text-slate-700">Board Name</Label>
                <Input className="mt-1.5 rounded-[12px] bg-slate-50 border-slate-200 text-slate-900 h-11 px-4 focus:bg-white transition-colors font-medium" value={boardName} onChange={(e) => setBoardName(e.target.value)} placeholder="e.g. Sprint planning" />
              </div>
              <div>
                <Label className="font-bold text-slate-700">Description</Label>
                <Input className="mt-1.5 rounded-[12px] bg-slate-50 border-slate-200 text-slate-900 h-11 px-4 focus:bg-white transition-colors font-medium" value={boardDescription} onChange={(e) => setBoardDescription(e.target.value)} placeholder="What is this board for?" />
              </div>
              <div>
                <Label className="font-bold text-slate-700">Project Connection</Label>
                <Select onValueChange={setSelectedProjectId} value={selectedProjectId}>
                  <SelectTrigger className="mt-1.5 rounded-[12px] bg-slate-50 border-slate-200 text-slate-900 h-11 px-4 focus:bg-white transition-colors font-medium">
                    <SelectValue placeholder="No project connection" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white">
                    <SelectItem value="none" className="font-medium text-slate-700">No project connection</SelectItem>
                    {projects.map((project) => <SelectItem key={project.id} value={project.id} className="font-medium text-slate-700">{project.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-2">
                <Button className="w-full h-12 rounded-[14px] bg-[#8B5CF6] text-white font-bold text-[15px] hover:bg-[#7C3AED] transition-colors" onClick={handleBoardCreate} disabled={creatingBoard}>
                  {creatingBoard ? "Creating..." : "Create board"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* New Project Modal */}
        <Dialog>
          <DialogTrigger asChild>
            <DropdownMenuItem className="rounded-xl font-bold text-slate-700 cursor-pointer p-3 hover:bg-slate-50 hover:text-slate-900 outline-none" onSelect={(e) => e.preventDefault()}>
              New project
            </DropdownMenuItem>
          </DialogTrigger>
          <DialogContent className="rounded-[24px] border-slate-100 shadow-2xl p-6 sm:max-w-[425px] bg-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900">Create a project</DialogTitle>
              <DialogDescription className="font-medium text-slate-500">Group boards under a shared initiative.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5 mt-4">
              <div>
                <Label className="font-bold text-slate-700">Project name</Label>
                <Input className="mt-1.5 rounded-[12px] bg-slate-50 border-slate-200 text-slate-900 h-11 px-4 focus:bg-white transition-colors font-medium" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Launch 2026" />
              </div>
              <div className="pt-2">
                <Button className="w-full h-12 rounded-[14px] bg-[#8B5CF6] text-white font-bold text-[15px] hover:bg-[#7C3AED] transition-colors" onClick={handleProjectCreate} disabled={creatingProject}>
                  {creatingProject ? "Creating..." : "Create project"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#F4F4F5] lg:p-4 xl:p-6 font-sans antialiased text-slate-900 overflow-hidden">
      
      {/* App Container */}
      <div className="flex flex-1 w-full max-w-[1600px] mx-auto bg-[#F9F9FB] lg:rounded-[24px] lg:border border-slate-200/60 lg:shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative">
        
        {/* Desktop Sidebar (Left) */}
        <aside className="hidden lg:flex w-[80px] bg-white border-r border-slate-100 flex-col items-center py-6 justify-between shrink-0 z-30">
          <div className="space-y-6 flex flex-col items-center w-full">
            {/* Logo */}
            <div className="w-10 h-10 flex items-center justify-center text-[#8B5CF6] mb-2">
              <BrandLogo className="w-[28px] h-[28px]" />
            </div>
            
            {/* Nav Links */}
            <div className="space-y-3 flex flex-col items-center w-full px-2">
              <NavIcon icon={Grid3X3} label="Recent boards" href="/dashboard" active={pathname === "/dashboard" || pathname.startsWith("/boards")} />
              <NavIcon icon={Folder} label="Projects" href="/projects" active={pathname.startsWith("/projects")} />
              <NavIcon icon={Users} label="Shared Spaces" href="/shared" active={pathname.startsWith("/shared")} />
              <NavIcon icon={User} label="Profile" href="/profile" active={pathname.startsWith("/profile")} />
            </div>
          </div>

          {/* Create Button Desktop */}
          <div className="pb-2">
            {renderCreateDropdown()}
          </div>
        </aside>

        {/* Mobile Floating Bottom Nav */}
        <aside 
          className="lg:hidden fixed bottom-0 left-0 right-0 h-[80px] bg-white/95 backdrop-blur-xl border-t border-slate-200/60 flex items-center justify-around px-2 z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <NavIcon icon={Grid3X3} label="Boards" href="/dashboard" active={pathname === "/dashboard" || pathname.startsWith("/boards")} />
          <NavIcon icon={Folder} label="Projects" href="/projects" active={pathname.startsWith("/projects")} />
          
          {/* Create Button Mobile */}
          {renderCreateDropdown()}
          
          <NavIcon icon={Users} label="Shared" href="/shared" active={pathname.startsWith("/shared")} />
          <NavIcon icon={User} label="Profile" href="/profile" active={pathname.startsWith("/profile")} />
        </aside>

        {/* Right Content Area (Header + Main) */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-[#F9F9FB]">
          
          {/* Top Header */}
          <header className="h-[70px] lg:h-[80px] bg-white border-b border-slate-100 flex items-center justify-between px-5 lg:px-8 shrink-0 relative z-20 lg:rounded-t-2xl">
             
             {/* Mobile Logo */}
             <div className="flex items-center gap-2 text-slate-900 font-extrabold text-[20px] tracking-tight lg:hidden">
               <BrandLogo className="w-[24px] h-[24px] text-[#8B5CF6]" /> FlowBoard
             </div>

             {/* Desktop Logo */}
             <div className="hidden lg:flex items-center gap-2.5 text-slate-900 font-[800] text-[24px] tracking-tight">
               <BrandLogo className="w-[26px] h-[26px] text-[#8B5CF6]" /> FlowBoard
             </div>
             
             {/* Right Header Actions */}
             <div className="flex items-center gap-3 sm:gap-5">
               
               {/* Search Bar */}
               <div className="hidden sm:flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-[12px] px-3 h-10 w-48 lg:w-64 transition-all hover:border-slate-300 shadow-sm cursor-text">
                 <div className="flex items-center gap-2">
                   <Search className="w-[18px] h-[18px] text-slate-400 shrink-0" />
                   <span className="font-medium text-[14px] text-slate-400">Search</span>
                 </div>
                 <kbd className="font-sans font-bold text-slate-400 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded-[6px]">⌘K</kbd>
               </div>

               {/* Notifications Popover */}
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="relative w-10 h-10 rounded-full p-0 flex items-center justify-center hover:bg-slate-100 transition-colors outline-none">
                      <Bell className="w-[22px] h-[22px] text-slate-700" />
                      {notifications.length > 0 && <span className="absolute right-[8px] top-[8px] h-[9px] w-[9px] rounded-full bg-[#EA4335] ring-2 ring-white" />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[340px] rounded-[24px] p-3 shadow-2xl border-slate-100 mt-2 z-50">
                    <div className="px-3 pb-3 pt-1 flex items-center justify-between border-b border-slate-100 mb-2">
                      <span className="font-bold text-[15px] text-slate-900">Notifications</span>
                      {notifications.length > 0 && <span className="bg-indigo-50 text-indigo-600 text-xs font-bold px-2 py-0.5 rounded-full">{notifications.length} new</span>}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto pr-1">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-[14px] text-center font-semibold text-slate-400">All caught up!</div>
                      ) : notifications.map((notification) => (
                        <div key={notification.id} className="rounded-2xl p-4 mb-2 bg-slate-50/80 hover:bg-slate-50 transition-colors border border-slate-100/50">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[14px] font-bold text-slate-900 leading-tight">{notification.title}</p>
                            {notification.type === "board_invite" ? <Sparkles className="w-4 h-4 text-[#8B5CF6] shrink-0" /> : <Bell className="w-4 h-4 text-slate-400 shrink-0" />}
                          </div>
                          <p className="mb-4 text-[13px] font-medium text-slate-500 leading-snug">{notification.message}</p>
                          <div className="flex flex-wrap gap-2">
                            {notification.type === "board_invite" && (
                              <Button size="sm" className="rounded-[10px] h-8 font-bold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white" onClick={() => acceptInvite(notification)}>Accept invite</Button>
                            )}
                            {notification.type === "board_access_request" && (
                              <Button size="sm" className="rounded-[10px] h-8 font-bold bg-slate-900 text-white" onClick={() => openBoardAccessRequest(notification)}>Review request</Button>
                            )}
                            {notification.type === "task_assignment_request" && (
                              <>
                                <Button size="sm" className="rounded-[10px] h-8 font-bold bg-slate-900 text-white" onClick={() => respondToAssignment(notification, true)}>Accept</Button>
                                <Button size="sm" variant="outline" className="rounded-[10px] h-8 font-bold" onClick={() => respondToAssignment(notification, false)}>Decline</Button>
                              </>
                            )}
                            {notification.type === "task_due" && (
                              <Button size="sm" variant="outline" className="rounded-[10px] h-8 font-bold" onClick={() => dismissNotification(notification)}>Dismiss</Button>
                            )}
                            {notification.type !== "task_due" && notification.type !== "board_invite" && notification.type !== "task_assignment_request" && notification.type !== "board_access_request" && (
                              <Button size="sm" variant="outline" className="rounded-[10px] h-8 font-bold" onClick={() => dismissNotification(notification)}>Got it</Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </DropdownMenuContent>
               </DropdownMenu>

               {/* User Avatar */}
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded-full p-0 w-[38px] h-[38px] ml-1 overflow-hidden transition-transform active:scale-95 outline-none ring-2 ring-transparent hover:ring-slate-200">
                      <div className="flex w-full h-full items-center justify-center bg-[#DDCBB5] text-[15px] font-bold text-slate-800">
                        {avatarLetter}
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-[20px] p-2 shadow-xl border-slate-100 w-48 mt-2 z-50">
                    <DropdownMenuItem onClick={() => router.push("/profile")} className="rounded-[12px] font-semibold cursor-pointer p-3 hover:bg-slate-50">
                      <UserCircle2 className="mr-2.5 h-4 w-4 text-slate-500" /> Profile
                    </DropdownMenuItem>
                    <div className="h-px bg-slate-100 my-1 mx-2"></div>
                    <DropdownMenuItem onClick={handleSignOut} className="rounded-[12px] font-semibold cursor-pointer p-3 text-[#EA4335] focus:text-[#EA4335] focus:bg-rose-50">
                      <LogOut className="mr-2.5 h-4 w-4" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>

             </div>
          </header>

          {/* Main Content Area - Scroll bounded to strictly this container */}
          <main className="flex-1 overflow-y-auto pb-[80px] lg:pb-0 relative bg-[#F9F9FB] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {children}
          </main>

        </div>

        {/* Approval Modal */}
        <Dialog open={Boolean(approvalNotification)} onOpenChange={(open) => { if (!open) setApprovalNotification(null); }}>
          <DialogContent className="rounded-[24px] p-6 border-slate-100 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Approve board access</DialogTitle>
              <DialogDescription className="font-medium text-slate-500">Review the request and confirm the member's role.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="font-semibold text-slate-700">Board name</Label>
                <Input className="mt-1.5 rounded-xl bg-slate-50 border-slate-200 h-11" value={approvalNotification?.metadata?.board_name || ""} disabled />
              </div>
              <div>
                <Label className="font-semibold text-slate-700">Project name</Label>
                <Input className="mt-1.5 rounded-xl bg-slate-50 border-slate-200 h-11" value={approvalNotification?.metadata?.project_name || ""} disabled />
              </div>
              <div>
                <Label className="font-semibold text-slate-700">Requester email</Label>
                <Input className="mt-1.5 rounded-xl bg-slate-50 border-slate-200 h-11" value={approvalNotification?.metadata?.requester_email || ""} disabled />
              </div>
              <div>
                <Label className="font-semibold text-slate-700">Description</Label>
                <Input className="mt-1.5 rounded-xl bg-slate-50 border-slate-200 h-11" value={approvalNotification?.metadata?.board_description || ""} disabled />
              </div>
              <div>
                <Label className="font-semibold text-slate-700">Role</Label>
                <Select value={approvalRole} onValueChange={setApprovalRole}>
                  <SelectTrigger className="mt-1.5 rounded-xl bg-white border-slate-200 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl shadow-lg border-slate-100">
                    <SelectItem value="View Only" className="font-medium">View Only</SelectItem>
                    <SelectItem value="Update Progress" className="font-medium">Update Progress</SelectItem>
                    <SelectItem value="Add/Delete Task" className="font-medium">Add/Delete Task</SelectItem>
                    <SelectItem value="Editor" className="font-medium">Editor</SelectItem>
                    <SelectItem value="Owner" className="font-medium">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-end gap-3 mt-4">
                <Button variant="outline" className="rounded-xl h-11 font-bold" onClick={() => setApprovalNotification(null)}>Cancel</Button>
                <Button className="rounded-xl h-11 bg-slate-900 font-bold" onClick={approveBoardAccessRequest} disabled={approvalLoading}>{approvalLoading ? "Approving..." : "Accept"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { FolderKanban, PlusCircle, Pencil, Trash2, Globe, Smartphone, Layers, Folder, Search, Filter, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ProjectRecord {
  id: string;
  name: string;
  description: string | null;
  boards: Array<{ id: string; name: string }>;
}

// Helper to match visual styling of cards
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

export default function ProjectsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 1. Updated loadProjects for silent background refresh
  const loadProjects = useCallback(async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setLoading(true);
    
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    setCurrentUserId(userId ?? null);
    
    if (!userId) {
      if (!isBackgroundRefresh) setLoading(false);
      return;
    }
    
    const { data, error } = await supabase.from("projects").select("id, name, description").eq("created_by", userId).order("name");
    
    if (!error) {
      const expanded = await Promise.all((data ?? []).map(async (project) => {
        const { data: boards } = await supabase.from("boards").select("id, name").eq("project_id", project.id).order("name");
        return { ...project, boards: boards ?? [] } as ProjectRecord;
      }));
      setProjects(expanded);
    }
    setLoading(false);
  }, [supabase]);

  // 2. Initial load
  useEffect(() => {
    loadProjects(false);
  }, [loadProjects]);

  // 3. Real-time Subscription for Projects & Boards
  useEffect(() => {
    if (!currentUserId) return;
    
    const channel = supabase
      .channel(`realtime:projects_${currentUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `created_by=eq.${currentUserId}` }, () => {
        loadProjects(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "boards" }, () => {
        loadProjects(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadProjects, supabase]);

  const handleCreate = async () => {
    if (!currentUserId || !name.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("projects").insert({ name, description: "", created_by: currentUserId });
    setCreating(false);
    if (error) {
      toast.error("Unable to create project");
      return;
    }
    toast.success("Project created");
    setName("");
    loadProjects(true); // Silent refresh
  };

  const handleDelete = async (projectId: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", projectId);
    if (error) {
      toast.error("Unable to delete project");
      return;
    }
    toast.success("Project deleted");
    loadProjects(true); // Silent refresh
  };

  const handleEdit = async (projectId: string) => {
    if (!editingName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("projects").update({ name: editingName.trim() }).eq("id", projectId);
    setSaving(false);
    if (error) {
      toast.error("Unable to update project");
      return;
    }
    toast.success("Project updated");
    setEditingProjectId(null);
    setEditingName("");
    loadProjects(true); // Silent refresh
  };

  if (loading) return <div className="py-20 flex justify-center items-center h-full"><div className="animate-pulse flex flex-col items-center"><div className="h-10 w-10 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin"></div><p className="mt-4 text-slate-500 font-medium">Loading projects...</p></div></div>;

  return (
    <div className="space-y-8 pt-4 max-w-[1200px] mx-auto">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold text-slate-900 tracking-tight">Projects</h1>
          <p className="mt-1 text-[15px] font-medium text-slate-500">Organize work by initiative</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="rounded-xl h-10 px-4 font-bold bg-slate-900 text-white shadow-md hover:scale-105 transition-transform">
                <PlusCircle className="mr-2 h-4 w-4" /> New project
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[24px] border-slate-100 shadow-2xl p-6 sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Create a project</DialogTitle>
                <DialogDescription className="font-medium text-slate-500">Group related boards under one workspace.</DialogDescription>
              </DialogHeader>
              <div className="space-y-5 mt-4">
                <div>
                  <Label className="font-semibold text-slate-700">Project name</Label>
                  <Input className="mt-1.5 rounded-xl bg-slate-50 border-slate-200 h-11 px-4 focus:bg-white transition-colors" value={name} onChange={(e) => setName(e.target.value)} placeholder="Quarterly launch" />
                </div>
                <div className="pt-2">
                  <Button className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold text-[15px] hover:bg-slate-800 transition-colors" onClick={handleCreate} disabled={creating}>
                    {creating ? "Creating..." : "Create project"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-200 bg-white/50 px-8 py-24 text-center">
          <div className="mb-5 rounded-[16px] bg-[#8B5CF6] p-4 text-white shadow-xl shadow-[#8B5CF6]/20">
            <FolderKanban className="h-8 w-8" />
          </div>
          <h2 className="text-[22px] font-extrabold text-slate-900">No projects yet</h2>
          <p className="mt-2 max-w-sm text-[15px] font-medium text-slate-500">Create one to start grouping boards.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project, index) => {
            const ProjectIcon = [Globe, Smartphone, Layers][index % 3] || Folder;
            return (
              <div key={project.id} className="group relative rounded-[24px] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] overflow-hidden flex flex-col h-[280px]">
                
                {/* Colorful Top Gradient Area */}
                <div 
                  className="h-[100px] w-full p-5 relative" 
                  style={{ background: getGradientStyle(index) }}
                >
                  <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]"></div>
                  {/* Category Tag */}
                  <div className="relative z-10 inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-md rounded-lg px-3 py-1.5 text-[12px] font-bold text-slate-800 shadow-sm">
                    <ProjectIcon className="w-3.5 h-3.5 text-slate-600" />
                    {project.name}
                  </div>
                  <div className="absolute top-5 right-5 z-10 flex gap-2">
                    <button onClick={() => { setEditingProjectId(project.id); setEditingName(project.name); }} className="w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-slate-600 transition-colors shadow-sm backdrop-blur-md"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDelete(project.id)} className="w-8 h-8 rounded-full bg-white/80 hover:bg-rose-50 flex items-center justify-center text-rose-500 transition-colors shadow-sm backdrop-blur-md"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                {/* Card Content Area */}
                <div className="p-5 flex flex-col flex-1 relative -mt-4 bg-white rounded-t-[20px]">
                  
                  {editingProjectId === project.id ? (
                    <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                      <Input className="h-10 rounded-lg bg-white" value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" className="rounded-lg font-bold bg-slate-900" onClick={() => handleEdit(project.id)} disabled={saving}>Save</Button>
                        <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => { setEditingProjectId(null); setEditingName(""); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-[20px] font-bold text-slate-900 leading-tight mb-2 truncate">{project.name}</h3>
                      <p className="text-[14px] font-medium text-slate-500 mb-4">
                        {project.boards.length} board(s)
                      </p>
                    </>
                  )}

                  {/* Boards List */}
                  <div className="mt-auto space-y-2 overflow-y-auto max-h-[100px] pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {project.boards.length === 0 ? (
                      <p className="text-[13px] font-medium text-slate-400 italic">No boards linked yet.</p>
                    ) : (
                      project.boards.map((board) => (
                        <Link 
                          key={board.id} 
                          href={`/boards/${board.id}`} 
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 hover:bg-slate-100 hover:border-slate-200 transition-colors group/board"
                        >
                          <span className="text-[13px] font-bold text-slate-700 truncate mr-2">{board.name}</span>
                          <span className="text-slate-400 group-hover/board:text-slate-600 font-bold">›</span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
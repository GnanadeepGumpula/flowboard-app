"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { FolderKanban, PlusCircle, Pencil, Trash2 } from "lucide-react";
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
      // Listen for changes to this user's projects (renamed, created, deleted)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `created_by=eq.${currentUserId}` }, () => {
        loadProjects(true);
      })
      // Listen for changes to boards (in case a board is added/removed from a project)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-500">Projects</p>
          <h1 className="mt-2 text-3xl font-semibold">Organize work by initiative</h1>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button><PlusCircle className="mr-2 h-4 w-4" /> New project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a project</DialogTitle>
              <DialogDescription>Group related boards under one workspace.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Project name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Quarterly launch" />
              </div>
              <Button onClick={handleCreate} disabled={creating}>Create project</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <div className="text-sm text-slate-500">Loading projects...</div> : projects.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-sm text-slate-500">No projects yet. Create one to start grouping boards.</div> : <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => (
          <div key={project.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><FolderKanban className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold">{project.name}</p>
                  <p className="text-sm text-slate-500">{project.boards.length} board(s)</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingProjectId(project.id); setEditingName(project.name); }} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(project.id)} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            {editingProjectId === project.id && (
              <div className="mt-4 space-y-2">
                <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleEdit(project.id)} disabled={saving}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingProjectId(null); setEditingName(""); }}>Cancel</Button>
                </div>
              </div>
            )}
            <div className="mt-4 space-y-2">
              {project.boards.length === 0 ? <p className="text-sm text-slate-500">No boards linked yet.</p> : project.boards.map((board) => <Link key={board.id} href={`/boards/${board.id}`} className="block rounded-xl border border-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">{board.name}</Link>)}
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface ProjectOption {
  id: string;
  name: string;
}

export default function NewBoardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.from("projects").select("id, name").eq("created_by", userId).order("name");
      setProjects((data ?? []) as ProjectOption[]);
      setLoading(false);
    };

    loadProjects();
  }, [supabase]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a board name.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      toast.error("You need to sign in before creating boards.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("boards")
      .insert({
        name,
        description,
        created_by: userId,
        project_id: projectId || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("Board create error", error);
      toast.error(error?.message ?? "Unable to create board.");
      setSaving(false);
      return;
    }

    await supabase.from("board_members").insert({
      board_id: data.id,
      user_id: userId,
      role: "Owner",
      status: "Accepted",
    });

    toast.success("Board created");
    router.push(`/boards/${data.id}`);
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-sm backdrop-blur-xl">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-500">Create board</p>
        <h1 className="mt-2 text-3xl font-semibold">Start a fresh workflow</h1>
        <p className="mt-2 text-sm text-slate-500">Give it a name, add context, and optionally link it to a project.</p>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Board name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint planning" />
        </div>
        <div>
          <Label>Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this board for?" />
        </div>
        <div>
          <Label>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="No project connection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No project connection</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreate} disabled={saving || loading}>
          {saving ? "Creating board..." : "Create board"}
        </Button>
      </div>
    </div>
  );
}

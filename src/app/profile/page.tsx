"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, LayoutGrid, Sparkles, UserCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ProfileData {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface BoardSummary {
  id: string;
  name: string;
  description: string | null;
}

interface CompletedTask {
  id: string;
  name: string;
  board_name: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [createdBoards, setCreatedBoards] = useState<BoardSummary[]>([]);
  const [acceptedBoards, setAcceptedBoards] = useState<BoardSummary[]>([]);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        router.replace("/login");
        return;
      }

      const [{ data: profileData }, { data: createdBoardsData }, { data: acceptedMemberships }, { data: completedTasksData }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, avatar_url").eq("id", userId).single(),
        supabase.from("boards").select("id, name, description").eq("created_by", userId).order("name"),
        supabase.from("board_members").select("board_id").eq("user_id", userId).eq("status", "Accepted"),
        supabase.from("tasks").select("id, name, board_id").eq("assigned_to", userId).eq("status", "done"),
      ]);

      const boardIds = (acceptedMemberships ?? []).map((entry: any) => entry.board_id).filter(Boolean);
      const { data: acceptedBoardsData } = boardIds.length > 0
        ? await supabase.from("boards").select("id, name, description").in("id", boardIds).order("name")
        : { data: [] };

      const boardNameMap = new Map((acceptedBoardsData ?? []).map((board: any) => [board.id, board.name]));
      const taskRows = (completedTasksData ?? []).map((task: any) => ({
        id: task.id,
        name: task.name,
        board_name: boardNameMap.get(task.board_id) ?? null,
      }));

      setProfile(profileData as ProfileData | null);
      setFullName(profileData?.full_name ?? "");
      setAvatarUrl(profileData?.avatar_url ?? "");
      setCreatedBoards((createdBoardsData ?? []) as BoardSummary[]);
      setAcceptedBoards((acceptedBoardsData ?? []) as BoardSummary[]);
      setCompletedTasks(taskRows);
      setLoading(false);
    };

    loadProfile();
  }, [router, supabase]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName || null, avatar_url: avatarUrl || null }).eq("id", profile.id);
    if (error) {
      toast.error("Unable to update profile");
    } else {
      toast.success("Profile updated");
      setProfile((current) => current ? { ...current, full_name: fullName || null, avatar_url: avatarUrl || null } : current);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading profile...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-500">Profile</p>
        <h1 className="mt-2 text-3xl font-semibold">Your account and activity</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-xl font-semibold text-white">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="h-16 w-16 rounded-full object-cover" /> : <UserCircle2 className="h-8 w-8" />}
            </div>
            <div>
              <p className="text-xl font-semibold">{profile?.full_name || profile?.email || "Your profile"}</p>
              <p className="text-sm text-slate-500">{profile?.email}</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
            </div>
            <div>
              <Label>Avatar URL</Label>
              <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Password</p>
              <p className="mt-1">Password changes are handled securely through Supabase authentication.</p>
            </div>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save profile"}</Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-semibold">Board history</h2>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Created by you</p>
                {createdBoards.length === 0 ? <p className="mt-1 text-sm text-slate-500">No boards created yet.</p> : createdBoards.map((board) => <div key={board.id} className="mt-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">{board.name}</div>)}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Accepted shared boards</p>
                {acceptedBoards.length === 0 ? <p className="mt-1 text-sm text-slate-500">No accepted shared boards yet.</p> : acceptedBoards.map((board) => <div key={board.id} className="mt-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">{board.name}</div>)}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-semibold">Completed tasks</h2>
            </div>
            <div className="mt-4 space-y-2">
              {completedTasks.length === 0 ? <p className="text-sm text-slate-500">No completed tasks yet.</p> : completedTasks.map((task) => <div key={task.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">{task.name}{task.board_name ? ` · ${task.board_name}` : ""}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

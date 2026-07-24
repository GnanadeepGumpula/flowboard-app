"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { FolderKanban, CheckCircle2, UserCircle2, Sparkles, LayoutGrid, Users } from "lucide-react";
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
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [createdBoards, setCreatedBoards] = useState<BoardSummary[]>([]);
  const [acceptedBoards, setAcceptedBoards] = useState<BoardSummary[]>([]);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // 1. Extracted loadProfile for silent background refreshing
  const loadProfile = useCallback(async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    setCurrentUserId(userId ?? null);

    if (!userId) {
      if (!isBackgroundRefresh) {
        window.location.href = "/login";
      }
      return;
    }

    const [{ data: profileData }, { data: createdBoardsData }, { data: acceptedMemberships }, { data: completedTasksData }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, avatar_url").eq("id", userId).single(),
      supabase.from("boards").select("id, name, description").eq("created_by", userId).order("name"),
      supabase.from("board_members").select("board_id").eq("user_id", userId).eq("status", "Accepted"),
      supabase.from("tasks").select("id, name, board_id").contains("assigned_to", [userId]).eq("status", "done"),
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
    
    // Only update the input fields on the initial load so we don't overwrite user typing
    if (!isBackgroundRefresh) {
      setFullName(profileData?.full_name ?? "");
      setAvatarUrl(profileData?.avatar_url ?? "");
    }
    
    setCreatedBoards((createdBoardsData ?? []) as BoardSummary[]);
    setAcceptedBoards((acceptedBoardsData ?? []) as BoardSummary[]);
    setCompletedTasks(taskRows);
    setLoading(false);
  }, [supabase]);

  // 2. Initial Load
  useEffect(() => {
    loadProfile(false);
  }, [loadProfile]);

  // 3. Real-time Subscription for Profile updates
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`realtime:profile_${currentUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${currentUserId}` }, () => {
        loadProfile(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "boards" }, () => {
        loadProfile(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "board_members", filter: `user_id=eq.${currentUserId}` }, () => {
        loadProfile(true);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        loadProfile(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, loadProfile, supabase]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName || null, avatar_url: avatarUrl || null }).eq("id", profile.id);
    if (error) {
      toast.error("Unable to update profile");
    } else {
      toast.success("Profile updated");
      setProfile((current) => current ? { ...current, full_name: fullName || null, avatar_url: avatarUrl || null } : current);
      loadProfile(true); // Sync across active sessions
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center h-full">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-10 w-10 border-4 border-[#8B5CF6] border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  const avatarLetter = (profile?.full_name || profile?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="space-y-8 pt-4 max-w-[1200px] mx-auto pb-10">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-extrabold text-slate-900 tracking-tight">Profile</h1>
          <p className="mt-1 text-[15px] font-medium text-slate-500">Your account and activity details</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        
        {/* Left Column: Profile Editor */}
        <div className="rounded-[24px] border border-slate-100 bg-white p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-max">
          <div className="flex items-center gap-5 mb-8">
            <div className="flex h-[80px] w-[80px] items-center justify-center rounded-full bg-[#E5D4FF] text-[32px] font-bold text-[#8B5CF6] shadow-sm border-4 border-white ring-1 ring-slate-100 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                avatarLetter
              )}
            </div>
            <div>
              <p className="text-[22px] font-extrabold text-slate-900 leading-tight">{profile?.full_name || "Anonymous User"}</p>
              <p className="text-[14px] font-medium text-slate-500 mt-1">{profile?.email}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <Label className="font-bold text-slate-700 text-[13px]">Full name</Label>
              <Input 
                className="mt-1.5 h-12 rounded-[12px] bg-slate-50 border-slate-200 focus:bg-white transition-colors px-4 font-medium" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                placeholder="Your name" 
              />
            </div>
            <div>
              <Label className="font-bold text-slate-700 text-[13px]">Avatar URL</Label>
              <Input 
                className="mt-1.5 h-12 rounded-[12px] bg-slate-50 border-slate-200 focus:bg-white transition-colors px-4 font-medium" 
                value={avatarUrl} 
                onChange={(e) => setAvatarUrl(e.target.value)} 
                placeholder="https://..." 
              />
            </div>
            <div className="rounded-[16px] border border-slate-100 bg-slate-50 p-4 shadow-sm mt-4">
              <p className="font-bold text-[14px] text-slate-900">Password & Security</p>
              <p className="mt-1.5 text-[13px] font-medium text-slate-500 leading-relaxed">
                Password changes and primary email updates are handled securely through your Supabase authentication provider.
              </p>
            </div>
            <div className="pt-3">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="w-full h-12 rounded-[12px] bg-slate-900 hover:bg-slate-800 text-white font-bold text-[15px] transition-colors"
              >
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Activity & History */}
        <div className="space-y-6">
          
          {/* Board History Card */}
          <div className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-[12px] bg-[#F1EBFF] text-[#8B5CF6] flex items-center justify-center">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <h2 className="text-[18px] font-extrabold text-slate-900">Board history</h2>
            </div>
            
            <div className="space-y-5">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Created by you</p>
                <div className="space-y-2">
                  {createdBoards.length === 0 ? (
                    <p className="text-[13px] font-medium text-slate-400 italic px-1">No boards created yet.</p>
                  ) : (
                    createdBoards.map((board) => (
                      <Link key={board.id} href={`/boards/${board.id}`} className="flex items-center justify-between rounded-[14px] border border-slate-100 bg-slate-50/50 px-4 py-3 hover:bg-slate-50 transition-colors group">
                        <span className="text-[14px] font-bold text-slate-700 truncate">{board.name}</span>
                        <span className="text-slate-300 font-bold group-hover:text-slate-500">›</span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
              
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">Shared with you</p>
                <div className="space-y-2">
                  {acceptedBoards.length === 0 ? (
                    <p className="text-[13px] font-medium text-slate-400 italic px-1">No accepted shared boards yet.</p>
                  ) : (
                    acceptedBoards.map((board) => (
                      <Link key={board.id} href={`/boards/${board.id}`} className="flex items-center justify-between rounded-[14px] border border-slate-100 bg-[#E6F8F3]/30 px-4 py-3 hover:bg-[#E6F8F3]/60 transition-colors group">
                        <div className="flex items-center gap-2 truncate">
                          <Users className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                          <span className="text-[14px] font-bold text-slate-700 truncate">{board.name}</span>
                        </div>
                        <span className="text-slate-300 font-bold group-hover:text-[#10B981]">›</span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Completed Tasks Card */}
          <div className="rounded-[24px] border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-[12px] bg-[#D1FAE5] text-[#10B981] flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h2 className="text-[18px] font-extrabold text-slate-900">Completed tasks</h2>
            </div>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {completedTasks.length === 0 ? (
                <p className="text-[13px] font-medium text-slate-400 italic px-1">No completed tasks yet. Keep going!</p>
              ) : (
                completedTasks.map((task) => (
                  <div key={task.id} className="flex flex-col justify-center rounded-[14px] border border-slate-100 bg-slate-50/50 px-4 py-3">
                    <span className="text-[14px] font-bold text-slate-700 truncate line-through decoration-slate-300">{task.name}</span>
                    {task.board_name && (
                      <span className="text-[11px] font-semibold text-slate-400 mt-0.5 truncate">{task.board_name}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
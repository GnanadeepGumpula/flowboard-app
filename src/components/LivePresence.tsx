"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

interface LivePresenceProps {
  boardId: string;
  currentUserId: string | null;
  currentUserProfile: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
}

interface Cursor {
  x: number; // Stored as a percentage (0 to 1) so it scales on different screen sizes
  y: number;
  user_id: string;
}

interface OnlineUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  color: string;
}

const CURSOR_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];

export default function LivePresence({ boardId, currentUserId, currentUserProfile }: LivePresenceProps) {
  const supabase = useMemo(() => createClient(), []);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(new Map());
  const [cursors, setCursors] = useState<Map<string, Cursor>>(new Map());

  // Generate a consistent color based on user ID
  const getUserColor = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
  };

  useEffect(() => {
    if (!currentUserId || !currentUserProfile) return;

    const channel = supabase.channel(`presence:board_${boardId}`, {
      config: {
        presence: { key: currentUserId },
        broadcast: { self: false },
      },
    });

    // 1. Listen for Online Users (Presence)
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const users = new Map<string, OnlineUser>();
      
      for (const [key, presenceArray] of Object.entries(state)) {
        if (presenceArray.length > 0) {
          const p = presenceArray[0] as any;
          users.set(key, {
            user_id: p.user_id,
            full_name: p.full_name,
            avatar_url: p.avatar_url,
            color: getUserColor(p.user_id),
          });
        }
      }
      setOnlineUsers(users);
    });

    // 2. Listen for Live Mouse Cursors (Broadcast)
    channel.on("broadcast", { event: "cursor-move" }, (payload) => {
      setCursors((prev) => {
        const newCursors = new Map(prev);
        newCursors.set(payload.payload.user_id, payload.payload);
        return newCursors;
      });
    });

    // 3. Join the channel and share our presence
    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: currentUserId,
          full_name: currentUserProfile.full_name || currentUserProfile.email || "Teammate",
          avatar_url: currentUserProfile.avatar_url,
        });
      }
    });

    // 4. Track local mouse movement and broadcast it
    let lastMove = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastMove < 50) return; // Throttle to ~20fps to save bandwidth
      lastMove = now;

      // Calculate position as a percentage of the window
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;

      channel.send({
        type: "broadcast",
        event: "cursor-move",
        payload: { user_id: currentUserId, x, y },
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Cleanup
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      supabase.removeChannel(channel);
    };
  }, [boardId, currentUserId, currentUserProfile, supabase]);

  return (
    <>
      {/* 1. Online Users Avatars (Top Right) */}
      <div className="fixed top-6 right-6 z-40 flex items-center -space-x-3">
        {Array.from(onlineUsers.values()).map((user) => {
          const initials = user.full_name.charAt(0).toUpperCase();
          return (
            <div 
              key={user.user_id} 
              className="relative h-10 w-10 rounded-full border-2 border-white shadow-sm ring-2 ring-transparent transition hover:z-10 hover:-translate-y-1"
              title={`${user.full_name} is online`}
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name} className="h-full w-full rounded-full object-cover" />
              ) : (
                <div 
                  className="flex h-full w-full items-center justify-center rounded-full font-bold text-white text-sm"
                  style={{ backgroundColor: user.color }}
                >
                  {initials}
                </div>
              )}
              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-white"></span>
            </div>
          );
        })}
      </div>

      {/* 2. Live Cursors Overlay */}
      {Array.from(cursors.values()).map((cursor) => {
        const user = onlineUsers.get(cursor.user_id);
        if (!user || cursor.user_id === currentUserId) return null;

        return (
          <div
            key={cursor.user_id}
            className="pointer-events-none fixed z-50 transition-all duration-75 ease-linear"
            style={{ 
              left: `${cursor.x * 100}vw`, 
              top: `${cursor.y * 100}vh`,
            }}
          >
            {/* Custom SVG Mouse Pointer */}
            <svg
              width="24"
              height="36"
              viewBox="0 0 24 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-md"
            >
              <path
                d="M5.65376 2.15376C5.40428 1.57177 4.59572 1.57177 4.34624 2.15376L0.260515 11.6871C0.0381488 12.206 0.443048 12.7844 1.01166 12.756L5.5 12.5L7.5 17.5C7.71281 18.0319 8.44186 18.0854 8.72996 17.591L13.8055 8.8911C14.0722 8.43396 13.784 7.8427 13.2458 7.74235L8.5 6.85714L5.65376 2.15376Z"
                fill={user.color}
                stroke="white"
                strokeWidth="1.5"
              />
            </svg>
            <div
              className="mt-1 ml-4 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: user.color }}
            >
              {user.full_name}
            </div>
          </div>
        );
      })}
    </>
  );
}
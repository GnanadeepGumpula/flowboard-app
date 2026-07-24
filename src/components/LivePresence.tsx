"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

interface LivePresenceProps {
  boardId: string;
  currentUserId: string | null;
  onlineUsers: any[];
}

interface Cursor {
  x: number;
  y: number;
  user_id: string;
}

export default function LivePresence({ boardId, currentUserId, onlineUsers }: LivePresenceProps) {
  const supabase = useMemo(() => createClient(), []);
  const [cursors, setCursors] = useState<Map<string, Cursor>>(new Map());

  useEffect(() => {
    if (!currentUserId) return;

    // Use a completely separate channel for cursors to avoid race conditions with presence
    const channel = supabase.channel(`cursors:board_${boardId}`);

    channel.on("broadcast", { event: "cursor-move" }, (payload) => {
      setCursors((prev) => {
        const newCursors = new Map(prev);
        newCursors.set(payload.payload.user_id, payload.payload);
        return newCursors;
      });
    });

    channel.subscribe();

    let lastMove = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastMove < 50) return; // Throttle 20fps to save bandwidth
      lastMove = now;

      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;

      channel.send({
        type: "broadcast",
        event: "cursor-move",
        payload: { user_id: currentUserId, x, y },
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      supabase.removeChannel(channel);
    };
  }, [boardId, currentUserId, supabase]);

  return (
    <>
      {Array.from(cursors.values()).map((cursor) => {
        const user = onlineUsers.find((u) => u.user_id === cursor.user_id);
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
            {/* Live Cursor Pointer SVG */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-md relative -left-1 -top-1"
            >
              <path
                d="M5.65376 2.15376C5.40428 1.57177 4.59572 1.57177 4.34624 2.15376L0.260515 11.6871C0.0381488 12.206 0.443048 12.7844 1.01166 12.756L5.5 12.5L7.5 17.5C7.71281 18.0319 8.44186 18.0854 8.72996 17.591L13.8055 8.8911C14.0722 8.43396 13.784 7.8427 13.2458 7.74235L8.5 6.85714L5.65376 2.15376Z"
                fill={user.color || "#8B5CF6"}
                stroke="white"
                strokeWidth="1.5"
              />
            </svg>
            <div
              className="mt-1 ml-4 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold text-white shadow-md"
              style={{ backgroundColor: user.color || "#8B5CF6" }}
            >
              {user.full_name}
            </div>
          </div>
        );
      })}
    </>
  );
}
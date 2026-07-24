"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { MessageCircle, X, Send, Edit2, Trash2, Reply, Smile, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";

interface BoardChatProps {
  boardId: string;
  currentUserId: string | null;
  members: any[];
}

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  reply_to_id: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  reactions: Record<string, string[]>;
  created_at: string;
}

const EMOJIS = ["👍", "❤️", "😂", "🎉", "👀"];

export default function BoardChat({ boardId, currentUserId, members }: BoardChatProps) {
  const supabase = useMemo(() => createClient(), []);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("board_messages")
        .select("*")
        .eq("board_id", boardId)
        .order("created_at", { ascending: true });

      if (error) {
        toast.error("Failed to load messages");
        return;
      }
      setMessages(data as ChatMessage[]);
      scrollToBottom();
    };

    fetchMessages();

    const channel = supabase
      .channel(`chat_${boardId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "board_messages", filter: `board_id=eq.${boardId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as ChatMessage;
            setMessages((prev) => [...prev, newMsg]);
            scrollToBottom();
            
            // Increment unread count only if the chat is closed and the message is not from the current user
            if (!isOpen && newMsg.user_id !== currentUserId) {
              setUnreadCount((prev) => prev + 1);
            }
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) => prev.map((msg) => (msg.id === payload.new.id ? (payload.new as ChatMessage) : msg)));
          } else if (payload.eventType === "DELETE") {
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, supabase, currentUserId, isOpen]);

  // Reset unread count when chat is opened
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      scrollToBottom();
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
  };

  const getMemberProfile = (userId: string) => {
    return members.find((m) => m.user_id === userId)?.profiles;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !currentUserId) return;

    const content = inputValue.trim();
    setInputValue("");

    if (editingMsg) {
      const { error } = await supabase.from("board_messages").update({ content, is_edited: true }).eq("id", editingMsg.id);
      if (error) toast.error("Failed to edit message");
      setEditingMsg(null);
    } else {
      const { error } = await supabase.from("board_messages").insert({
        board_id: boardId,
        user_id: currentUserId,
        content,
        reply_to_id: replyingTo?.id || null,
      });
      if (error) toast.error("Failed to send message");
      setReplyingTo(null);
    }
  };

  const handleDelete = async (msgId: string) => {
    const { error } = await supabase.from("board_messages").update({ is_deleted: true, content: "" }).eq("id", msgId);
    if (error) toast.error("Failed to delete message");
  };

  const toggleReaction = async (msg: ChatMessage, emoji: string) => {
    if (!currentUserId) return;
    const currentReactions = { ...msg.reactions };
    const usersWhoReacted = currentReactions[emoji] || [];
    
    if (usersWhoReacted.includes(currentUserId)) {
      currentReactions[emoji] = usersWhoReacted.filter((id) => id !== currentUserId);
      if (currentReactions[emoji].length === 0) delete currentReactions[emoji];
    } else {
      currentReactions[emoji] = [...usersWhoReacted, currentUserId];
    }
    await supabase.from("board_messages").update({ reactions: currentReactions }).eq("id", msg.id);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-[100px] lg:bottom-6 right-4 lg:right-6 h-[52px] px-6 rounded-full bg-gradient-to-r from-[#A555F5] to-[#4F46E5] shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-transform hover:scale-105 z-50 flex items-center justify-center gap-2 border-[2px] border-white/20"
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-5 w-5 text-white fill-current opacity-90" />
        )}
        
        {/* Only show external red badge if closed AND unread count > 0 */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-[22px] h-[22px] bg-[#EF4444] rounded-full border-[2.5px] border-white flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-[165px] lg:bottom-24 right-4 lg:right-6 z-50 flex h-[450px] lg:h-[500px] w-[calc(100vw-32px)] sm:w-96 flex-col overflow-hidden rounded-[24px] border border-white/60 bg-white shadow-[0_24px_64px_rgba(70,60,140,0.2)] transition-all">
          
          <div className="flex items-center justify-between border-b bg-slate-900 px-5 py-4 text-white shrink-0">
            <h3 className="font-extrabold text-[16px]">Board Chat</h3>
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
               <span className="h-2 w-2 rounded-full bg-green-400" /> Live
            </span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.length === 0 ? (
              <p className="text-center text-sm font-medium text-slate-400 mt-10">No messages yet. Say hi to your team!</p>
            ) : (
              messages.map((msg) => {
                const profile = getMemberProfile(msg.user_id);
                const isMe = msg.user_id === currentUserId;
                const replyMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;

                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-700">
                        {isMe ? "You" : profile?.full_name || profile?.email || "User"}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {format(new Date(msg.created_at), "h:mm a")}
                      </span>
                    </div>

                    <div className={`group relative max-w-[85%] rounded-[16px] px-4 py-2.5 text-[14px] font-medium shadow-sm ${
                      msg.is_deleted ? "bg-slate-100 italic text-slate-400 border border-slate-200" 
                      : isMe ? "bg-[#8B5CF6] text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                    }`}>
                      
                      {!msg.is_deleted && replyMsg && (
                        <div className={`mb-1.5 border-l-2 pl-2 text-[12px] opacity-75 ${isMe ? "border-white/50" : "border-slate-300"}`}>
                          <span className="font-bold">{replyMsg.user_id === currentUserId ? "You" : getMemberProfile(replyMsg.user_id)?.full_name || "User"}: </span>
                          <span className="line-clamp-1">{replyMsg.is_deleted ? "Message deleted" : replyMsg.content}</span>
                        </div>
                      )}

                      {msg.is_deleted ? "This message was deleted." : msg.content}
                      {msg.is_edited && !msg.is_deleted && <span className="ml-2 text-[10px] opacity-60">(edited)</span>}

                      {!msg.is_deleted && (
                        <div className={`absolute -top-3 hidden items-center gap-1 rounded-lg border bg-white p-1 shadow-md group-hover:flex ${isMe ? "right-0" : "left-0"}`}>
                          <button onClick={() => setReplyingTo(msg)} className="text-slate-400 hover:text-indigo-600 p-1"><Reply className="h-3.5 w-3.5" /></button>
                          
                          <div className="relative flex group/emoji">
                            <button className="text-slate-400 hover:text-amber-500 p-1"><Smile className="h-3.5 w-3.5" /></button>
                            <div className="absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 items-center gap-1 rounded-full border bg-white px-2 py-1 shadow-md group-hover/emoji:flex">
                              {EMOJIS.map(e => (
                                <button key={e} onClick={() => toggleReaction(msg, e)} className="hover:scale-110">{e}</button>
                              ))}
                            </div>
                          </div>

                          {isMe && (
                            <>
                              <button onClick={() => { setEditingMsg(msg); setInputValue(msg.content); }} className="text-slate-400 hover:text-blue-500 p-1"><Edit2 className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleDelete(msg.id)} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {Object.keys(msg.reactions || {}).length > 0 && !msg.is_deleted && (
                      <div className={`mt-1 flex flex-wrap gap-1 ${isMe ? "justify-end" : "justify-start"}`}>
                        {Object.entries(msg.reactions).map(([emoji, users]) => (
                          <button 
                            key={emoji}
                            onClick={() => toggleReaction(msg, emoji)}
                            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium bg-white shadow-sm ${users.includes(currentUserId!) ? "border-[#8B5CF6] bg-indigo-50" : "border-slate-200"}`}
                          >
                            <span>{emoji}</span>
                            <span className="text-slate-500">{users.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t bg-white p-3 shrink-0">
            {(replyingTo || editingMsg) && (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 border border-slate-200">
                <div className="line-clamp-1 flex-1">
                  <span className="font-bold text-[#8B5CF6]">{editingMsg ? "Editing message" : `Replying to ${getMemberProfile(replyingTo!.user_id)?.full_name || "User"}`}</span>
                  <span className="ml-2 font-medium">{editingMsg ? editingMsg.content : replyingTo?.content}</span>
                </div>
                <button onClick={() => { setReplyingTo(null); setEditingMsg(null); setInputValue(""); }} className="ml-2 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
              </div>
            )}
            
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <Input 
                value={inputValue} 
                onChange={(e) => setInputValue(e.target.value)} 
                placeholder="Type a message..." 
                className="flex-1 rounded-full h-11 border-slate-200 bg-slate-50 focus-visible:ring-[#8B5CF6] px-4 font-medium"
              />
              <Button type="submit" disabled={!inputValue.trim()} size="sm" className="h-11 w-11 rounded-full bg-[#8B5CF6] hover:bg-[#7C3AED] shrink-0">
                {editingMsg ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </div>

        </div>
      )}
    </>
  );
}
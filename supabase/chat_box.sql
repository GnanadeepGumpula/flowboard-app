-- 1. Create the board_messages table
CREATE TABLE public.board_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    reply_to_id uuid REFERENCES public.board_messages(id) ON DELETE SET NULL, -- For threading/replies
    is_edited boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    reactions jsonb DEFAULT '{}'::jsonb NOT NULL, -- For emoji reactions
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.board_messages ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- READ: Anyone with access to the board can read the messages
CREATE POLICY board_messages_read ON public.board_messages 
  FOR SELECT TO authenticated 
  USING (public.has_board_access(board_id));

-- INSERT: Board Owners and Accepted Members can send messages
CREATE POLICY board_messages_insert ON public.board_messages 
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_id AND b.created_by = auth.uid())
    OR public.get_board_role(board_id) IS NOT NULL
  );

-- UPDATE: Only the author of the message can edit it (or add reactions)
CREATE POLICY board_messages_update ON public.board_messages 
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- DELETE: Only the author of the message can delete it
CREATE POLICY board_messages_delete ON public.board_messages 
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4. Enable Realtime Streaming for the chat
ALTER TABLE public.board_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_messages;
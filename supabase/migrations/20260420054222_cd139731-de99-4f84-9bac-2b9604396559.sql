-- Tutor conversations
CREATE TABLE public.tutor_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tutor_conversations_user ON public.tutor_conversations(user_id, updated_at DESC);

ALTER TABLE public.tutor_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
  ON public.tutor_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
  ON public.tutor_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.tutor_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON public.tutor_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER tutor_conversations_updated_at
  BEFORE UPDATE ON public.tutor_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tutor messages
CREATE TABLE public.tutor_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.tutor_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tutor_messages_conv ON public.tutor_messages(conversation_id, created_at);

ALTER TABLE public.tutor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON public.tutor_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
  ON public.tutor_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.tutor_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
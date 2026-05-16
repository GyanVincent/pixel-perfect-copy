
CREATE TABLE public.generated_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic TEXT,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL,
  explanation TEXT,
  content_hash TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX gq_subject_hash_idx ON public.generated_questions(subject_id, content_hash);
CREATE INDEX gq_subject_diff_idx ON public.generated_questions(subject_id, difficulty);

ALTER TABLE public.generated_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Generated questions readable by authenticated"
  ON public.generated_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert generated questions"
  ON public.generated_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE TABLE public.user_question_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.generated_questions(id) ON DELETE CASCADE,
  subject_id UUID,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
CREATE INDEX uqh_user_subject_idx ON public.user_question_history(user_id, subject_id, seen_at DESC);

ALTER TABLE public.user_question_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own history"
  ON public.user_question_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own history"
  ON public.user_question_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own history"
  ON public.user_question_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

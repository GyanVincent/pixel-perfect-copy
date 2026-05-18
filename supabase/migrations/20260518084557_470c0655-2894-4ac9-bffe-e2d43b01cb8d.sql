
CREATE TABLE public.daily_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date date NOT NULL UNIQUE,
  question_ids uuid[] NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily challenges readable by authenticated"
  ON public.daily_challenges FOR SELECT TO authenticated USING (true);

CREATE TABLE public.daily_challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge_id uuid NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  challenge_date date NOT NULL,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (user_id, challenge_id)
);

ALTER TABLE public.daily_challenge_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own attempts"
  ON public.daily_challenge_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own attempts"
  ON public.daily_challenge_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own attempts"
  ON public.daily_challenge_attempts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_daily_attempts_user_date
  ON public.daily_challenge_attempts (user_id, challenge_date DESC);

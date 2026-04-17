ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'L200',
  ADD COLUMN IF NOT EXISTS semester INTEGER NOT NULL DEFAULT 2;

CREATE INDEX IF NOT EXISTS idx_subjects_level_semester ON public.subjects(level, semester);
-- ============ TABLES ============
CREATE TABLE public.study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description TEXT CHECK (char_length(description) <= 500),
  invite_code TEXT NOT NULL UNIQUE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.study_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE public.study_group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.study_group_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  url TEXT CHECK (char_length(url) <= 2000),
  notes TEXT CHECK (char_length(notes) <= 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.study_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_sgm_group ON public.study_group_messages(group_id, created_at DESC);
CREATE INDEX idx_sgr_group ON public.study_group_resources(group_id, created_at DESC);
CREATE INDEX idx_sgmem_group ON public.study_group_members(group_id);
CREATE INDEX idx_sgmem_user ON public.study_group_members(user_id);
CREATE INDEX idx_ps_group ON public.practice_sessions(group_id) WHERE group_id IS NOT NULL;

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.study_group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.study_groups
    WHERE id = _group_id AND owner_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Trigger: auto-set invite code + add owner as member
CREATE OR REPLACE FUNCTION public.handle_new_study_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    LOOP
      new_code := public.generate_invite_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.study_groups WHERE invite_code = new_code);
      attempts := attempts + 1;
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Could not generate unique invite code';
      END IF;
    END LOOP;
    NEW.invite_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_study_group_invite_code
BEFORE INSERT ON public.study_groups
FOR EACH ROW EXECUTE FUNCTION public.handle_new_study_group();

CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.study_group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER add_study_group_owner
AFTER INSERT ON public.study_groups
FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

CREATE TRIGGER update_study_groups_updated_at
BEFORE UPDATE ON public.study_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS ============
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_group_resources ENABLE ROW LEVEL SECURITY;

-- study_groups
CREATE POLICY "Members can view their groups"
ON public.study_groups FOR SELECT TO authenticated
USING (public.is_group_member(id, auth.uid()));

CREATE POLICY "Anyone authenticated can create a group"
ON public.study_groups FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can update group"
ON public.study_groups FOR UPDATE TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Owner can delete group"
ON public.study_groups FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

-- Allow looking up a group by invite code (limited fields exposed via app)
CREATE POLICY "Anyone authenticated can lookup by invite code"
ON public.study_groups FOR SELECT TO authenticated
USING (true);

-- study_group_members
CREATE POLICY "Members can view co-members"
ON public.study_group_members FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Users can join groups themselves"
ON public.study_group_members FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave groups"
ON public.study_group_members FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_group_owner(group_id, auth.uid()));

-- study_group_messages
CREATE POLICY "Members can read messages"
ON public.study_group_messages FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Members can send messages"
ON public.study_group_messages FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Authors or owner can delete messages"
ON public.study_group_messages FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_group_owner(group_id, auth.uid()));

-- study_group_resources
CREATE POLICY "Members can read resources"
ON public.study_group_resources FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Members can post resources"
ON public.study_group_resources FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Authors or owner can delete resources"
ON public.study_group_resources FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.is_group_owner(group_id, auth.uid()));

-- Update practice_sessions select policy to allow group members to see shared sessions
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.practice_sessions;
CREATE POLICY "Users can view their own or group sessions"
ON public.practice_sessions FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
);

-- ============ REALTIME ============
ALTER TABLE public.study_group_messages REPLICA IDENTITY FULL;
ALTER TABLE public.study_group_members REPLICA IDENTITY FULL;
ALTER TABLE public.study_group_resources REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.study_group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.study_group_resources;
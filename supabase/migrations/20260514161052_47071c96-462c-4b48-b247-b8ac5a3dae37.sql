-- 1. Update handle_new_user to fallback to email username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta_name TEXT;
  fallback_name TEXT;
BEGIN
  meta_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), '');
  fallback_name := split_part(COALESCE(NEW.email, ''), '@', 1);
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(meta_name, NULLIF(fallback_name, ''), 'Member'));
  RETURN NEW;
END;
$function$;

-- 2. Backfill existing empty profile names from auth.users.email
UPDATE public.profiles p
SET full_name = split_part(u.email, '@', 1)
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.full_name IS NULL OR TRIM(p.full_name) = '')
  AND u.email IS NOT NULL
  AND split_part(u.email, '@', 1) <> '';

-- 3. Add file metadata to study_group_resources
ALTER TABLE public.study_group_resources
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- 4. Create private storage bucket for group files
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-files', 'group-files', false)
ON CONFLICT (id) DO NOTHING;

-- 5. RLS for group-files: path layout is {group_id}/{user_id}/{filename}
CREATE POLICY "Group members can read group files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'group-files'
  AND public.is_group_member(
    ((storage.foldername(name))[1])::uuid,
    auth.uid()
  )
);

CREATE POLICY "Group members can upload group files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'group-files'
  AND public.is_group_member(
    ((storage.foldername(name))[1])::uuid,
    auth.uid()
  )
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Uploaders or group owners can delete group files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'group-files'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR public.is_group_owner(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  )
);
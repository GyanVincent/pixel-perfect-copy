-- Allow group owners to update member roles (needed for ownership transfer)
CREATE POLICY "Owners can update member roles"
ON public.study_group_members
FOR UPDATE
TO authenticated
USING (public.is_group_owner(group_id, auth.uid()))
WITH CHECK (public.is_group_owner(group_id, auth.uid()));
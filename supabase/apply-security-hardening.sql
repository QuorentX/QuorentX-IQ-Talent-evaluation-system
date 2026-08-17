-- Apply in Supabase SQL Editor if not already applied.
-- Same content as migrations/20260815120000_security_hardening.sql

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.email,''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "attempts_student_update" ON public.attempts;
CREATE POLICY "attempts_student_update" ON public.attempts
FOR UPDATE TO authenticated
USING (student_id = auth.uid() AND status = 'in_progress')
WITH CHECK (
  student_id = auth.uid()
  AND status = 'in_progress'
);

DROP POLICY IF EXISTS "answers_student_update" ON public.answers;
CREATE POLICY "answers_student_update" ON public.answers
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.attempts t
    WHERE t.id = answers.attempt_id AND t.student_id = auth.uid() AND t.status = 'in_progress'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.attempts t
    WHERE t.id = answers.attempt_id AND t.student_id = auth.uid() AND t.status = 'in_progress'
  )
  AND awarded_points IS NULL
);

NOTIFY pgrst, 'reload schema';

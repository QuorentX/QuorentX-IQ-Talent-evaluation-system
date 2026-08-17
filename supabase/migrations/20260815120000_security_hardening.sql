-- Security hardening: stop trusting signup metadata for admin role;
-- prevent students from rewriting attempt scores / answer points.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.email,''))
  ON CONFLICT (id) DO NOTHING;
  -- Always assign student on signup; admin is granted only via trusted server ops.
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

-- Students may only write response content while in progress (not awarded_points).
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

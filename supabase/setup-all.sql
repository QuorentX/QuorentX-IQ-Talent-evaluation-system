-- QTalent schema bootstrap (idempotent) for project mxwjyvxluhkgsvsathxb
-- Safe to re-run.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','student');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.question_type AS ENUM ('mcq','coding','written');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.attempt_status AS ENUM ('in_progress','submitted','graded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.interview_status AS ENUM ('scheduled','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "roles_select" ON public.user_roles;
CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  duration_minutes int NOT NULL DEFAULT 60,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  type public.question_type NOT NULL,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  language text NOT NULL DEFAULT '',
  points int NOT NULL DEFAULT 1,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.question_keys (
  question_id uuid PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  correct_option int,
  model_answer text NOT NULL DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_keys TO authenticated;
GRANT ALL ON public.question_keys TO service_role;
ALTER TABLE public.question_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.attempt_status NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  auto_score int NOT NULL DEFAULT 0,
  total_score int NOT NULL DEFAULT 0,
  max_score int NOT NULL DEFAULT 0,
  UNIQUE (assessment_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attempts TO authenticated;
GRANT ALL ON public.attempts TO service_role;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option int,
  response text NOT NULL DEFAULT '',
  awarded_points int,
  feedback text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answers TO authenticated;
GRANT ALL ON public.answers TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Interview',
  scheduled_at timestamptz NOT NULL,
  mode text NOT NULL DEFAULT 'video',
  location text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  status public.interview_status NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;
GRANT ALL ON public.interviews TO service_role;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assessments_admin_all" ON public.assessments;
CREATE POLICY "assessments_admin_all" ON public.assessments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "assessments_student_read" ON public.assessments;
CREATE POLICY "assessments_student_read" ON public.assessments FOR SELECT TO authenticated USING (
  is_published AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.assessment_id = assessments.id AND a.student_id = auth.uid())
);

DROP POLICY IF EXISTS "assignments_admin_all" ON public.assignments;
CREATE POLICY "assignments_admin_all" ON public.assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "assignments_student_read" ON public.assignments;
CREATE POLICY "assignments_student_read" ON public.assignments FOR SELECT TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS "questions_admin_all" ON public.questions;
CREATE POLICY "questions_admin_all" ON public.questions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "questions_student_read" ON public.questions;
CREATE POLICY "questions_student_read" ON public.questions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.assignments a WHERE a.assessment_id = questions.assessment_id AND a.student_id = auth.uid())
);

DROP POLICY IF EXISTS "question_keys_admin_all" ON public.question_keys;
CREATE POLICY "question_keys_admin_all" ON public.question_keys FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "attempts_admin_all" ON public.attempts;
CREATE POLICY "attempts_admin_all" ON public.attempts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "attempts_student_read" ON public.attempts;
CREATE POLICY "attempts_student_read" ON public.attempts FOR SELECT TO authenticated USING (student_id = auth.uid());
DROP POLICY IF EXISTS "attempts_student_insert" ON public.attempts;
CREATE POLICY "attempts_student_insert" ON public.attempts FOR INSERT TO authenticated WITH CHECK (
  student_id = auth.uid() AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.assessment_id = attempts.assessment_id AND a.student_id = auth.uid())
);
DROP POLICY IF EXISTS "attempts_student_update" ON public.attempts;
CREATE POLICY "attempts_student_update" ON public.attempts FOR UPDATE TO authenticated USING (student_id = auth.uid() AND status = 'in_progress') WITH CHECK (student_id = auth.uid() AND status = 'in_progress');

DROP POLICY IF EXISTS "answers_admin_all" ON public.answers;
CREATE POLICY "answers_admin_all" ON public.answers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "answers_student_read" ON public.answers;
CREATE POLICY "answers_student_read" ON public.answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.attempts t WHERE t.id = answers.attempt_id AND t.student_id = auth.uid())
);
DROP POLICY IF EXISTS "answers_student_write" ON public.answers;
CREATE POLICY "answers_student_write" ON public.answers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.attempts t WHERE t.id = answers.attempt_id AND t.student_id = auth.uid() AND t.status = 'in_progress')
);
DROP POLICY IF EXISTS "answers_student_update" ON public.answers;
CREATE POLICY "answers_student_update" ON public.answers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.attempts t WHERE t.id = answers.attempt_id AND t.student_id = auth.uid() AND t.status = 'in_progress')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.attempts t WHERE t.id = answers.attempt_id AND t.student_id = auth.uid() AND t.status = 'in_progress')
  AND awarded_points IS NULL
);

DROP POLICY IF EXISTS "interviews_admin_all" ON public.interviews;
CREATE POLICY "interviews_admin_all" ON public.interviews FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "interviews_student_read" ON public.interviews;
CREATE POLICY "interviews_student_read" ON public.interviews FOR SELECT TO authenticated USING (student_id = auth.uid());

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

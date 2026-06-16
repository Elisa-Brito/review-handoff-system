-- Migration 012: Database functions and triggers
-- Created: 2026-06-16

-- ============================================================
-- 1. updated_at trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'projects',
    'project_members',
    'screens',
    'comment_threads',
    'comments',
    'handoffs',
    'deployments',
    'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'updated_at'
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
         CREATE TRIGGER set_updated_at
           BEFORE UPDATE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();',
        t, t
      );
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- 2. create_audit_log function
-- ============================================================

CREATE OR REPLACE FUNCTION create_audit_log(
  p_project_id  UUID,
  p_action      TEXT,
  p_entity_type TEXT,
  p_entity_id   UUID,
  p_before      JSONB DEFAULT NULL,
  p_after       JSONB DEFAULT NULL,
  p_metadata    JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID;
  v_user_email TEXT;
  v_log_id     UUID;
BEGIN
  v_user_id := auth.uid();

  SELECT email
  INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO audit_logs (
    project_id,
    user_id,
    user_email,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    metadata
  ) VALUES (
    p_project_id,
    v_user_id,
    v_user_email,
    p_action,
    p_entity_type,
    p_entity_id,
    p_before,
    p_after,
    COALESCE(p_metadata, '{}')
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============================================================
-- 3. comment_threads triggers
-- ============================================================

CREATE OR REPLACE FUNCTION trg_comment_threads_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_audit_log(
    NEW.project_id,
    'thread.created',
    'comment_thread',
    NEW.id,
    NULL,
    to_jsonb(NEW),
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comment_threads_after_insert ON public.comment_threads;
CREATE TRIGGER comment_threads_after_insert
  AFTER INSERT ON public.comment_threads
  FOR EACH ROW EXECUTE FUNCTION trg_comment_threads_after_insert();

CREATE OR REPLACE FUNCTION trg_comment_threads_after_update_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM create_audit_log(
      NEW.project_id,
      'thread.status_changed',
      'comment_thread',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      NULL
    );

    INSERT INTO comment_history (
      thread_id,
      project_id,
      action,
      previous_status,
      new_status,
      performed_by,
      metadata
    ) VALUES (
      NEW.id,
      NEW.project_id,
      'status_changed',
      OLD.status,
      NEW.status,
      auth.uid(),
      jsonb_build_object('thread_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comment_threads_after_update_status ON public.comment_threads;
CREATE TRIGGER comment_threads_after_update_status
  AFTER UPDATE OF status ON public.comment_threads
  FOR EACH ROW EXECUTE FUNCTION trg_comment_threads_after_update_status();

-- ============================================================
-- 4. comments triggers
-- ============================================================

CREATE OR REPLACE FUNCTION trg_comments_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT project_id
  INTO v_project_id
  FROM comment_threads
  WHERE id = NEW.thread_id;

  PERFORM create_audit_log(
    v_project_id,
    'comment.created',
    'comment',
    NEW.id,
    NULL,
    to_jsonb(NEW),
    jsonb_build_object('thread_id', NEW.thread_id)
  );

  UPDATE comment_threads
  SET updated_at = NOW()
  WHERE id = NEW.thread_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_after_insert ON public.comments;
CREATE TRIGGER comments_after_insert
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION trg_comments_after_insert();

CREATE OR REPLACE FUNCTION trg_comments_after_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  SELECT project_id
  INTO v_project_id
  FROM comment_threads
  WHERE id = NEW.thread_id;

  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    PERFORM create_audit_log(
      v_project_id,
      'comment.deleted',
      'comment',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      jsonb_build_object('thread_id', NEW.thread_id)
    );
  ELSE
    PERFORM create_audit_log(
      v_project_id,
      'comment.updated',
      'comment',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      jsonb_build_object('thread_id', NEW.thread_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_after_update ON public.comments;
CREATE TRIGGER comments_after_update
  AFTER UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION trg_comments_after_update();

-- ============================================================
-- 5. handoffs triggers
-- ============================================================

CREATE OR REPLACE FUNCTION trg_handoffs_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_audit_log(
    NEW.project_id,
    'handoff.generated',
    'handoff',
    NEW.id,
    NULL,
    to_jsonb(NEW),
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handoffs_after_insert ON public.handoffs;
CREATE TRIGGER handoffs_after_insert
  AFTER INSERT ON public.handoffs
  FOR EACH ROW EXECUTE FUNCTION trg_handoffs_after_insert();

CREATE OR REPLACE FUNCTION trg_handoffs_after_update_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM create_audit_log(
      NEW.project_id,
      'handoff.status_changed',
      'handoff',
      NEW.id,
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status),
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handoffs_after_update_status ON public.handoffs;
CREATE TRIGGER handoffs_after_update_status
  AFTER UPDATE OF status ON public.handoffs
  FOR EACH ROW EXECUTE FUNCTION trg_handoffs_after_update_status();

-- ============================================================
-- 6. deployments trigger
-- ============================================================

CREATE OR REPLACE FUNCTION trg_deployments_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_audit_log(
    NEW.project_id,
    'deployment.created',
    'deployment',
    NEW.id,
    NULL,
    to_jsonb(NEW),
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deployments_after_insert ON public.deployments;
CREATE TRIGGER deployments_after_insert
  AFTER INSERT ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION trg_deployments_after_insert();

-- ============================================================
-- 7. get_thread_with_comments function
-- ============================================================

CREATE OR REPLACE FUNCTION get_thread_with_comments(p_thread_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'thread', to_jsonb(t),
    'comments', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'comment', to_jsonb(c),
            'author', jsonb_build_object(
              'id',         u.id,
              'email',      u.email,
              'raw_user_meta_data', u.raw_user_meta_data
            )
          )
          ORDER BY c.created_at ASC
        )
        FROM comments c
        JOIN auth.users u ON u.id = c.created_by
        WHERE c.thread_id = t.id
          AND c.deleted_at IS NULL
      ),
      '[]'::JSONB
    )
  )
  INTO v_result
  FROM comment_threads t
  WHERE t.id = p_thread_id;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 8. get_screen_comment_count function
-- ============================================================

CREATE OR REPLACE FUNCTION get_screen_comment_count(p_screen_id UUID)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)
  FROM comment_threads
  WHERE screen_id = p_screen_id
    AND status = 'open';
$$;

-- ============================================================
-- 9. Auto-create owner project_member on project insert
-- ============================================================

CREATE OR REPLACE FUNCTION trg_projects_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO project_members (
      project_id,
      user_id,
      role
    ) VALUES (
      NEW.id,
      auth.uid(),
      'owner'
    )
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_after_insert ON public.projects;
CREATE TRIGGER projects_after_insert
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION trg_projects_after_insert();

-- ============================================================
-- 10. generate_version_number function
-- ============================================================

CREATE OR REPLACE FUNCTION generate_version_number(p_project_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_count    BIGINT;
  v_major    BIGINT;
  v_minor    BIGINT;
  v_patch    BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM deployments
  WHERE project_id = p_project_id;

  -- Version scheme: every 100 deployments bumps minor, every 10000 bumps major
  -- Default cadence: 1.0.0 -> 1.0.1 -> ... -> 1.0.99 -> 1.1.0 -> ...
  v_major := v_count / 10000;
  v_minor := (v_count % 10000) / 100;
  v_patch := v_count % 100;

  RETURN format('%s.%s.%s', v_major + 1, v_minor, v_patch);
END;
$$;

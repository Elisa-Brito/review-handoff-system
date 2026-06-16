-- ========== 001_organizations.sql ==========
-- Migration: 001_create_organizations
-- Created: 2026-06-16

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON organizations (slug);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_set_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ========== 002_projects.sql ==========
-- Migration: 002_create_projects_table
-- Created: 2026-06-16

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  settings jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_status ON projects(status);

-- ========== 003_project_members.sql ==========
-- Migration: 003_create_project_members
-- Created at: 2026-06-16

CREATE TABLE project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'reviewer', 'viewer')),
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz,
  joined_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_project_members_role ON project_members(role);


-- ========== 004_deployments.sql ==========
-- Migration 004: Create deployments table
-- Created: 2026-06-16

CREATE TABLE deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number text NOT NULL,
  vercel_deployment_id text,
  vercel_url text,
  commit_sha text,
  branch text,
  environment text NOT NULL DEFAULT 'preview' CHECK (environment IN ('preview', 'production', 'staging')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'ready', 'error', 'cancelled')),
  metadata jsonb NOT NULL DEFAULT '{}',
  deployed_by uuid REFERENCES auth.users(id),
  deployed_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, version_number)
);

CREATE INDEX idx_deployments_project_id ON deployments(project_id);
CREATE INDEX idx_deployments_vercel_deployment_id ON deployments(vercel_deployment_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_branch ON deployments(branch);

CREATE OR REPLACE FUNCTION update_deployments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deployments_updated_at
  BEFORE UPDATE ON deployments
  FOR EACH ROW
  EXECUTE FUNCTION update_deployments_updated_at();


-- ========== 005_screens.sql ==========
-- Migration 005: Create screens table

CREATE TABLE screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deployment_id uuid REFERENCES deployments(id) ON DELETE SET NULL,
  name text NOT NULL,
  route text NOT NULL,
  description text,
  screenshot_url text,
  metadata jsonb NOT NULL DEFAULT '{}',
  order_index integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_screens_project_id ON screens(project_id);
CREATE INDEX idx_screens_deployment_id ON screens(deployment_id);
CREATE INDEX idx_screens_route ON screens(route);

CREATE OR REPLACE FUNCTION update_screens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_screens_updated_at
  BEFORE UPDATE ON screens
  FOR EACH ROW
  EXECUTE FUNCTION update_screens_updated_at();

-- ========== 006_comment_threads.sql ==========
-- Migration 006: comment_threads table
-- Created: 2026-06-16

CREATE TABLE comment_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  screen_id uuid NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  deployment_id uuid REFERENCES deployments(id) ON DELETE SET NULL,

  -- Element targeting
  element_selector text,
  element_xpath text,
  position_x float NOT NULL,
  position_y float NOT NULL,
  viewport_width integer,
  viewport_height integer,

  -- Status
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'reopened')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),

  -- Resolution
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,

  -- Author
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comment_threads_project_id ON comment_threads(project_id);
CREATE INDEX idx_comment_threads_screen_id ON comment_threads(screen_id);
CREATE INDEX idx_comment_threads_deployment_id ON comment_threads(deployment_id);
CREATE INDEX idx_comment_threads_status ON comment_threads(status);
CREATE INDEX idx_comment_threads_created_by ON comment_threads(created_by);

CREATE OR REPLACE FUNCTION update_comment_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comment_threads_updated_at
  BEFORE UPDATE ON comment_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_threads_updated_at();

-- ========== 007_comments.sql ==========
-- Migration 007: Create comments table
-- Individual messages within a comment thread

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Content
  content text NOT NULL,
  content_html text,

  -- Is this the first/root comment of the thread?
  is_root boolean NOT NULL DEFAULT false,

  -- Soft delete
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users(id),

  -- Edit tracking
  edited_at timestamptz,
  edited_by uuid REFERENCES auth.users(id),

  -- Author
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_comments_thread_id ON comments(thread_id);
CREATE INDEX idx_comments_project_id ON comments(project_id);
CREATE INDEX idx_comments_created_by ON comments(created_by);
CREATE INDEX idx_comments_is_root ON comments(is_root);

-- Partial index for active (non-deleted) comments per thread
CREATE INDEX idx_comments_thread_active ON comments(thread_id) WHERE deleted_at IS NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Project members can read non-deleted comments
CREATE POLICY "comments_select" ON comments
  FOR SELECT
  USING (
    deleted_at IS NULL
    AND project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Authenticated project members can insert
CREATE POLICY "comments_insert" ON comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND project_id IN (
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- Only the author can update their own comment
CREATE POLICY "comments_update" ON comments
  FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Only the author (or an admin) can soft-delete; hard delete is not exposed
CREATE POLICY "comments_delete" ON comments
  FOR UPDATE
  USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = comments.project_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );


-- ========== 008_comment_history.sql ==========
-- Migration 008: comment_history audit trail table

CREATE TABLE comment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- What changed
  action text NOT NULL CHECK (action IN ('created', 'resolved', 'reopened', 'updated', 'deleted', 'replied')),
  previous_status text,
  new_status text,

  -- Who and when
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  performed_at timestamptz NOT NULL DEFAULT now(),

  -- Extra context
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_comment_history_thread_id ON comment_history (thread_id);
CREATE INDEX idx_comment_history_project_id ON comment_history (project_id);
CREATE INDEX idx_comment_history_performed_by ON comment_history (performed_by);
CREATE INDEX idx_comment_history_action ON comment_history (action);
CREATE INDEX idx_comment_history_performed_at ON comment_history (performed_at);


-- ========== 009_handoffs.sql ==========
-- Migration 009: Create handoffs table
-- Created: 2026-06-16

CREATE TABLE handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  screen_id uuid REFERENCES screens(id) ON DELETE SET NULL,
  deployment_id uuid REFERENCES deployments(id) ON DELETE SET NULL,

  -- Content
  title text NOT NULL,
  content_markdown text NOT NULL,

  -- Sections (stored separately for structured access)
  overview text,
  business_objective text,
  user_stories jsonb NOT NULL DEFAULT '[]',
  acceptance_criteria jsonb NOT NULL DEFAULT '[]',
  edge_cases jsonb NOT NULL DEFAULT '[]',
  api_dependencies jsonb NOT NULL DEFAULT '[]',
  analytics_events jsonb NOT NULL DEFAULT '[]',
  technical_notes text,
  design_decisions jsonb NOT NULL DEFAULT '[]',

  -- Meta
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

  -- Author
  generated_by uuid NOT NULL REFERENCES auth.users(id),
  generated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_handoffs_project_id ON handoffs(project_id);
CREATE INDEX idx_handoffs_screen_id ON handoffs(screen_id);
CREATE INDEX idx_handoffs_deployment_id ON handoffs(deployment_id);
CREATE INDEX idx_handoffs_status ON handoffs(status);

CREATE OR REPLACE FUNCTION update_handoffs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_handoffs_updated_at
  BEFORE UPDATE ON handoffs
  FOR EACH ROW
  EXECUTE FUNCTION update_handoffs_updated_at();


-- ========== 010_audit_logs.sql ==========
-- Migration 010: audit_logs table
-- Created: 2026-06-16

BEGIN;

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,

  -- Actor
  user_id uuid NOT NULL REFERENCES auth.users(id),
  user_email text,

  -- Action
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,

  -- Context
  ip_address inet,
  user_agent text,

  -- Data
  before_state jsonb,
  after_state jsonb,
  metadata jsonb NOT NULL DEFAULT '{}',

  -- Timestamp (immutable â€” no updated_at)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_audit_logs_organization_id ON audit_logs (organization_id);
CREATE INDEX idx_audit_logs_project_id ON audit_logs (project_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs (entity_type);
CREATE INDEX idx_audit_logs_entity_id ON audit_logs (entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX idx_audit_logs_org_created ON audit_logs (organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_project_created ON audit_logs (project_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_created ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id, created_at DESC);

-- Row-level security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only project members (owner/admin) can read audit logs for their projects
CREATE POLICY "audit_logs_select_org_members"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT project_id
      FROM project_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Audit logs are insert-only via service role (application layer)
-- No UPDATE or DELETE policies â€” logs are immutable

-- Comment documenting partitioning recommendation
COMMENT ON TABLE audit_logs IS
  'Immutable audit trail for all user actions. '
  'For high-volume deployments, consider range-partitioning by created_at (e.g. monthly partitions) '
  'using PostgreSQL declarative partitioning: '
  'PARTITION BY RANGE (created_at). '
  'Pair with pg_partman for automated partition management and retention policies.';

COMMIT;


-- ========== 011_rls_policies.sql ==========
-- Migration 011: Complete RLS Policies for All Tables
-- Generated: 2026-06-16

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_project_role(project_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM project_members
  WHERE project_members.project_id = get_user_project_role.project_id
    AND project_members.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_project_member(project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM project_members
    WHERE project_members.project_id = is_project_member.project_id
      AND project_members.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION has_project_role(project_id uuid, required_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM project_members
    WHERE project_members.project_id = has_project_role.project_id
      AND project_members.user_id = auth.uid()
      AND project_members.role::text = ANY(required_roles)
  );
$$;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

DROP POLICY IF EXISTS "organizations_select" ON organizations;
CREATE POLICY "organizations_select"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE p.organization_id = organizations.id
        AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "organizations_insert" ON organizations;
CREATE POLICY "organizations_insert"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "organizations_update" ON organizations;
CREATE POLICY "organizations_update"
  ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE p.organization_id = organizations.id
        AND pm.user_id = auth.uid()
        AND pm.role::text = 'owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE p.organization_id = organizations.id
        AND pm.user_id = auth.uid()
        AND pm.role::text = 'owner'
    )
  );

-- ============================================================
-- PROJECTS
-- ============================================================

DROP POLICY IF EXISTS "projects_select" ON projects;
CREATE POLICY "projects_select"
  ON projects
  FOR SELECT
  TO authenticated
  USING (is_project_member(id));

DROP POLICY IF EXISTS "projects_insert" ON projects;
CREATE POLICY "projects_insert"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "projects_update" ON projects;
CREATE POLICY "projects_update"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (has_project_role(id, ARRAY['owner', 'admin']))
  WITH CHECK (has_project_role(id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "projects_delete" ON projects;
CREATE POLICY "projects_delete"
  ON projects
  FOR DELETE
  TO authenticated
  USING (has_project_role(id, ARRAY['owner']));

-- ============================================================
-- PROJECT_MEMBERS
-- ============================================================

DROP POLICY IF EXISTS "project_members_select" ON project_members;
CREATE POLICY "project_members_select"
  ON project_members
  FOR SELECT
  TO authenticated
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS "project_members_insert" ON project_members;
CREATE POLICY "project_members_insert"
  ON project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "project_members_update" ON project_members;
CREATE POLICY "project_members_update"
  ON project_members
  FOR UPDATE
  TO authenticated
  USING (has_project_role(project_id, ARRAY['owner', 'admin']))
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "project_members_delete" ON project_members;
CREATE POLICY "project_members_delete"
  ON project_members
  FOR DELETE
  TO authenticated
  USING (has_project_role(project_id, ARRAY['owner']));

-- ============================================================
-- DEPLOYMENTS
-- ============================================================

DROP POLICY IF EXISTS "deployments_select" ON deployments;
CREATE POLICY "deployments_select"
  ON deployments
  FOR SELECT
  TO authenticated
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS "deployments_insert" ON deployments;
CREATE POLICY "deployments_insert"
  ON deployments
  FOR INSERT
  TO authenticated
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "deployments_update" ON deployments;
CREATE POLICY "deployments_update"
  ON deployments
  FOR UPDATE
  TO authenticated
  USING (has_project_role(project_id, ARRAY['owner', 'admin']))
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "deployments_delete" ON deployments;
CREATE POLICY "deployments_delete"
  ON deployments
  FOR DELETE
  TO authenticated
  USING (has_project_role(project_id, ARRAY['owner']));

-- ============================================================
-- SCREENS
-- ============================================================

DROP POLICY IF EXISTS "screens_select" ON screens;
CREATE POLICY "screens_select"
  ON screens
  FOR SELECT
  TO authenticated
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS "screens_insert" ON screens;
CREATE POLICY "screens_insert"
  ON screens
  FOR INSERT
  TO authenticated
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "screens_update" ON screens;
CREATE POLICY "screens_update"
  ON screens
  FOR UPDATE
  TO authenticated
  USING (has_project_role(project_id, ARRAY['owner', 'admin']))
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "screens_delete" ON screens;
CREATE POLICY "screens_delete"
  ON screens
  FOR DELETE
  TO authenticated
  USING (has_project_role(project_id, ARRAY['owner']));

-- ============================================================
-- COMMENT_THREADS
-- ============================================================

DROP POLICY IF EXISTS "comment_threads_select" ON comment_threads;
CREATE POLICY "comment_threads_select"
  ON comment_threads
  FOR SELECT
  TO authenticated
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS "comment_threads_insert" ON comment_threads;
CREATE POLICY "comment_threads_insert"
  ON comment_threads
  FOR INSERT
  TO authenticated
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'admin', 'reviewer']));

DROP POLICY IF EXISTS "comment_threads_update" ON comment_threads;
CREATE POLICY "comment_threads_update"
  ON comment_threads
  FOR UPDATE
  TO authenticated
  USING (
    (created_by = auth.uid() OR has_project_role(project_id, ARRAY['owner', 'admin']))
    AND has_project_role(project_id, ARRAY['owner', 'admin', 'reviewer'])
  )
  WITH CHECK (
    (created_by = auth.uid() OR has_project_role(project_id, ARRAY['owner', 'admin']))
    AND has_project_role(project_id, ARRAY['owner', 'admin', 'reviewer'])
  );

-- DELETE is disabled: soft delete only (no policy created)

-- ============================================================
-- COMMENTS
-- ============================================================

DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select"
  ON comments
  FOR SELECT
  TO authenticated
  USING (
    is_project_member(project_id)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert"
  ON comments
  FOR INSERT
  TO authenticated
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'admin', 'reviewer']));

DROP POLICY IF EXISTS "comments_update" ON comments;
CREATE POLICY "comments_update"
  ON comments
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR has_project_role(project_id, ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    created_by = auth.uid()
    OR has_project_role(project_id, ARRAY['owner', 'admin'])
  );

-- DELETE is disabled: use soft delete via deleted_at column (no policy created)

-- ============================================================
-- COMMENT_HISTORY
-- ============================================================

DROP POLICY IF EXISTS "comment_history_select" ON comment_history;
CREATE POLICY "comment_history_select"
  ON comment_history
  FOR SELECT
  TO authenticated
  USING (
    is_project_member(project_id)
    AND has_project_role(project_id, ARRAY['owner', 'admin'])
  );

-- INSERT, UPDATE, DELETE: service role only via triggers (no policies for authenticated role)

-- ============================================================
-- AUDIT_LOGS
-- ============================================================

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    is_project_member(project_id)
    AND has_project_role(project_id, ARRAY['owner', 'admin'])
  );

-- INSERT, UPDATE, DELETE: service role only via triggers (no policies for authenticated role)

-- ============================================================
-- HANDOFFS
-- ============================================================

DROP POLICY IF EXISTS "handoffs_select" ON handoffs;
CREATE POLICY "handoffs_select"
  ON handoffs
  FOR SELECT
  TO authenticated
  USING (is_project_member(project_id));

DROP POLICY IF EXISTS "handoffs_insert" ON handoffs;
CREATE POLICY "handoffs_insert"
  ON handoffs
  FOR INSERT
  TO authenticated
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "handoffs_update" ON handoffs;
CREATE POLICY "handoffs_update"
  ON handoffs
  FOR UPDATE
  TO authenticated
  USING (has_project_role(project_id, ARRAY['owner', 'admin']))
  WITH CHECK (has_project_role(project_id, ARRAY['owner', 'admin']));

DROP POLICY IF EXISTS "handoffs_delete" ON handoffs;
CREATE POLICY "handoffs_delete"
  ON handoffs
  FOR DELETE
  TO authenticated
  USING (has_project_role(project_id, ARRAY['owner']));


-- ========== 012_functions_triggers.sql ==========
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




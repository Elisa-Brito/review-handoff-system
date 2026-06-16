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

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

  -- Timestamp (immutable — no updated_at)
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
-- No UPDATE or DELETE policies — logs are immutable

-- Comment documenting partitioning recommendation
COMMENT ON TABLE audit_logs IS
  'Immutable audit trail for all user actions. '
  'For high-volume deployments, consider range-partitioning by created_at (e.g. monthly partitions) '
  'using PostgreSQL declarative partitioning: '
  'PARTITION BY RANGE (created_at). '
  'Pair with pg_partman for automated partition management and retention policies.';

COMMIT;

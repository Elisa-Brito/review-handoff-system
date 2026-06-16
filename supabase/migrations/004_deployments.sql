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

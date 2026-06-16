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

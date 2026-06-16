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
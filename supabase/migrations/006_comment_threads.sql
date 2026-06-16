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
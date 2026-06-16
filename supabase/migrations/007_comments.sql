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

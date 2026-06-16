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

CREATE TABLE IF NOT EXISTS moderation_actions (
  id uuid PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('hide', 'unhide')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_actions_report_idx
  ON moderation_actions (report_id, created_at DESC);

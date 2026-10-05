CREATE TABLE IF NOT EXISTS flags (
  id uuid PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id),
  reason text NOT NULL CHECK (reason IN ('inaccurate', 'spam', 'offensive')),
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, device_id, reason)
);

CREATE INDEX IF NOT EXISTS flags_open_idx ON flags (resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS flags_report_idx ON flags (report_id, created_at DESC);

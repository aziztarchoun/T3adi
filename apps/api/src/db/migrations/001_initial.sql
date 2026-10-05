CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY,
  device_token text NOT NULL UNIQUE,
  reputation_score integer NOT NULL DEFAULT 0,
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY,
  reporter_device_id uuid NOT NULL REFERENCES devices(id),
  location geography(Point, 4326) NOT NULL,
  type text NOT NULL CHECK (type IN ('flooding', 'pothole', 'blocked', 'accident_obstacle', 'other')),
  severity text NOT NULL CHECK (severity IN ('safe', 'caution', 'dangerous', 'blocked')),
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'expired', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at timestamptz,
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS reports_location_gist_idx ON reports USING gist (location);
CREATE INDEX IF NOT EXISTS reports_status_created_at_idx ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_type_severity_idx ON reports (type, severity);

CREATE TABLE IF NOT EXISTS confirmations (
  id uuid PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id),
  vote text NOT NULL CHECK (vote IN ('confirm', 'dispute', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, device_id)
);

CREATE INDEX IF NOT EXISTS confirmations_report_idx ON confirmations (report_id, created_at DESC);

INSERT INTO devices (id, device_token)
VALUES ('00000000-0000-0000-0000-000000000001', 'sample-device')
ON CONFLICT (device_token) DO NOTHING;

INSERT INTO reports (
  id,
  reporter_device_id,
  location,
  type,
  severity,
  description,
  created_at,
  last_confirmed_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    ST_SetSRID(ST_MakePoint(10.1815, 36.8065), 4326)::geography,
    'flooding',
    'dangerous',
    'Water pooling on the road after heavy rain.',
    now() - interval '12 minutes',
    now() - interval '5 minutes'
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000001',
    ST_SetSRID(ST_MakePoint(10.17, 36.82), 4326)::geography,
    'pothole',
    'caution',
    'Large pothole near the bus stop.',
    now() - interval '45 minutes',
    now() - interval '28 minutes'
  )
ON CONFLICT (id) DO NOTHING;

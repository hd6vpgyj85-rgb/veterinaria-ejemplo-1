alter table appointments add column if not exists preferred_time time;
alter table attendance_logs add column if not exists deleted_at timestamptz;

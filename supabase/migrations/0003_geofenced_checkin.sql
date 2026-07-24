alter table business_settings add column if not exists checkin_latitude double precision;
alter table business_settings add column if not exists checkin_longitude double precision;
alter table business_settings add column if not exists checkin_radius_meters int not null default 150;

alter table attendance_logs add column if not exists source text not null default 'nfc';

create extension if not exists pgcrypto;

create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  icon text not null default 'stethoscope',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rating int not null check (rating between 1 and 5),
  comment text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  role text not null default 'trabajador',
  active boolean not null default true,
  checkin_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

create table attendance_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  type text not null check (type in ('entrada', 'salida')),
  occurred_at timestamptz not null default now(),
  notified boolean not null default false
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  owner_name text not null,
  phone text not null,
  pet_name text not null,
  service text not null,
  preferred_date date,
  status text not null default 'nueva',
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

create table business_settings (
  id int primary key default 1,
  business_name text not null default 'Yukly Pets',
  owner_email text,
  whatsapp_number text not null default '526568596503',
  address text not null default 'Calle Ejemplo 123, Col. Ejemplo, Ciudad Juárez, Chih.',
  hours_weekday text not null default 'Lun - Vie: 9:00 am - 7:00 pm',
  hours_saturday text not null default 'Sáb: 9:00 am - 3:00 pm',
  hours_sunday text not null default 'Dom: Cerrado',
  constraint single_row check (id = 1)
);

insert into business_settings (id) values (1);

create index attendance_logs_employee_id_idx on attendance_logs (employee_id);
create index attendance_logs_occurred_at_idx on attendance_logs (occurred_at desc);
create index appointments_created_at_idx on appointments (created_at desc);
create index reviews_approved_idx on reviews (approved);
create index services_active_idx on services (active);

alter table services enable row level security;
alter table reviews enable row level security;
alter table employees enable row level security;
alter table attendance_logs enable row level security;
alter table appointments enable row level security;
alter table business_settings enable row level security;

create policy "public can read active services"
  on services for select
  using (active = true);

create policy "owner full access to services"
  on services for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "public can read approved reviews"
  on reviews for select
  using (approved = true);

create policy "public can submit reviews"
  on reviews for insert
  with check (approved = false);

create policy "owner full access to reviews"
  on reviews for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "owner full access to employees"
  on employees for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "owner full access to attendance_logs"
  on attendance_logs for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "public can submit appointments"
  on appointments for insert
  with check (true);

create policy "owner full access to appointments"
  on appointments for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "public can read business settings"
  on business_settings for select
  using (true);

create policy "owner can update business settings"
  on business_settings for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

insert into services (name, description, icon, sort_order) values
  ('Consultas generales', 'Revisión completa de salud con diagnóstico y seguimiento personalizado.', 'stethoscope', 1),
  ('Vacunación', 'Esquemas completos de vacunas para perros y gatos de todas las edades.', 'syringe', 2),
  ('Grooming y estética', 'Baño, corte y spa para que tu mascota luzca y se sienta increíble.', 'scissors', 3),
  ('Cirugías', 'Procedimientos quirúrgicos seguros con equipo especializado y monitoreo.', 'surgery', 4),
  ('Guardería de mascotas', 'Hospedaje seguro y divertido mientras estás de viaje o en el trabajo.', 'house', 5),
  ('Tienda de productos', 'Alimento, accesorios y productos de calidad para el bienestar diario.', 'cart', 6);

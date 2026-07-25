alter table reviews add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public can upload review photos"
  on storage.objects for insert
  with check (bucket_id = 'review-photos');

create policy "public can read review photos"
  on storage.objects for select
  using (bucket_id = 'review-photos');

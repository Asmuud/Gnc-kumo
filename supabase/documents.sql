-- GNC Kumo PDF Documents Library

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_path text not null unique,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

drop policy if exists "approved members read documents" on public.documents;
create policy "approved members read documents"
on public.documents for select to authenticated
using (
  public.is_approved_member()
  or public.current_user_role() in ('admin','super_admin')
);

drop policy if exists "admins upload documents" on public.documents;
create policy "admins upload documents"
on public.documents for insert to authenticated
with check (
  public.current_user_role() in ('admin','super_admin')
  and uploaded_by = auth.uid()
);

drop policy if exists "admins delete documents" on public.documents;
create policy "admins delete documents"
on public.documents for delete to authenticated
using (
  public.current_user_role() in ('admin','super_admin')
);

-- Private PDF storage bucket (20 MB maximum)
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'documents',
  'documents',
  false,
  20971520,
  array['application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array['application/pdf'];

drop policy if exists "approved members read PDF files" on storage.objects;
create policy "approved members read PDF files"
on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and (
    public.is_approved_member()
    or public.current_user_role() in ('admin','super_admin')
  )
);

drop policy if exists "admins upload PDF files" on storage.objects;
create policy "admins upload PDF files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documents'
  and public.current_user_role() in ('admin','super_admin')
);

drop policy if exists "admins delete PDF files" on storage.objects;
create policy "admins delete PDF files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'documents'
  and public.current_user_role() in ('admin','super_admin')
);

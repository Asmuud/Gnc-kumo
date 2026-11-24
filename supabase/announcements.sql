-- GNC Kumo Announcements: complete database setup

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  image_path text,
  pdf_path text,
  video_path text,
  link_url text,
  pinned boolean NOT NULL DEFAULT false
);

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS body text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS image_path text,
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS video_path text,
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "approved members read announcements" ON public.announcements;
CREATE POLICY "approved members read announcements"
ON public.announcements FOR SELECT TO authenticated
USING (
  (published = true AND public.is_approved_member())
  OR public.current_user_role() IN ('admin','super_admin')
);

DROP POLICY IF EXISTS "admins manage announcements" ON public.announcements;
CREATE POLICY "admins manage announcements"
ON public.announcements FOR ALL TO authenticated
USING (public.current_user_role() IN ('admin','super_admin'))
WITH CHECK (public.current_user_role() IN ('admin','super_admin'));

-- Private storage bucket for announcement attachments
INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
VALUES (
  'announcement-media',
  'announcement-media',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'video/mp4',
    'video/webm'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "approved members read announcement media" ON storage.objects;
CREATE POLICY "approved members read announcement media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'announcement-media'
  AND (
    public.is_approved_member()
    OR public.current_user_role() IN ('admin','super_admin')
  )
);

DROP POLICY IF EXISTS "admins upload announcement media" ON storage.objects;
CREATE POLICY "admins upload announcement media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'announcement-media'
  AND public.current_user_role() IN ('admin','super_admin')
);

DROP POLICY IF EXISTS "admins delete announcement media" ON storage.objects;
CREATE POLICY "admins delete announcement media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'announcement-media'
  AND public.current_user_role() IN ('admin','super_admin')
);

-- Add link_url column to reviews table
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS link_url TEXT;

-- Create storage buckets for chat attachments and review photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  (
    'chat-attachments',
    'chat-attachments',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']
  ),
  (
    'review-photos',
    'review-photos',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  )
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat-attachments
CREATE POLICY "Users can upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.uid() = (storage.foldername(name))[1]::uuid
);

CREATE POLICY "Users can view their own chat attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Admins can delete chat attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND public.has_role(auth.uid(), 'admin')
);

-- Storage policies for review-photos
CREATE POLICY "Users can upload review photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'review-photos'
  AND auth.uid() = (storage.foldername(name))[1]::uuid
);

CREATE POLICY "Anyone can view review photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'review-photos');

CREATE POLICY "Admins can delete review photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'review-photos'
  AND public.has_role(auth.uid(), 'admin')
);

-- Update RLS policies for chat_messages to allow attachment handling
CREATE POLICY "Users can view their own messages" ON public.chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all messages" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert messages for any user" ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
-- Store an ordered collection of media attachments per post.
-- Keep the original single-media columns for backward compatibility.
ALTER TABLE public.vha_posts
  ADD COLUMN IF NOT EXISTS media_items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Preserve every existing single-media attachment as the first gallery item.
UPDATE public.vha_posts
SET media_items = jsonb_build_array(
  jsonb_build_object(
    'url', media_url,
    'path', media_path,
    'type', COALESCE(media_type, 'audio'),
    'name', ''
  )
)
WHERE media_url IS NOT NULL
  AND jsonb_typeof(media_items) = 'array'
  AND jsonb_array_length(media_items) = 0;

# Imported WordPress posts

Each migrated post is stored in its own folder under this directory:

```text
<post-slug>/
  post.json       # Original WordPress identity and import metadata
  text/
    content.html  # Preserved post body / source markup
  media/          # Images, video, audio, and other local attachments
```

`post.json` records the source WordPress post ID, slug, title, dates, category, layout, and media filenames. Media paths are site-relative and resolve from `/landing-page/posts/imported/<post-slug>/media/`.

Keep imported source material here rather than linking back to WordPress or a third-party media host. The live archive can continue to use `vha_posts` for publishing state and discovery while imported text and binary assets are versioned in this repository.

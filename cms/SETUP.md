# Verse After Hours CMS — first-time setup

The publishing console lives at **https://iyakuza.github.io/landing-page/cms/**. It uses Supabase Auth and Row Level Security; there is no public sign-up form.

## 1. Create the editor account

1. Open the [Supabase Authentication users page](https://supabase.com/dashboard/project/oeyxsqocldlovhsmzcjw/auth/users).
2. Choose **Add user** and create an email/password account you control. Use a strong, unique password.
3. Copy the user's UUID from the user list.

## 2. Grant CMS access

Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/oeyxsqocldlovhsmzcjw/sql/new) and run the following query, replacing the UUID with the user UUID copied above:

```sql
insert into public.vha_cms_admins (user_id)
values ('REPLACE-WITH-YOUR-USER-UUID')
on conflict (user_id) do nothing;
```

Only database owners can add rows to this admin table; the browser cannot grant itself access. The admin table has RLS enabled and exposes no public read/write access.

## 3. Sign in and write

1. Open https://iyakuza.github.io/landing-page/cms/
2. Sign in with the account created in step 1.
3. Create a post, enter a category, and use the visual editor to format the body.
4. **Save Draft** keeps it private. **Publish** makes it appear in the public Transmissions archive.
5. Select a post in the left panel to edit it. Editing a published post and saving it as a draft will unpublish it.

## Security notes

- The frontend contains only the Supabase project URL and a **publishable** key. Supabase publishable keys are intentionally browser-visible; they are not privileged credentials.
- Never put a Supabase secret/service-role key in GitHub Pages, HTML, or JavaScript.
- RLS permits public reads only for rows with `status = 'published'`. Drafts and all writes require an explicit row in `vha_cms_admins`.
- The console is marked `noindex,nofollow`; this is not access control by itself. Authentication and RLS enforce access.

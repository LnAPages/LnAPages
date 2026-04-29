import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BlogPost, BlogPostInput } from '@shared/schemas/blog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const SANS = { fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)' } as const;
const labelCls = 'block text-sm font-medium text-foreground mb-1.5';
const helpCls = 'mt-1 text-xs text-muted-foreground';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function emptyDraft(): BlogPostInput {
  return {
    slug: '',
    title: '',
    excerpt: '',
    body: '',
    cover_url: '',
    author: '',
    published: false,
    published_at: null,
  };
}

export default function AdminBlog() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-blog'],
    queryFn: () => api.get<{ posts: BlogPost[] }>('/admin/blog'),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BlogPostInput>(emptyDraft);
  const [slugTouched, setSlugTouched] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) return;
    const post = data?.posts.find((p) => p.id === editingId);
    if (post) {
      setDraft({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        cover_url: post.cover_url,
        author: post.author,
        published: post.published,
        published_at: post.published_at,
      });
      setSlugTouched(true);
    }
  }, [editingId, data]);

  const create = useMutation({
    mutationFn: (payload: BlogPostInput) =>
      api.post<{ post: BlogPost }>('/admin/blog', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-blog'] });
      qc.invalidateQueries({ queryKey: ['blog'] });
      setStatus('Post created.');
      setDraft(emptyDraft());
      setSlugTouched(false);
    },
    onError: (e: unknown) =>
      setStatus('Save failed: ' + (e instanceof Error ? e.message : 'unknown')),
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; payload: BlogPostInput }) =>
      api.put<{ post: BlogPost }>('/admin/blog/' + vars.id, vars.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-blog'] });
      qc.invalidateQueries({ queryKey: ['blog'] });
      setStatus('Post updated.');
    },
    onError: (e: unknown) =>
      setStatus('Save failed: ' + (e instanceof Error ? e.message : 'unknown')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: string }>('/admin/blog/' + id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-blog'] });
      qc.invalidateQueries({ queryKey: ['blog'] });
      setStatus('Post deleted.');
      setEditingId(null);
      setDraft(emptyDraft());
      setSlugTouched(false);
    },
  });

  function onTitleChange(v: string) {
    setDraft((d) => ({
      ...d,
      title: v,
      slug: slugTouched ? d.slug : slugify(v),
    }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!draft.title.trim() || !draft.slug.trim()) {
      setStatus('Title and slug are required.');
      return;
    }
    if (editingId) {
      update.mutate({ id: editingId, payload: draft });
    } else {
      create.mutate(draft);
    }
  }

  function startNew() {
    setEditingId(null);
    setDraft(emptyDraft());
    setSlugTouched(false);
    setStatus(null);
  }

  const saving = create.isPending || update.isPending;

  return (
    <section className='space-y-8 p-4 sm:p-6' style={SANS}>
      <header className='flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>Blog</h1>
          <p className='text-sm text-muted-foreground'>
            Write, edit, and publish journal posts. Show the Blog link in the
            site menu from the Menu admin tab.
          </p>
        </div>
        <Button type='button' variant='outline' onClick={startNew}>
          New post
        </Button>
      </header>

      {status && (
        <div className='rounded-md border border-border/60 bg-surface/40 px-4 py-2 text-sm'>
          {status}
        </div>
      )}

      <div className='grid gap-8 lg:grid-cols-[1fr_18rem]'>
        <form
          onSubmit={onSubmit}
          className='space-y-5 rounded-2xl border border-border/70 bg-surface/30 p-5 sm:p-6'
        >
          <h2 className='text-lg font-semibold'>
            {editingId ? 'Edit post' : 'New post'}
          </h2>

          <div>
            <label htmlFor='post-title' className={labelCls}>Title</label>
            <Input
              id='post-title'
              value={draft.title}
              onChange={(e) => onTitleChange(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor='post-slug' className={labelCls}>Slug</label>
            <Input
              id='post-slug'
              value={draft.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setDraft((d) => ({ ...d, slug: slugify(e.target.value) }));
              }}
            />
            <p className={helpCls}>URL: /blog/{draft.slug || 'your-post'}</p>
          </div>

          <div className='grid gap-5 sm:grid-cols-2'>
            <div>
              <label htmlFor='post-author' className={labelCls}>Author</label>
              <Input
                id='post-author'
                value={draft.author ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor='post-cover' className={labelCls}>Cover image URL</label>
              <Input
                id='post-cover'
                value={draft.cover_url ?? ''}
                placeholder='https://…'
                onChange={(e) => setDraft((d) => ({ ...d, cover_url: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label htmlFor='post-excerpt' className={labelCls}>Excerpt</label>
            <Textarea
              id='post-excerpt'
              rows={2}
              value={draft.excerpt ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, excerpt: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor='post-body' className={labelCls}>Body</label>
            <Textarea
              id='post-body'
              rows={12}
              value={draft.body ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            />
            <p className={helpCls}>Plain text. Line breaks are preserved.</p>
          </div>

          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              checked={!!draft.published}
              onChange={(e) => setDraft((d) => ({ ...d, published: e.target.checked }))}
            />
            Published
          </label>

          <div className='flex flex-wrap gap-3 pt-1'>
            <Button type='submit' disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create post'}
            </Button>
            {editingId && (
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  if (confirm('Delete this post?')) remove.mutate(editingId);
                }}
              >
                Delete
              </Button>
            )}
          </div>
        </form>

        <aside className='space-y-3'>
          <h2 className='text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground'>
            Posts
          </h2>
          {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}
          {data?.posts.length === 0 && (
            <p className='text-sm text-muted-foreground'>No posts yet.</p>
          )}
          <ul className='space-y-2'>
            {data?.posts.map((p) => (
              <li key={p.id}>
                <button
                  type='button'
                  onClick={() => setEditingId(p.id)}
                  className={
                    'w-full text-left rounded-md border px-3 py-2 text-sm transition ' +
                    (editingId === p.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-surface/30 hover:border-accent/40')
                  }
                >
                  <div className='font-medium truncate'>{p.title || '(untitled)'}</div>
                  <div className='text-xs text-muted-foreground'>
                    {p.published ? 'Published' : 'Draft'} · /{p.slug}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

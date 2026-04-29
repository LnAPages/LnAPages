import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import type { BlogPost } from '@shared/schemas/blog';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function Blog() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['blog'],
    queryFn: () => api.get<{ posts: BlogPost[] }>('/blog'),
  });

  return (
    <section className='mx-auto w-full max-w-3xl space-y-8 px-4 py-10'>
      <header className='space-y-2'>
        <h1 className='text-4xl font-semibold tracking-tight'>Journal</h1>
        <p className='text-sm text-muted-foreground'>
          Behind the scenes, production notes, and the work we're proud of.
        </p>
      </header>

      {isLoading && <p className='text-sm text-muted-foreground'>Loading…</p>}
      {error && (
        <p className='text-sm text-red-400'>Couldn't load posts. Please try again.</p>
      )}

      {data && data.posts.length === 0 && (
        <p className='text-sm text-muted-foreground'>
          No posts yet. Check back soon.
        </p>
      )}

      <ul className='space-y-8'>
        {data?.posts.map((post) => (
          <li
            key={post.id}
            className='group rounded-2xl border border-border/60 bg-surface/30 overflow-hidden transition hover:border-accent/40'
          >
            <Link to={'/blog/' + post.slug} className='block'>
              {post.cover_url && (
                <div className='aspect-[16/9] overflow-hidden bg-surface-2'>
                  <img
                    src={post.cover_url}
                    alt=''
                    className='w-full h-full object-cover transition group-hover:scale-[1.02]'
                    loading='lazy'
                  />
                </div>
              )}
              <div className='p-5 sm:p-6 space-y-2'>
                <p className='text-xs uppercase tracking-[0.14em] text-muted-foreground'>
                  {formatDate(post.published_at)}
                  {post.author ? ' · ' + post.author : ''}
                </p>
                <h2 className='text-2xl font-semibold tracking-tight group-hover:text-accent transition'>
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className='text-sm text-muted-foreground'>{post.excerpt}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

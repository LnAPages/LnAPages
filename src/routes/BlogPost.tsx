import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import type { BlogPost as BlogPostType } from '@shared/schemas/blog';

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

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['blog', slug],
    queryFn: () => api.get<{ post: BlogPostType }>('/blog/' + slug),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <section className='mx-auto w-full max-w-3xl px-4 py-10'>
        <p className='text-sm text-muted-foreground'>Loading…</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className='mx-auto w-full max-w-3xl px-4 py-10 space-y-4'>
        <h1 className='text-2xl font-semibold tracking-tight'>Post not found</h1>
        <Link to='/blog' className='text-sm text-accent hover:underline'>
          ← Back to journal
        </Link>
      </section>
    );
  }

  const { post } = data;

  return (
    <article className='mx-auto w-full max-w-3xl px-4 py-10 space-y-8'>
      <Link to='/blog' className='text-sm text-muted-foreground hover:text-accent transition'>
        ← Back to journal
      </Link>

      <header className='space-y-3'>
        <p className='text-xs uppercase tracking-[0.14em] text-muted-foreground'>
          {formatDate(post.published_at)}
          {post.author ? ' · ' + post.author : ''}
        </p>
        <h1 className='text-4xl font-semibold tracking-tight'>{post.title}</h1>
        {post.excerpt && (
          <p className='text-base text-muted-foreground'>{post.excerpt}</p>
        )}
      </header>

      {post.cover_url && (
        <div className='aspect-[16/9] overflow-hidden rounded-2xl bg-surface-2'>
          <img src={post.cover_url} alt='' className='w-full h-full object-cover' />
        </div>
      )}

      <div className='prose prose-invert max-w-none whitespace-pre-wrap text-base leading-relaxed'>
        {post.body}
      </div>
    </article>
  );
}

import { useEffect, useState } from 'react';

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let rafId: number;
    let lastProgress = -1;
    function update() {
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const totalHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const next = totalHeight > 0 ? (scrollTop / totalHeight) * 100 : 0;
      if (Math.abs(next - lastProgress) >= 0.1) {
        lastProgress = next;
        setProgress(next);
      }
      rafId = requestAnimationFrame(update);
    }
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      className='fixed left-0 top-0 z-50 h-px bg-[hsl(var(--accent))]'
      style={{
        width: `${progress}%`,
        opacity: 'calc(var(--fx-progress) / 100)',
        transition: 'width 50ms linear',
      }}
      role='progressbar'
      aria-label='Reading progress'
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    />
  );
}

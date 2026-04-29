import { Card } from '@/components/ui/card';

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className='text-sm text-[hsl(var(--muted-foreground))]'>{label}</p>
      <p className='mt-2 text-2xl font-semibold text-[hsl(var(--accent))]'>{value}</p>
    </Card>
  );
}

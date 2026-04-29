type Props = { value: string; onChange: (value: string) => void };

export function Calendar({ value, onChange }: Props) {
  return <input aria-label='Booking date' type='date' value={value} onChange={(e) => onChange(e.target.value)} className='h-10 rounded-md border border-border px-3' />;
}

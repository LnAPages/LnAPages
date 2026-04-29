type Props = { slots: string[]; value: string; onChange: (value: string) => void };

export function SlotPicker({ slots, value, onChange }: Props) {
  return (
    <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
      {slots.map((slot) => (
        <button key={slot} className={`rounded-md border px-3 py-2 text-sm ${value === slot ? 'border-primary' : 'border-border'}`} onClick={() => onChange(slot)} type='button'>
          {slot}
        </button>
      ))}
    </div>
  );
}

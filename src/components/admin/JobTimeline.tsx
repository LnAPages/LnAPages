const stages = ['Booking', 'Paid', 'In Progress', 'Completed'];

export function JobTimeline() {
  return (
    <ol className='grid gap-2 sm:grid-cols-4'>
      {stages.map((stage) => (
        <li key={stage} className='rounded-md border border-border p-3 text-center text-sm'>
          {stage}
        </li>
      ))}
    </ol>
  );
}

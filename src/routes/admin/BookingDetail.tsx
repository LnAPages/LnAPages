import { useParams } from 'react-router-dom';

export default function BookingDetail() {
  const { id } = useParams();
  return <section><h1 className='text-2xl font-semibold'>Booking #{id}</h1></section>;
}

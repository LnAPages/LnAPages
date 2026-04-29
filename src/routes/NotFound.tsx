import { Link } from 'react-router-dom';

export default function NotFound() {
  return <p>Page not found. <Link to='/' className='underline'>Go home</Link>.</p>;
}

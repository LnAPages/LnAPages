import { Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Home from '@/routes/Home';
import Services from '@/routes/Services';
import Booking from '@/routes/Booking';
import Gallery from '@/routes/Gallery';
import Shop from '@/routes/Shop';
import Blog from '@/routes/Blog';
import BlogPostPage from '@/routes/BlogPost';
import Quote from '@/routes/Quote';
import BookingSuccess from '@/routes/BookingSuccess';
import NotFound from '@/routes/NotFound';
import Invite from '@/routes/Invite';
import ForgotPassword from '@/routes/ForgotPassword';
import ResetPassword from '@/routes/ResetPassword';
import AdminLayout from '@/routes/admin/AdminLayout';
import Dashboard from '@/routes/admin/Dashboard';
import Pipeline from '@/routes/admin/Pipeline';
import AdminBookings from '@/routes/admin/Bookings';
import BookingDetail from '@/routes/admin/BookingDetail';
import AdminServices from '@/routes/admin/Services';
import AdminGallery from '@/routes/admin/Gallery';
import GalleryCropEditor from '@/routes/admin/GalleryCropEditor';
import Invoices from '@/routes/admin/Invoices';
import Intakes from '@/routes/admin/Intakes';
import Menu from '@/routes/admin/Menu';
import Notifications from '@/routes/admin/Notifications';
import Settings from '@/routes/admin/Settings';
import Brand from '@/routes/admin/Brand';
import Theme from '@/routes/admin/Theme';
import AdminShop from '@/routes/admin/Shop';
import AdminBlog from '@/routes/admin/Blog';
import Tasks from '@/routes/admin/Tasks';
import TaskTemplates from '@/routes/admin/TaskTemplates';
import Expenses from '@/routes/admin/Expenses';
import Contacts from '@/routes/admin/Contacts';
import ContactDetail from '@/routes/admin/ContactDetail';
import Login from '@/routes/admin/Login';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { TransitionSweep } from '@/components/fx/TransitionSweep';
import { CinemaFxDefs } from '@/components/fx/CinemaFxDefs';
import { useTheme } from '@/hooks/useTheme';

function isMotionReduced() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-motion') === 'reduced';
}

const pageVariants = {
  initial: { opacity: 0, y: 8 } as const,
  enter: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as const } } as const,
  exit: { opacity: 0, y: -8, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] as const } } as const,
};

const reducedVariants = {
  initial: { opacity: 0 } as const,
  enter: { opacity: 1, transition: { duration: 0.15 } } as const,
  exit: { opacity: 0, transition: { duration: 0.1 } } as const,
};

function AnimatedRouteWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
    if (location.pathname.startsWith('/admin')) return children;
  const reduced = isMotionReduced();
  const variants = reduced ? reducedVariants : pageVariants;

  return (
    <AnimatePresence mode='wait' initial={false}>
      <motion.div
        key={location.pathname}
        variants={variants}
        initial='initial'
        animate='enter'
        exit='exit'
        className='w-full'
      >
        {!reduced ? <TransitionSweep /> : null}
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='min-h-screen bg-background text-foreground'>
      <CinemaFxDefs />
      <Header />
      <main className='mx-auto w-full max-w-[var(--max-content-width)] px-4 py-6'>
        <AnimatedRouteWrapper>{children}</AnimatedRouteWrapper>
      </main>
      <Footer />
    </div>
  );
}

const router = createBrowserRouter([
  { path: '/', element: <RootLayout><Home /></RootLayout> },
  { path: '/services', element: <RootLayout><Services /></RootLayout> },
  { path: '/booking', element: <RootLayout><Booking /></RootLayout> },
  { path: '/book', element: <RootLayout><Booking /></RootLayout> },
  { path: '/gallery', element: <RootLayout><Gallery /></RootLayout> },
  { path: '/shop', element: <RootLayout><Shop /></RootLayout> },
  { path: '/blog', element: <RootLayout><Blog /></RootLayout> },
  { path: '/blog/:slug', element: <RootLayout><BlogPostPage /></RootLayout> },
  { path: '/quote', element: <RootLayout><Quote /></RootLayout> },
  { path: '/booking/success', element: <RootLayout><BookingSuccess /></RootLayout> },
  { path: '/invite/:token', element: <RootLayout><Invite /></RootLayout> },
  { path: '/forgot-password', element: <RootLayout><ForgotPassword /></RootLayout> },
  { path: '/reset-password', element: <RootLayout><ResetPassword /></RootLayout> },
  { path: '/admin/login', element: <RootLayout><Login /></RootLayout> },
  {
    path: '/admin',
    element: <RootLayout><AdminLayout /></RootLayout>,
    children: [
      { index: true, element: <Navigate to='/admin/pipeline' replace /> },
      { path: 'pipeline', element: <Pipeline /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'bookings', element: <AdminBookings /> },
      { path: 'bookings/:id', element: <BookingDetail /> },
      { path: 'services', element: <AdminServices /> },
      { path: 'gallery', element: <AdminGallery /> },
      { path: 'gallery/:id/crop', element: <GalleryCropEditor /> },
      { path: 'invoices', element: <Invoices /> },
      { path: 'intakes', element: <Intakes /> },
      { path: 'menu', element: <Menu /> },
      { path: 'notifications', element: <Notifications /> },
      { path: 'brand', element: <Brand /> },
      { path: 'settings', element: <Settings /> },
      { path: 'theme', element: <Theme /> },
      { path: 'theme/fx', element: <Navigate to='/admin/theme?tab=fx-gallery' replace /> },
      { path: 'shop', element: <AdminShop /> },
      { path: 'blog', element: <AdminBlog /> },
      { path: 'tasks', element: <Tasks /> },
      { path: 'tasks/templates', element: <TaskTemplates /> },
      { path: 'expenses', element: <Expenses /> },
      { path: 'contacts', element: <Contacts /> },
      { path: 'contacts/:id', element: <ContactDetail /> },
      { path: 'auto-responses', element: <Navigate to='/admin/intakes?tab=auto-responses' replace /> },
      { path: 'employees', element: <Navigate to='/admin/settings?tab=team' replace /> },
    ],
  },
  { path: '*', element: <RootLayout><NotFound /></RootLayout> },
]);

export default function App() {
  useTheme();
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <RouterProvider router={router} />
    </Suspense>
  );
}

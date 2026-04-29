import { motion } from 'framer-motion';

export function TransitionSweep() {
  return (
    <motion.div
      className='pointer-events-none fixed left-0 top-0 z-[100] h-px w-full bg-[hsl(var(--accent))]'
      style={{ opacity: 'calc(var(--fx-progress) / 100)' }}
      initial={{ scaleX: 0, transformOrigin: 'left' }}
      animate={{ scaleX: 1, transformOrigin: 'left' }}
      exit={{ scaleX: 0, transformOrigin: 'right' }}
      transition={{ duration: 0.24, ease: 'easeInOut' }}
    />
  );
}

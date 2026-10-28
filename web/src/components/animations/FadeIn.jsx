'use client';

/**
 * FadeIn — reveals its children with a fade + rise when scrolled into view.
 * Falls back to a plain fade when the user prefers reduced motion.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { fadeUp, fade } from '@/utils/animations';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to reveal
 * @param {number} [props.delay=0] - Delay in seconds
 * @param {string} [props.as='div'] - Element to render (div, section, li...)
 * @param {string} [props.className] - Extra classes
 * @returns {JSX.Element}
 */
export default function FadeIn({ children, delay = 0, as = 'div', className }) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as] || motion.div;
  const variants = reduceMotion ? fade : fadeUp;

  return (
    <Component
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay }}
    >
      {children}
    </Component>
  );
}

'use client';

/**
 * Stagger + StaggerItem — staggered entrance for lists and grids.
 * Wrap a list in <Stagger> and each child in <StaggerItem>.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { fadeUp, fade, staggerContainer } from '@/utils/animations';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - StaggerItem children
 * @param {number} [props.stagger=0.08] - Delay between items in seconds
 * @param {string} [props.as='div'] - Element to render (div, ul, ol)
 * @param {string} [props.className] - Extra classes
 * @returns {JSX.Element}
 */
export function Stagger({ children, stagger = 0.08, as = 'div', className }) {
  const Component = motion[as] || motion.div;
  return (
    <Component
      className={className}
      variants={staggerContainer(stagger)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
    >
      {children}
    </Component>
  );
}

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Item content
 * @param {string} [props.as='div'] - Element to render (div, li)
 * @param {string} [props.className] - Extra classes
 * @returns {JSX.Element}
 */
export function StaggerItem({ children, as = 'div', className }) {
  const reduceMotion = useReducedMotion();
  const Component = motion[as] || motion.div;
  return (
    <Component className={className} variants={reduceMotion ? fade : fadeUp}>
      {children}
    </Component>
  );
}

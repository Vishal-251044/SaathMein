/**
 * Map category icon names from the API (Lucide names) to Lucide components.
 * Only icons listed here are bundled; unknown names fall back to a generic tag.
 */
import {
  AirVent,
  Bike,
  Car,
  Dumbbell,
  GraduationCap,
  House,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sun,
  Tag,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import type { ColorValue } from 'react-native';

type IconComponent = ComponentType<{ size?: number; color?: ColorValue; strokeWidth?: number }>;

const ICONS: Record<string, IconComponent> = {
  'air-vent': AirVent,
  bike: Bike,
  car: Car,
  dumbbell: Dumbbell,
  'graduation-cap': GraduationCap,
  house: House,
  'shopping-basket': ShoppingBasket,
  smartphone: Smartphone,
  sofa: Sofa,
  sun: Sun,
};

/**
 * @param name - Lucide icon name from the category
 * @returns Icon component
 */
export function categoryIcon(name: string | null | undefined): IconComponent {
  return (name && ICONS[name]) || Tag;
}

/**
 * /admin/cities — launch cities and areas (CAT-4). Owner, Admin and Deal Manager.
 */
import CitiesManager from '@/components/features/admin/cities/CitiesManager';

export const metadata = { title: 'Cities' };

/**
 * @returns {JSX.Element}
 */
export default function AdminCitiesPage() {
  return <CitiesManager />;
}

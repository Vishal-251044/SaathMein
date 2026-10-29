/**
 * /admin/catalog — categories and their business rules (CAT-1). Owner, Admin, Deal Manager.
 */
import CategoriesManager from '@/components/features/admin/catalog/CategoriesManager';

export const metadata = { title: 'Categories' };

/**
 * @returns {JSX.Element}
 */
export default function AdminCategoriesPage() {
  return <CategoriesManager />;
}

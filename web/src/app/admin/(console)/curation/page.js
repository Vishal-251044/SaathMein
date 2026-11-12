/**
 * /admin/curation — home banners, featured deals, category order (F34). Owner, Admin.
 */
import CurationPage from '@/components/features/admin/curation/CurationPage';

export const metadata = { title: 'Curation' };

/** @returns {JSX.Element} */
export default function AdminCurationPage() {
  return <CurationPage />;
}

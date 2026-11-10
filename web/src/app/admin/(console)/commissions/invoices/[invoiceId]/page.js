'use client';

/**
 * /admin/commissions/invoices/[invoiceId] — one dealer commission invoice (print-ready).
 */
import { useParams } from 'next/navigation';
import CommissionInvoiceView from '@/components/features/invoices/CommissionInvoiceView';
import { useAdminCommissionInvoice } from '@/hooks/useAdminCommissions';

/** @returns {JSX.Element} */
export default function AdminInvoicePage() {
  const { invoiceId } = useParams();
  const query = useAdminCommissionInvoice(String(invoiceId));
  return <CommissionInvoiceView query={query} backHref="/admin/commissions" />;
}

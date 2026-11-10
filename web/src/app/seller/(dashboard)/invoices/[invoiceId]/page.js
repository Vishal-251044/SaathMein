'use client';

/**
 * /seller/invoices/[invoiceId] — one monthly commission invoice (print or save as PDF).
 * The id is read on the client (the dashboard is client-rendered behind the session).
 */
import { useParams } from 'next/navigation';
import CommissionInvoiceView from '@/components/features/invoices/CommissionInvoiceView';
import { useSellerCommissionInvoice } from '@/hooks/useSellerPurchases';
import { ROUTES } from '@/utils/constants';

/** @returns {JSX.Element} */
export default function SellerInvoicePage() {
  const { invoiceId } = useParams();
  const query = useSellerCommissionInvoice(String(invoiceId));
  return <CommissionInvoiceView query={query} backHref={ROUTES.SELLER_PAYOUTS} />;
}

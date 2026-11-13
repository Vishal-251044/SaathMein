/**
 * /admin/monitor/payments — Razorpay monitor and money actions (PRD §10.11). Owner, Admin, Finance.
 */
import PaymentsMonitor from '@/components/features/admin/monitor/PaymentsMonitor';

export const metadata = { title: 'Payments' };

/**
 * @returns {JSX.Element}
 */
export default function Page() {
  return <PaymentsMonitor />;
}

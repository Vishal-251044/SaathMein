/**
 * /legal/grievance-officer — Grievance officer (Consumer Protection (E-Commerce) Rules 2020,
 * IT Rules 2021). Details come from utils/legal.js (placeholders until the Owner sets them).
 */
import LegalLayout from '@/components/features/legal/LegalLayout';
import { LEGAL } from '@/utils/legal';

export const metadata = { title: 'Grievance officer' };

/** @returns {JSX.Element} */
export default function GrievanceOfficerPage() {
  const officer = LEGAL.grievanceOfficer;
  const rows = [
    ['Name', officer.name],
    ['Designation', officer.designation],
    ['Email', officer.email],
    ['Phone', officer.phone],
    ['Address', officer.address],
    ['Hours', officer.hours],
  ];
  return (
    <LegalLayout title="Grievance officer" path="/legal/grievance-officer">
      <p>
        If you have a complaint about {LEGAL.brandName}, a group, a dealer or a payment, first try
        the app: open a dispute from your group, or report the problem. If you are not satisfied,
        contact our grievance officer.
      </p>
      <dl className="grid gap-3 rounded-card border border-line bg-surface p-5 shadow-card sm:grid-cols-[160px_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-semibold">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <h2>What happens next</h2>
      <ul>
        <li>We acknowledge your complaint within 48 hours and give you a reference number.</li>
        <li>We resolve it within one month and tell you the outcome.</li>
        <li>
          Include your registered mobile number, the group or payment, and what you would like us to
          do.
        </li>
      </ul>
      <h2>Company details</h2>
      <p>
        {LEGAL.companyName} · {LEGAL.registeredAddress} · CIN {LEGAL.cin} · GSTIN {LEGAL.gstin}
      </p>
    </LegalLayout>
  );
}

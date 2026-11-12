/**
 * Dealer dashboard navigation (PRD §10.10). Modules show "Day N" until they are built;
 * `ownerOnly` items are hidden from staff (the API enforces the same rule).
 */
import {
  BadgeCheck,
  Gavel,
  Home,
  IndianRupee,
  LineChart,
  Scale,
  ShoppingBag,
  Store,
  Tags,
  Trophy,
  UsersRound,
} from 'lucide-react';

export const SELLER_NAV_ITEMS = [
  { label: 'Home', href: '/seller', icon: Home },
  { label: 'Verification', href: '/seller/kyc', icon: BadgeCheck, ownerOnly: true },
  { label: 'Business profile', href: '/seller/profile', icon: Store },
  { label: 'Team', href: '/seller/team', icon: UsersRound },
  { label: 'Live auctions', href: '/seller/auctions', icon: Gavel },
  { label: 'Won groups', href: '/seller/won', icon: Trophy },
  { label: 'Group deals', href: '/seller/deals', icon: Tags },
  { label: 'Purchases', href: '/seller/purchases', icon: ShoppingBag },
  { label: 'Payouts', href: '/seller/payouts', icon: IndianRupee },
  { label: 'Disputes', href: '/seller/disputes', icon: Scale },
  { label: 'Insights', icon: LineChart, availableOn: 'Day 17' },
];

/**
 * @param {'owner'|'staff'} role - Team role
 * @returns {Array} Visible items
 */
export const sellerNavItemsForRole = (role) =>
  SELLER_NAV_ITEMS.filter((item) => !item.ownerOnly || role === 'owner');

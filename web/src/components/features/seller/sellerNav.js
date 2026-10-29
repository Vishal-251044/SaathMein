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
  { label: 'Live auctions', icon: Gavel, availableOn: 'Day 9' },
  { label: 'Won groups', icon: Trophy, availableOn: 'Day 9' },
  { label: 'Group deals', icon: Tags, availableOn: 'Day 9' },
  { label: 'Purchases', icon: ShoppingBag, availableOn: 'Day 10' },
  { label: 'Payouts', icon: IndianRupee, availableOn: 'Day 10' },
  { label: 'Insights', icon: LineChart, availableOn: 'Day 17' },
];

/**
 * @param {'owner'|'staff'} role - Team role
 * @returns {Array} Visible items
 */
export const sellerNavItemsForRole = (role) =>
  SELLER_NAV_ITEMS.filter((item) => !item.ownerOnly || role === 'owner');

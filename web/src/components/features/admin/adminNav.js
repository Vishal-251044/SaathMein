/**
 * Admin console navigation (PRD §10.11 console modules).
 * Modules show "Day N" until they are built; `roles` lists who can see each item
 * (Owner sees everything). The API enforces the same rules — hiding is never the security.
 */
import {
  LayoutDashboard,
  Package,
  Store,
  UsersRound,
  Gavel,
  CreditCard,
  Scale,
  Megaphone,
  Settings,
  ShieldCheck,
  MapPin,
} from 'lucide-react';

export const ADMIN_NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, roles: 'all' },
  { label: 'Cities', icon: MapPin, availableOn: 'Day 3', roles: ['admin', 'deal_manager'] },
  { label: 'Catalog', icon: Package, availableOn: 'Day 4', roles: ['admin', 'deal_manager'] },
  { label: 'Sellers', icon: Store, availableOn: 'Day 5', roles: ['admin', 'deal_manager'] },
  {
    label: 'Groups',
    icon: UsersRound,
    availableOn: 'Day 6',
    roles: ['admin', 'deal_manager', 'support'],
  },
  { label: 'Auctions', icon: Gavel, availableOn: 'Day 9', roles: ['admin', 'deal_manager'] },
  { label: 'Payments', icon: CreditCard, availableOn: 'Day 13', roles: ['admin', 'finance'] },
  { label: 'Disputes', icon: Scale, availableOn: 'Day 12', roles: ['admin', 'support'] },
  { label: 'Curation', icon: Megaphone, availableOn: 'Day 11', roles: ['admin'] },
  { label: 'Settings', icon: Settings, availableOn: 'Day 11', roles: ['admin'] },
  { label: 'Team and audit', icon: ShieldCheck, availableOn: 'Day 13', roles: [] },
];

/**
 * Nav items a staff role may see.
 * @param {string} role - Staff role
 * @returns {Array} Visible nav items
 */
export const navItemsForRole = (role) =>
  ADMIN_NAV_ITEMS.filter(
    (item) => role === 'owner' || item.roles === 'all' || item.roles.includes(role),
  );

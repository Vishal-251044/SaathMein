/**
 * Admin console navigation (PRD §10.11 console modules).
 * `roles` lists who can see each item
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
  Shapes,
  Inbox,
  Receipt,
  Bell,
  Activity,
  HeartPulse,
  UserRound,
  ScrollText,
  Radar,
} from 'lucide-react';

export const ADMIN_NAV_ITEMS = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard, roles: 'all' },
  { label: 'Alerts', href: '/admin/alerts', icon: Bell, roles: 'all' },
  {
    label: 'Live auctions',
    href: '/admin/monitor/auctions',
    icon: Gavel,
    roles: ['admin', 'deal_manager', 'support'],
  },
  {
    label: 'Group monitor',
    href: '/admin/monitor/groups',
    icon: Radar,
    roles: ['admin', 'deal_manager', 'support'],
  },
  {
    label: 'Payments',
    href: '/admin/monitor/payments',
    icon: CreditCard,
    roles: ['admin', 'finance'],
  },
  {
    label: 'Dealer monitor',
    href: '/admin/monitor/dealers',
    icon: Activity,
    roles: ['admin', 'deal_manager', 'support'],
  },
  { label: 'Buyers', href: '/admin/monitor/buyers', icon: UserRound, roles: ['admin', 'support'] },
  { label: 'System health', href: '/admin/monitor/system', icon: HeartPulse, roles: ['admin'] },
  { label: 'Cities', href: '/admin/cities', icon: MapPin, roles: ['admin', 'deal_manager'] },
  { label: 'Categories', href: '/admin/catalog', icon: Shapes, roles: ['admin', 'deal_manager'] },
  { label: 'Products', href: '/admin/products', icon: Package, roles: ['admin', 'deal_manager'] },
  { label: 'Sellers', href: '/admin/sellers', icon: Store, roles: ['admin', 'deal_manager'] },
  {
    label: 'Product requests',
    href: '/admin/product-requests',
    icon: Inbox,
    roles: ['admin', 'deal_manager'],
  },
  {
    label: 'Groups',
    href: '/admin/groups',
    icon: UsersRound,
    roles: ['admin', 'deal_manager', 'support'],
  },
  { label: 'Commissions', href: '/admin/commissions', icon: Receipt, roles: ['admin', 'finance'] },
  { label: 'Disputes', href: '/admin/disputes', icon: Scale, roles: ['admin', 'support'] },
  { label: 'Curation', href: '/admin/curation', icon: Megaphone, roles: ['admin'] },
  { label: 'Settings', href: '/admin/settings', icon: Settings, roles: ['admin'] },
  { label: 'Audit log', href: '/admin/audit', icon: ScrollText, roles: ['admin'] },
  { label: 'Team', href: '/admin/team', icon: ShieldCheck, roles: [] },
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

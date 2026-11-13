'use client';

/**
 * ScopeFilters — city and category filters for the monitors (MON-1). Rendered only for
 * roles that can read cities and categories (Owner, Admin, Deal Manager); other roles see
 * platform-wide numbers.
 */
import { useAdminCategories } from '@/hooks/useAdminCatalog';
import { useAdminCities } from '@/hooks/useAdminCities';

const selectClass =
  'min-h-11 w-full rounded-button border border-line bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none';

/** Roles that can use the scope filters. */
export const canScope = (role) => ['owner', 'admin', 'deal_manager'].includes(role);

/**
 * @param {Object} props
 * @param {{ cityId: string, categoryId: string }} props.value
 * @param {(next: { cityId: string, categoryId: string }) => void} props.onChange
 * @returns {JSX.Element}
 */
export default function ScopeFilters({ value, onChange }) {
  const { data: cities } = useAdminCities();
  const { data: categories } = useAdminCategories();
  const leaves = (categories || []).filter((category) => category.parentId);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[480px]">
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        City
        <select
          value={value.cityId}
          onChange={(event) => onChange({ ...value, cityId: event.target.value })}
          className={selectClass}
        >
          <option value="">All cities</option>
          {(cities || []).map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        Category
        <select
          value={value.categoryId}
          onChange={(event) => onChange({ ...value, categoryId: event.target.value })}
          className={selectClass}
        >
          <option value="">All categories</option>
          {leaves.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

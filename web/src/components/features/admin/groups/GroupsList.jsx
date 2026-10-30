'use client';

/**
 * GroupsList — Admin → Groups (read-only on Day 6): filter by city, category, status,
 * visibility and created date, search by product or invite code, CSV export (MON-1).
 * The table scrolls inside its own container on phones.
 */
import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  Search,
  UsersRound,
} from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { useAdminCategories } from '@/hooks/useAdminCatalog';
import { useAdminCities } from '@/hooks/useAdminCities';
import { useAdminGroups } from '@/hooks/useAdminGroups';
import { downloadGroupsCsv } from '@/services/adminGroups.service';
import { GROUP_STATUS_META } from '@/utils/constants';
import { cn, formatINR } from '@/utils/genericFunctions';

const PAGE_SIZE = 25;
const selectClass =
  'min-h-11 w-full rounded-button border border-line bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none';

/** Labelled filter control. */
function Filter({ label, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted">
      {label}
      {children}
    </label>
  );
}

/**
 * @returns {JSX.Element}
 */
export default function GroupsList() {
  const [filters, setFilters] = useState({
    cityId: '',
    categoryId: '',
    status: '',
    visibility: '',
    from: '',
    to: '',
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [csvError, setCsvError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const q = useDebouncedValue(search.trim(), 300);

  // Empty values are left out of the request
  const params = Object.fromEntries(Object.entries({ ...filters, q }).filter(([, value]) => value));
  const { data, isPending, isError, error, refetch, isFetching } = useAdminGroups({
    ...params,
    page,
    limit: PAGE_SIZE,
  });
  const { data: cities } = useAdminCities();
  const { data: categories } = useAdminCategories();
  const leafCategories = (categories || []).filter((category) => category.parentId);
  const meta = data?.meta;

  const set = (key) => (event) => {
    setFilters((prev) => ({ ...prev, [key]: event.target.value }));
    setPage(1);
  };

  /** Download the filtered list. */
  const exportCsv = async () => {
    setCsvError(null);
    setIsExporting(true);
    try {
      await downloadGroupsCsv(params);
    } catch (err) {
      setCsvError(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Groups</h1>
          <p className="mt-1 text-muted">
            Every buyer group. Read-only for now; actions arrive with the full console.
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Download className="size-4" strokeWidth={2} aria-hidden="true" />
          )}
          Export CSV
        </Button>
      </div>
      {csvError ? <Alert>{csvError}</Alert> : null}

      <div className="grid grid-cols-1 gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative sm:col-span-2 lg:col-span-4">
          <span className="sr-only">Search groups</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Product name or invite code"
            className="min-h-11 w-full rounded-button border border-line bg-surface pl-9 pr-3 text-ink focus:border-primary focus:outline-none"
          />
        </label>
        <Filter label="City">
          <select value={filters.cityId} onChange={set('cityId')} className={selectClass}>
            <option value="">All cities</option>
            {(cities || []).map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Category">
          <select value={filters.categoryId} onChange={set('categoryId')} className={selectClass}>
            <option value="">All categories</option>
            {leafCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Status">
          <select value={filters.status} onChange={set('status')} className={selectClass}>
            <option value="">Any status</option>
            {Object.entries(GROUP_STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Visibility">
          <select value={filters.visibility} onChange={set('visibility')} className={selectClass}>
            <option value="">Public and community</option>
            <option value="public">Public</option>
            <option value="community">Community</option>
          </select>
        </Filter>
        <Filter label="Created from">
          <input type="date" value={filters.from} onChange={set('from')} className={selectClass} />
        </Filter>
        <Filter label="Created to">
          <input type="date" value={filters.to} onChange={set('to')} className={selectClass} />
        </Filter>
      </div>

      {isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{error.message}</Alert>
          <Button variant="secondary" onClick={() => refetch()}>
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : isPending ? (
        <div className="h-64 animate-pulse rounded-card bg-surface" aria-busy="true" />
      ) : data.groups.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center">
          <UsersRound className="size-8 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-3 font-semibold text-ink">No groups match these filters</p>
        </div>
      ) : (
        <div
          className={cn(
            'overflow-x-auto rounded-card border border-line bg-surface shadow-card transition-opacity',
            isFetching && 'opacity-70',
          )}
        >
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-line text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Product
                </th>
                <th scope="col" className="px-4 py-3">
                  City
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Members
                </th>
                <th scope="col" className="px-4 py-3">
                  Token
                </th>
                <th scope="col" className="px-4 py-3">
                  Deadline
                </th>
                <th scope="col" className="px-4 py-3">
                  Leader
                </th>
                <th scope="col" className="px-4 py-3">
                  Code
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.groups.map((group) => {
                const status = GROUP_STATUS_META[group.status] || {
                  label: group.status,
                  tone: 'muted',
                };
                return (
                  <tr key={group.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">
                        {group.productName || 'Unknown product'}
                      </p>
                      <p className="text-xs text-muted">
                        {group.visibility === 'community' ? 'Community' : 'Public'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-ink">{group.cityName}</td>
                    <td className="px-4 py-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {group.leaderDecisionDueAt && group.status === 'open' ? (
                        <p className="mt-1 text-xs text-muted">Leader deciding</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink">
                      {group.memberCount} / {group.targetSize}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink">
                      {formatINR(group.tokenAmountPaise)}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      {new Date(group.deadline).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                      {group.deadlineExtended ? (
                        <p className="text-xs text-muted">Extended</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-ink">{group.leaderName || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{group.inviteCode}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Page {meta.page} of {meta.totalPages} · {meta.total} groups
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage(page + 1)}
              disabled={page >= meta.totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

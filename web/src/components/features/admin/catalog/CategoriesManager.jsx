'use client';

/**
 * CategoriesManager — Admin → Categories (CAT-1): the category tree, on/off switches,
 * translations and featured brands, and each sub-category's business rules.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, RefreshCw, Shapes } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import FadeIn from '@/components/animations/FadeIn';
import CategoryRulesForm from '@/components/features/admin/catalog/CategoryRulesForm';
import { useAdminCategories, useUpdateCategory } from '@/hooks/useAdminCatalog';
import { formatINR, formatBps, cn } from '@/utils/genericFunctions';

/**
 * One-line commission summary.
 * @param {Object} commission - `{ type, value }`
 * @returns {string}
 */
const commissionLabel = (commission) =>
  commission?.type === 'flat'
    ? `${formatINR(commission.value)} per unit`
    : formatBps(commission?.value ?? 0);

/**
 * @param {Object} props
 * @param {Object} props.category - Sub-category
 * @param {boolean} props.parentActive - Whether the parent is switched on
 * @returns {JSX.Element}
 */
function SubCategoryRow({ category, parentActive }) {
  const [isOpen, setIsOpen] = useState(false);
  const updateCategory = useUpdateCategory();
  const { rules } = category;

  return (
    <li className="rounded-button border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          className="flex min-h-11 min-w-0 flex-1 basis-60 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted transition-transform',
              isOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink">{category.name}</span>
            <span className="block truncate text-xs text-muted">
              {rules.minSize}–{rules.maxSize} buyers · token {formatINR(rules.tokenAmountPaise)} ·
              commission {commissionLabel(rules.commission)}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-1">
          {!parentActive ? <span className="text-xs text-muted">Parent off</span> : null}
          <Toggle
            checked={category.active}
            label={`${category.name} visible to buyers`}
            disabled={updateCategory.isPending}
            onChange={(active) =>
              updateCategory.mutate({ categoryId: category.id, changes: { active } })
            }
          />
        </div>
      </div>
      {isOpen ? (
        <div className="border-t border-line p-4">
          <CategoryRulesForm
            category={category}
            onSave={(changes) =>
              updateCategory.mutateAsync({ categoryId: category.id, changes: { rules: changes } })
            }
          />
        </div>
      ) : null}
    </li>
  );
}

/**
 * @returns {JSX.Element}
 */
export default function CategoriesManager() {
  const { data: categories, isPending, isError, error, refetch, isFetching } = useAdminCategories();
  const updateCategory = useUpdateCategory();

  const tree = useMemo(() => {
    const list = categories || [];
    return list
      .filter((category) => !category.parentId)
      .map((parent) => ({
        ...parent,
        children: list.filter((child) => child.parentId === parent.id),
      }));
  }, [categories]);

  return (
    <div className="flex flex-col gap-6">
      <FadeIn>
        <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-ink">
          Categories
        </h1>
        <p className="mt-1 text-muted">
          Group sizes, tokens, auction rules and commission per category. Changes apply to new
          groups.
        </p>
      </FadeIn>

      {isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-28 animate-pulse rounded-card border border-line bg-surface"
            />
          ))}
        </div>
      ) : null}

      {isError ? (
        <div className="flex flex-col gap-3">
          <Alert>{error.message}</Alert>
          <Button
            variant="secondary"
            onClick={() => refetch()}
            disabled={isFetching}
            className="self-start"
          >
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : null}

      {categories && tree.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-line bg-surface px-6 py-12 text-center">
          <Shapes className="size-8 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-4 font-bold text-ink">No categories yet</p>
          <p className="mt-1 text-sm text-muted">
            Run <code className="font-mono">npm run seed:categories</code> in the backend.
          </p>
        </div>
      ) : null}

      {tree.map((parent) => (
        <section key={parent.id} className="rounded-card border border-line bg-bg-band p-4 sm:p-5">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">{parent.name}</h2>
              <p className="text-sm text-muted">
                {[parent.nameTranslations?.hi, parent.nameTranslations?.mr]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <Toggle
              checked={parent.active}
              label={`${parent.name} visible to buyers`}
              disabled={updateCategory.isPending}
              onChange={(active) =>
                updateCategory.mutate({ categoryId: parent.id, changes: { active } })
              }
            />
          </header>
          <ul className="flex flex-col gap-2">
            {parent.children.map((child) => (
              <SubCategoryRow key={child.id} category={child} parentActive={parent.active} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

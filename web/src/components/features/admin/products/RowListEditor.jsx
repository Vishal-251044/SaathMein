'use client';

/**
 * RowListEditor — generic "list of rows" editor with add / remove buttons, used for
 * product variants and specs. Each row renders its own fields.
 */
import { Plus, X } from 'lucide-react';
import Button from '@/components/ui/Button';

/**
 * @param {Object} props
 * @param {string} props.title - Section title
 * @param {string} [props.hint] - Short help text
 * @param {Object[]} props.rows - Current rows
 * @param {(rows: Object[]) => void} props.onChange - New rows
 * @param {() => Object} props.createRow - Factory for an empty row
 * @param {(row: Object, update: (patch: Object) => void, index: number) => React.ReactNode} props.renderRow
 * @param {string} props.addLabel - "Add variant"
 * @returns {JSX.Element}
 */
export default function RowListEditor({
  title,
  hint,
  rows,
  onChange,
  createRow,
  renderRow,
  addLabel,
}) {
  const update = (index) => (patch) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const remove = (index) => onChange(rows.filter((_, i) => i !== index));

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-bold text-ink">{title}</legend>
      {hint ? <p className="-mt-1 text-sm text-muted">{hint}</p> : null}
      {rows.map((row, index) => (
        <div key={row.id} className="flex items-start gap-2 rounded-button bg-bg-band p-3">
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            {renderRow(row, update(index), index)}
          </div>
          <button
            type="button"
            onClick={() => remove(index)}
            aria-label={`Remove row ${index + 1}`}
            className="mt-7 grid size-11 shrink-0 place-items-center rounded-button text-muted hover:bg-surface hover:text-danger"
          >
            <X className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      ))}
      <Button
        variant="secondary"
        onClick={() => onChange([...rows, createRow()])}
        className="self-start"
      >
        <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
        {addLabel}
      </Button>
    </fieldset>
  );
}

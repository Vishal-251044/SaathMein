'use client';

/**
 * ProductImport — bulk CSV import (CAT-3): download the template, check a file first
 * (dry run), then import, with a per-row error report for anything that failed.
 */
import { useState } from 'react';
import { CheckCircle2, Download, FileSearch, FileUp, Loader2 } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import FadeIn from '@/components/animations/FadeIn';
import { useImportProducts } from '@/hooks/useAdminCatalog';
import { downloadImportTemplate } from '@/services/adminCatalog.service';

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const COLUMNS = [
  ['category', 'Sub-category slug: cars-evs, two-wheelers, mobiles-laptops, appliances…', true],
  [
    'brand, model',
    'e.g. Honda, Activa 6G — rows with the same brand + model become one product',
    true,
  ],
  ['variant, variant_attrs', 'e.g. DLX and trim=DLX;colour=Red (empty = whole product)', false],
  ['city', 'City slug, e.g. pune — needed when a price is given', false],
  ['mrp, ex_showroom, on_road', 'Prices in rupees, e.g. 81000 or 81,000.50', false],
  ['tags, specs', 'tags: scooter;automatic · specs: Engine=109.51 cc;Mileage=50 kmpl', false],
  ['description, image_urls', 'Text · https image links separated by |', false],
  [
    'active, needs_review',
    'true / false. needs_review=true keeps the product hidden until checked',
    false,
  ],
];

/** Save text as a file in the browser. */
const saveTextFile = (text, filename) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * @returns {JSX.Element}
 */
export default function ProductImport() {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const importProducts = useImportProducts();
  const report = importProducts.data;

  const chooseFile = (event) => {
    const chosen = event.target.files?.[0] || null;
    importProducts.reset();
    setFileError(chosen && chosen.size > MAX_FILE_BYTES ? 'The file is larger than 5 MB' : null);
    setFile(chosen && chosen.size <= MAX_FILE_BYTES ? chosen : null);
  };

  const run = (dryRun) => file && importProducts.mutate({ file, dryRun });

  /** Download the failed rows as CSV so they can be fixed in a spreadsheet. */
  const downloadErrors = () => {
    const lines = [
      'row,errors',
      ...report.failedRows.map(
        ({ row, errors }) => `${row},"${errors.join('; ').replace(/"/g, '""')}"`,
      ),
    ];
    saveTextFile(`${lines.join('\r\n')}\r\n`, 'import-errors.csv');
  };

  return (
    <div className="flex flex-col gap-6">
      <FadeIn>
        <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-ink">
          Import products
        </h1>
        <p className="mt-1 text-muted">
          Upload a CSV to add or update many products at once. Check the file first — nothing is
          saved.
        </p>
      </FadeIn>

      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-button border-2 border-dashed border-line px-4 py-3 hover:border-primary">
            <FileUp className="size-5 text-muted" strokeWidth={2} aria-hidden="true" />
            <span className="truncate text-sm font-semibold text-ink">
              {file ? file.name : 'Choose a .csv file'}
            </span>
            <input type="file" accept=".csv,text/csv" onChange={chooseFile} className="sr-only" />
          </label>
          <Button
            variant="ghost"
            onClick={async () =>
              saveTextFile(await downloadImportTemplate(), 'saathmein-products-template.csv')
            }
          >
            <Download className="size-4" strokeWidth={2} aria-hidden="true" />
            Template
          </Button>
        </div>
        {fileError ? <Alert>{fileError}</Alert> : null}
        {importProducts.isError ? <Alert>{importProducts.error.message}</Alert> : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => run(true)}
            disabled={!file || importProducts.isPending}
          >
            {importProducts.isPending && importProducts.variables?.dryRun ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileSearch className="size-4" strokeWidth={2} aria-hidden="true" />
            )}
            Check file
          </Button>
          <Button onClick={() => run(false)} disabled={!file || importProducts.isPending}>
            {importProducts.isPending && !importProducts.variables?.dryRun ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="size-4" strokeWidth={2} aria-hidden="true" />
            )}
            Import
          </Button>
        </div>
      </section>

      {report ? (
        <section
          className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-6"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-savings-text" aria-hidden="true" />
            <div>
              <p className="font-bold text-ink">
                {report.dryRun ? 'Check finished — nothing was saved' : 'Import finished'}
              </p>
              <p className="text-sm text-muted">
                {report.importedRows} of {report.totalRows} rows OK · {report.productsCreated} new ·{' '}
                {report.productsUpdated} updated
                {!report.dryRun ? ` · ${report.pricesChanged} price changes recorded` : ''}
              </p>
            </div>
          </div>

          {report.failedRows.length ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold text-danger-text">
                  {report.failedRows.length} rows need fixing
                </p>
                <Button variant="secondary" onClick={downloadErrors}>
                  <Download className="size-4" strokeWidth={2} aria-hidden="true" />
                  Download errors
                </Button>
              </div>
              <div className="max-h-96 overflow-auto rounded-button border border-line">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="sticky top-0 bg-bg-band">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-ink">Row</th>
                      <th className="px-3 py-2 font-semibold text-ink">What to fix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {report.failedRows.map(({ row, errors }) => (
                      <tr key={row}>
                        <td className="px-3 py-2 font-mono text-muted">{row}</td>
                        <td className="px-3 py-2 text-ink">{errors.join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-card border border-line bg-bg-band p-4 sm:p-6">
        <h2 className="font-bold text-ink">Columns</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {COLUMNS.map(([name, help, required]) => (
            <div key={name}>
              <dt className="font-mono text-sm font-semibold text-ink">
                {name}
                {required ? (
                  <span className="ml-2 text-xs font-sans text-danger-text">required</span>
                ) : null}
              </dt>
              <dd className="text-sm text-muted">{help}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

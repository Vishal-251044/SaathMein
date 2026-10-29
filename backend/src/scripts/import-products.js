/**
 * import-products — import a products CSV from the command line (same rules as the admin
 * console import). Run seeds first so categories and cities exist.
 *
 *   npm run import:products                         # the starter launch catalog
 *   npm run import:products -- path/to/file.csv     # your own file
 *   npm run import:products -- file.csv --dry-run   # check only, save nothing
 */
const fs = require('fs');
const path = require('path');
const { runScript } = require('./runScript');
const { importProductsCsv } = require('../services/catalog/productImport.service');

const DEFAULT_FILE = path.join(__dirname, 'data', 'launch-products.csv');
const MAX_REPORTED_ERRORS = 30;

runScript('ImportProducts', async (log) => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const file = path.resolve(args.find((arg) => !arg.startsWith('--')) || DEFAULT_FILE);

  if (!fs.existsSync(file)) {
    log.error(`File not found: ${file}`);
    return 1;
  }

  const report = await importProductsCsv(fs.readFileSync(file, 'utf8'), { dryRun });
  log.info(
    `${dryRun ? '[dry run] ' : ''}${report.importedRows}/${report.totalRows} rows imported — ` +
      `${report.productsCreated} products created, ${report.productsUpdated} updated, ` +
      `${report.pricesChanged} prices recorded`,
  );
  report.failedRows.slice(0, MAX_REPORTED_ERRORS).forEach(({ row, errors }) => {
    log.warn(`Row ${row}: ${errors.join('; ')}`);
  });
  if (report.failedRows.length > MAX_REPORTED_ERRORS) {
    log.warn(`…and ${report.failedRows.length - MAX_REPORTED_ERRORS} more failed rows`);
  }
  return report.failedRows.length ? 1 : 0;
});

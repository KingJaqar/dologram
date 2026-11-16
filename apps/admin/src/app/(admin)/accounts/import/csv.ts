import Papa from 'papaparse';
import type { CsvInput, ImportRowResult } from '@dologram/admin-core';

export const MAX_CSV_BYTES = 256 * 1024;
const headerError = 'The CSV needs the columns email, username and display_name.';
export function parseCsv(text: string): { ok: true; input: CsvInput } | { ok: false; message: string } {
  if (new Blob([text]).size > MAX_CSV_BYTES) return { ok: false, message: 'Choose a CSV file of at most 256 KiB.' };
  const source = text.replace(/^\uFEFF/u, '');
  // Inspect raw headers before Papa's duplicate-header renaming/warning behavior.
  const header = Papa.parse<string[]>(source, { delimiter: ',', preview: 1, skipEmptyLines: true }).data[0];
  if (!header || header.length !== 3 || header.join(',') !== 'email,username,display_name') return { ok: false, message: headerError };
  const parsed = Papa.parse<Record<string, string>>(source, { delimiter: ',', header: true, skipEmptyLines: true, preview: 101 });
  if (parsed.data.length > 100) return { ok: false, message: 'A CSV can have at most 100 rows.' };
  if (parsed.errors.length) return { ok: false, message: 'The CSV has invalid quoting or a row with the wrong number of fields.' };
  if (!parsed.data.length) return { ok: false, message: 'The CSV has no account rows.' };
  const rows = parsed.data.map(row => ({ email: row.email ?? '', username: row.username ?? '', display_name: row.display_name ?? '' }));
  return { ok: true, input: { headers: header, rows } };
}

export function resultsCsv(results: ImportRowResult[]): string {
  return Papa.unparse({ fields: ['email', 'password'], data: results.filter(row => row.password).map(row => [row.email, row.password ?? '']) },
    { quotes: true, escapeFormulae: /^[\s]*[=+\-@\t\r]/u });
}

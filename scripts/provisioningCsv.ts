import { dgTrim } from '@dologram/shared/src/validation/text';

/** Only fixed sentences and source line numbers, never account values or paths. */
export class ProvisioningInputError extends Error {}

export interface ProvisioningRow {
  line: number;
  email: string;
  username: string;
  displayName: string;
}

/** The legacy CLI's CSV input; the admin CSV page belongs to Phase 9. */
export function parseProvisioningCsv(input: string): ProvisioningRow[] {
  const text = input.replace(/^\uFEFF/u, '');
  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = '';
  let state: 'start' | 'plain' | 'quoted' | 'closed' = 'start';
  let line = 1;
  let rowLine = 1;

  function endCell() {
    cells.push(dgTrim(cell));
    cell = '';
    state = 'start';
  }
  function endRow() {
    endCell();
    if (cells.length !== 1 || cells[0] !== '') {
      if (records.length >= 101) throw new ProvisioningInputError('A CSV can have at most 100 rows.');
      records.push({ line: rowLine, cells });
    }
    cells = [];
  }

  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    if (state === 'quoted') {
      if (character === '"') {
        if (text.charAt(index + 1) === '"') { cell += '"'; index += 1; }
        else state = 'closed';
      } else {
        cell += character;
        if (character === '\n') line += 1;
      }
      continue;
    }
    if (character === ',') { endCell(); continue; }
    if (character === '\n' || character === '\r') {
      if (character === '\r' && text.charAt(index + 1) === '\n') index += 1;
      endRow();
      line += 1;
      rowLine = line;
      continue;
    }
    if (state === 'closed') {
      if (character === ' ' || character === '\t') continue;
      throw new ProvisioningInputError(`Line ${rowLine} has invalid CSV quoting.`);
    }
    if (character === '"') {
      if (state !== 'start') throw new ProvisioningInputError(`Line ${rowLine} has invalid CSV quoting.`);
      state = 'quoted';
    } else {
      cell += character;
      state = 'plain';
    }
  }
  if (state === 'quoted') throw new ProvisioningInputError(`Line ${rowLine} has an unclosed quoted field.`);
  endRow();
  const header = records.shift()?.cells;
  if (!header || header.length !== 3 || header.join(',') !== 'email,username,display_name') {
    throw new ProvisioningInputError('The CSV needs the columns email, username and display_name.');
  }
  return records.map(record => {
    const [email, username, displayName] = record.cells;
    if (record.cells.length !== 3 || email === undefined || username === undefined || displayName === undefined) {
      throw new ProvisioningInputError(`Line ${record.line} must have exactly 3 fields.`);
    }
    return { line: record.line, email, username, displayName };
  });
}

'use client';
import { startTransition, useEffect, useRef, useState } from 'react';
import type { CsvInput, ImportRowResult } from '@dologram/admin-core';
import { Button } from '../../../../components/Button/Button';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../../../components/DataTable/DataTable';
import { ErrorState } from '../../../../components/ErrorState/ErrorState';
import { strings } from '../../../../strings';
import { createAccount } from '../new/actions';
import { beginCsvImport, finishCsvImport, validateCsv } from './actions';
import { MAX_CSV_BYTES, parseCsv, resultsCsv } from './csv';
import styles from './import.module.css';

type Preview = CsvInput['rows'][number] & { row: number; problem?: string };
const previewColumns: DataTableColumn<Preview>[] = [
  { key: 'row', header: 'Row', widthPercent: 7, align: 'left' },
  { key: 'email', header: strings.accounts.email, widthPercent: 25, align: 'left' },
  { key: 'username', header: strings.accounts.username, widthPercent: 18, align: 'left', mono: true },
  { key: 'display_name', header: strings.accounts.displayName, widthPercent: 20, align: 'left' },
  { key: 'problem', header: 'Problem', widthPercent: 30, align: 'left' },
];
const resultColumns: DataTableColumn<ImportRowResult>[] = [
  { key: 'email', header: strings.accounts.email, widthPercent: 30, align: 'left' },
  { key: 'password', header: 'Password', widthPercent: 30, align: 'left', mono: true },
  { key: 'problem', header: 'Problem', widthPercent: 40, align: 'left' },
];

export function ImportAccountsClient({ prerequisite }: { prerequisite?: string }) {
  const [input, setInput] = useState<CsvInput>();
  const [preview, setPreview] = useState<Preview[]>([]);
  const [results, setResults] = useState<ImportRowResult[]>([]);
  const [phase, setPhase] = useState<'choose' | 'preview' | 'creating' | 'done'>('choose');
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState(0);
  const [page, setPage] = useState(1);
  const [fallback, setFallback] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const importId = useRef<string | undefined>(undefined);
  const requestId = useRef<string | undefined>(undefined);
  const currentResults = useRef<ImportRowResult[]>([]);
  const copyField = useRef<HTMLTextAreaElement>(null);
  const blobUrls = useRef(new Set<string>());
  const valid = preview.filter(row => !row.problem);
  const hasSecrets = results.some(row => row.password);

  useEffect(() => {
    alive.current = true;
    const urls = blobUrls.current;
    const clear = () => {
      alive.current = false;
      currentResults.current = [];
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
      setResults([]);
    };
    window.addEventListener('pagehide', clear);
    return () => { clear(); window.removeEventListener('pagehide', clear); };
  }, []);

  useEffect(() => {
    if (!hasSecrets) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    const deadline = Date.now() + 30 * 60 * 1000;
    const clear = () => {
      currentResults.current = [];
      setResults([]);
      setMessage('One-time results were cleared because the session could not be verified or their display time expired. Check existing accounts; explicitly reset lost passwords.');
    };
    async function verify() {
      try {
        const response = await fetch('/api/session', { cache: 'no-store', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(10000)]) });
        if (stopped) return;
        if (!response.ok || Date.now() >= deadline) { clear(); return; }
        timer = setTimeout(() => { void verify(); }, 30000);
      } catch { if (!stopped) clear(); }
    }
    timer = setTimeout(() => { void verify(); }, 30000);
    return () => { stopped = true; clearTimeout(timer); abort.abort(); };
  }, [hasSecrets]);

  async function choose(file: File | undefined) {
    if (!file || busy.current || importId.current) return;
    busy.current = true;
    setPending(true); setMessage(''); setPreview([]); setInput(undefined); setResults([]); setPhase('choose'); setPage(1);
    setFileName(file.name);
    try {
      if (file.size > MAX_CSV_BYTES) { setMessage('Choose a CSV file of at most 256 KiB.'); return; }
      const parsed = parseCsv(await file.text());
      if (!alive.current) return;
      if (!parsed.ok) { setMessage(parsed.message); return; }
      const checked = await validateCsv(parsed.input);
      if (!alive.current) return;
      if (!checked.ok) { setMessage(checked.message); return; }
      setInput(parsed.input);
      setPreview(parsed.input.rows.map((row, index) => ({ ...row, row: index + 1, problem: checked.rows[index]?.problem })));
      requestId.current = crypto.randomUUID();
      setPhase('preview');
    } catch { if (alive.current) setMessage(strings.common.requestFailed); }
    finally { busy.current = false; if (alive.current) setPending(false); }
  }

  async function run() {
    if (!input || !requestId.current || busy.current || prerequisite) return;
    busy.current = true; setPending(true); setMessage(''); setPhase('creating'); setPage(1);
    try {
      if (!importId.current) {
        const begun = await beginCsvImport({ requestId: requestId.current, input });
        if (!alive.current) return;
        if (!begun.ok) { setMessage(begun.message); setPhase('preview'); return; }
        importId.current = begun.importId;
      }
      for (const row of valid) {
        if (!alive.current) return;
        const previous = currentResults.current.find(value => value.row === row.row);
        if (previous && !previous.pending) continue;
        setProgress(valid.indexOf(row) + 1);
        const response = await createAccount({ importId: importId.current, row: row.row });
        if (!alive.current) return;
        if (!response.ok) { setMessage(response.message); return; }
        if (!('result' in response)) { setMessage(strings.common.requestFailed); return; }
        const result = { ...response.result, ...(previous?.password ? { password: previous.password } : {}) };
        currentResults.current = [...currentResults.current.filter(value => value.row !== row.row), result].sort((a, b) => a.row - b.row);
        setResults(currentResults.current);
      }
      const finished = await finishCsvImport(importId.current);
      if (!alive.current) return;
      if (!finished.ok) { setMessage(finished.message); return; }
      setPhase('done');
    } catch { if (alive.current) setMessage('The response was interrupted. Resume this import to reconcile the same accounts; do not start a new file.'); }
    finally { busy.current = false; if (alive.current) setPending(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(resultsCsv(results)); setMessage(strings.common.copied); }
    catch { setFallback(true); setMessage(strings.password.copyFallback); }
  }
  useEffect(() => { if (fallback) { copyField.current?.focus(); copyField.current?.select(); } }, [fallback]);

  function download() {
    try {
      const url = URL.createObjectURL(new Blob([resultsCsv(results)], { type: 'text/csv' }));
      blobUrls.current.add(url);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dologram-accounts-${new Date().toLocaleDateString('en-CA')}.csv`;
      link.click();
      // Browser navigation has consumed the URL when this task returns.
      setTimeout(() => { URL.revokeObjectURL(url); blobUrls.current.delete(url); }, 0);
    } catch { setMessage('The CSV could not be downloaded. Copy the results instead.'); }
  }

  return <div className={styles.view}>
    {prerequisite && <ErrorState error={prerequisite} />}
    <label className={styles.file}>Choose CSV file
      <input type="file" accept=".csv,text/csv" disabled={pending || phase === 'creating' || phase === 'done'}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; startTransition(() => { void choose(file); }); }} />
    </label>
    <p className={styles.hint}>Use email,username,display_name, in that order. Up to 100 rows and 256 KiB. {fileName}</p>
    {pending && phase === 'choose' && <p role="status">Checking CSV…</p>}
    {phase === 'choose' && <Button disabled>Create</Button>}
    {message && <p role="status" className={styles.message}>{message}</p>}
    {preview.length > 0 && <>
      <p role="status">{valid.length} valid, {preview.length - valid.length} invalid rows</p>
      {phase === 'preview' && <>
        <DataTable columns={previewColumns} rows={preview.slice((page - 1) * 50, page * 50)} rowKey={row => row.row}
          rowClassName={row => row.problem ? styles.invalid : undefined} page={page} pageSize={50} total={preview.length}
          onPageChange={setPage} state="ready" emptyText="No account rows" errorContent={null} label="CSV preview" />
        <Button disabled={pending || !valid.length || Boolean(prerequisite)} onClick={() => setConfirm(true)}>Create</Button>
      </>}
      {phase === 'creating' && <>
        <p role="status">Creating {progress} of {valid.length}</p>
        <div className={styles.track} role="progressbar" aria-label="Creating accounts" aria-valuenow={results.length} aria-valuemin={0} aria-valuemax={valid.length}>
          <div className={styles.fill} style={{ width: `${results.length / valid.length * 100}%` }} />
        </div>
        {!pending && <Button onClick={() => startTransition(() => { void run(); })}>Resume import</Button>}
      </>}
    </>}
    {results.length > 0 && <>
      <p className={styles.hint}>{strings.password.warning} Leaving this screen discards every result.</p>
      <DataTable columns={resultColumns} rows={results.slice((page - 1) * 50, page * 50)} rowKey={row => row.row}
        page={page} pageSize={50} total={results.length} onPageChange={setPage} state="ready" emptyText="No results" errorContent={null} label="Import results" />
      <div className={styles.actions}>
        <Button variant="secondary" disabled={!hasSecrets} onClick={() => void copy()}>Copy</Button>
        <Button variant="secondary" disabled={!hasSecrets} onClick={download}>Download as CSV</Button>
      </div>
      {fallback && <textarea ref={copyField} className={styles.copy} aria-label="Copy import results" readOnly value={resultsCsv(results)} />}
    </>}
    {phase === 'done' && <p role="status">Import complete.</p>}
    <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={`Create ${valid.length} accounts?`}
      body="Each valid row creates one account. Invalid rows will be skipped." tone="primary" actionLabel="Create"
      onConfirm={async () => { setConfirm(false); await run(); return { ok: true }; }} />
  </div>;
}

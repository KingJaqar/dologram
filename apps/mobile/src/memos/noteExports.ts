import { Directory, File, FileMode, Paths } from 'expo-file-system';
import type { MemoNote } from '@dologram/shared';

function utf8(value: string): Uint8Array { return new TextEncoder().encode(value); }
function escapeXml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries: readonly { name: string; bytes: Uint8Array }[]): Uint8Array {
  const local: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  for (const entry of entries) {
    const name = utf8(entry.name); const crc = crc32(entry.bytes); const header = new Uint8Array(30 + name.length + entry.bytes.length); const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(8, 0, true); view.setUint32(14, crc, true); view.setUint32(18, entry.bytes.length, true); view.setUint32(22, entry.bytes.length, true); view.setUint16(26, name.length, true); header.set(name, 30); header.set(entry.bytes, 30 + name.length); local.push(header);
    const directory = new Uint8Array(46 + name.length); const dir = new DataView(directory.buffer); dir.setUint32(0, 0x02014b50, true); dir.setUint16(4, 20, true); dir.setUint16(6, 20, true); dir.setUint32(16, crc, true); dir.setUint32(20, entry.bytes.length, true); dir.setUint32(24, entry.bytes.length, true); dir.setUint16(28, name.length, true); dir.setUint32(42, offset, true); directory.set(name, 46); central.push(directory); offset += header.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0); const end = new Uint8Array(22); const endView = new DataView(end.buffer); endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, entries.length, true); endView.setUint16(10, entries.length, true); endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + end.length); let cursor = 0; for (const item of local) { result.set(item, cursor); cursor += item.length; } for (const item of central) { result.set(item, cursor); cursor += item.length; } result.set(end, cursor); return result;
}
function pdf(note: MemoNote): Uint8Array {
  const text = `${note.title}\n\n${note.description}\n\n${note.body}`.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)').split('\n').slice(0, 120);
  const stream = `BT /F1 11 Tf 50 780 Td ${text.map((line) => `(${line.slice(0, 110)}) Tj 0 -14 Td`).join(' ')} ET`;
  const objects = [`<< /Type /Catalog /Pages 2 0 R >>`, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let output = '%PDF-1.4\n'; const offsets: number[] = []; objects.forEach((object, index) => { offsets[index] = output.length; output += `${index + 1} 0 obj\n${object}\nendobj\n`; }); const xref = output.length; output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((value) => `${String(value).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return utf8(output);
}
export type NoteExportFormat = 'docx' | 'pdf' | 'txt' | 'md';
export async function exportMemoNote(note: MemoNote, format: NoteExportFormat): Promise<string> {
  const directory = new Directory(Paths.cache, 'memo-exports'); directory.create({ intermediates: true, idempotent: true });
  const base = note.title.trim().replace(/[^\w.-]+/g, '-').slice(0, 64) || 'memo-note'; const extension = format === 'md' ? 'md' : format; const file = new File(directory, `${base}-${note.revision}.${extension}`); if (file.exists) file.delete(); file.create({ intermediates: true, overwrite: true });
  const markdown = `# ${note.title}\n\n${note.description ? `${note.description}\n\n` : ''}${note.body}\n`;
  const bytes = format === 'txt' ? utf8(`${note.title}\n\n${note.description}\n\n${note.body}\n`) : format === 'md' ? utf8(markdown) : format === 'pdf' ? pdf(note) : zip([{ name: '[Content_Types].xml', bytes: utf8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>') }, { name: '_rels/.rels', bytes: utf8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>') }, { name: 'word/document.xml', bytes: utf8(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${[note.title, note.description, ...note.body.split('\n')].map((line) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`) }]);
  const handle = file.open(FileMode.WriteOnly); try { handle.writeBytes(bytes); } finally { handle.close(); } return file.uri;
}

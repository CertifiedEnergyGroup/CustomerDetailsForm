// Standard ZIP32, STORE method (no recompression of photos/videos/PDFs).
// Keep original File blobs as parts; CRC is calculated in 1 MiB chunks rather
// than reading all videos into JS memory. No network or third-party runtime.
const LIMIT = 0xffffffff;
const encoder = new TextEncoder();
const crcTable = Array.from({length: 256}, (_, i) => {
  let value = i;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
async function crc32(blob) {
  let crc = 0xffffffff;
  for (let offset = 0; offset < blob.size; offset += 1024 * 1024) {
    const chunk = new Uint8Array(await blob.slice(offset, offset + 1024 * 1024).arrayBuffer());
    for (const byte of chunk) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function dosDate(value) {
  const date = new Date(value || Date.now());
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));
  return {date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >>> 1)};
}
function header(length) {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  return {bytes, u16: (at, value) => view.setUint16(at, value, true), u32: (at, value) => view.setUint32(at, value, true)};
}
// File-system-safe names preserve readable spaces and Unicode. Only the address
// is capped; count Unicode code points rather than cutting a surrogate pair.
export function downloadFilename(customerName, address, extension) {
  if (!['txt', 'zip'].includes(extension)) throw new Error('Unsupported download extension.');
  const clean = (value, fallback) => {
    let name = String(value || '').normalize('NFC')
      .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')
      .replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '');
    return name || fallback;
  };
  const customer = clean(customerName, 'Customer');
  const shortAddress = clean(Array.from(clean(address, 'Address')).slice(0, 15).join(''), 'Address');
  return `${customer} - ${shortAddress}.${extension}`;
}
export function uniqueFileNames(files) {
  const used = new Set();
  return files.map(file => {
    let base = String(file.name || 'attachment').normalize('NFC').split(/[\\/]/).pop()
      .replace(/[<>:"|?*\u0000-\u001f\u007f]/g, '_').trim().replace(/[. ]+$/g, '') || 'attachment';
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(base)) base = '_' + base;
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const extension = dot > 0 ? base.slice(dot) : '';
    let name = base, number = 2;
    while (used.has(name.toLocaleLowerCase())) name = `${stem} (${number++})${extension}`;
    used.add(name.toLocaleLowerCase());
    return name;
  });
}
export async function createZip(entries, onProgress = () => {}) {
  if (entries.length > 65535) throw new Error('Too many files for one ZIP pack (maximum 65,535).');
  // Preflight ZIP32 limits before reading any attachment bytes.
  let estimated = 22;
  for (const entry of entries) {
    const length = encoder.encode(entry.name).length;
    if (entry.name.startsWith('/') || /[\\\u0000]/.test(entry.name) || entry.name.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid archive filename.');
    if (length > 65535 || entry.blob.size > LIMIT) throw new Error('A file is too large for this ZIP pack.');
    estimated += entry.blob.size + 76 + 2 * length;
  }
  if (estimated > LIMIT) throw new Error('This pack exceeds the 4 GB ZIP limit. Remove some files and try again.');
  const parts = [], central = [];
  let offset = 0, centralSize = 0;
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index], name = encoder.encode(entry.name);
    onProgress(index + 1, entries.length);
    const crc = await crc32(entry.blob), date = dosDate(entry.modified);
    const local = header(30);
    local.u32(0, 0x04034b50); local.u16(4, 20); local.u16(6, 0x0800);
    local.u16(10, date.time); local.u16(12, date.date); local.u32(14, crc);
    local.u32(18, entry.blob.size); local.u32(22, entry.blob.size); local.u16(26, name.length);
    parts.push(local.bytes, name, entry.blob);
    const directory = header(46);
    directory.u32(0, 0x02014b50); directory.u16(4, 20); directory.u16(6, 20); directory.u16(8, 0x0800);
    directory.u16(12, date.time); directory.u16(14, date.date); directory.u32(16, crc);
    directory.u32(20, entry.blob.size); directory.u32(24, entry.blob.size); directory.u16(28, name.length); directory.u32(42, offset);
    central.push(directory.bytes, name);
    offset += 30 + name.length + entry.blob.size;
    centralSize += 46 + name.length;
  }
  const end = header(22);
  end.u32(0, 0x06054b50); end.u16(8, entries.length); end.u16(10, entries.length);
  end.u32(12, centralSize); end.u32(16, offset);
  return new Blob([...parts, ...central, end.bytes], {type: 'application/zip'});
}
export function buildBriefPack(brief, files, onProgress, briefFilename = 'customer-brief.txt') {
  const names = uniqueFileNames(files);
  return createZip([
    {name: briefFilename, blob: new Blob([brief + '\n'], {type: 'text/plain;charset=utf-8'})},
    ...files.map((file, i) => ({name: `attachments/${names[i]}`, blob: file, modified: file.lastModified}))
  ], onProgress);
}

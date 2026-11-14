// Storan IndexedDB untuk LepakTune: lagu, stem, tetapan dan peti masuk (share target).
import { openDB } from 'idb';

export class StorageFullError extends Error {
  constructor(msg = 'Storan penuh, padam lagu lama') { super(msg); this.name = 'StorageFullError'; }
}

const DB_NAME = 'lepaktune';
let dbp = null;

export function getDb() {
  if (!dbp) {
    dbp = openDB(DB_NAME, 1, {
      upgrade(db) {
        const songs = db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
        songs.createIndex('createdAt', 'createdAt');
        db.createObjectStore('stems'); // kunci: `${songId}:${mode}`
        db.createObjectStore('settings');
        db.createObjectStore('inbox', { keyPath: 'id', autoIncrement: true });
      },
    });
  }
  return dbp;
}

/** Untuk ujian sahaja. */
export async function _resetDb() {
  if (dbp) (await dbp).close();
  dbp = null;
}

function wrapQuota(err) {
  if (err && (err.name === 'QuotaExceededError' || err.inner?.name === 'QuotaExceededError')) return new StorageFullError();
  return err;
}

export async function addSong({ title, blob, durationSec, parentId = null, label = '' }) {
  const db = await getDb();
  try {
    return await db.add('songs', {
      title, blob, durationSec, parentId, label,
      mime: blob.type || 'audio/mpeg',
      createdAt: Date.now(),
      hasStems4: false, hasStems6: false,
    });
  } catch (e) { throw wrapQuota(e); }
}

export async function getSong(id) {
  return (await getDb()).get('songs', id);
}

export async function listSongs() {
  const all = await (await getDb()).getAll('songs');
  return all
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ blob, ...meta }) => ({ ...meta, size: blob?.size ?? 0 }));
}

export async function renameSong(id, title) {
  const db = await getDb();
  const s = await db.get('songs', id);
  if (!s) return;
  s.title = title;
  await db.put('songs', s);
}

export async function deleteSong(id) {
  const db = await getDb();
  const tx = db.transaction(['songs', 'stems'], 'readwrite');
  await Promise.all([
    tx.objectStore('songs').delete(id),
    tx.objectStore('stems').delete(`${id}:4`),
    tx.objectStore('stems').delete(`${id}:6`),
    tx.done,
  ]);
}

/** Simpan semua stem dalam satu transaksi: sama ada semua tersimpan atau tiada langsung. */
export async function putStems(songId, mode, stems) {
  const db = await getDb();
  const tx = db.transaction(['songs', 'stems'], 'readwrite');
  tx.done.catch(() => {}); // elak "unhandled" bila transaksi dibatalkan
  try {
    const song = await tx.objectStore('songs').get(songId);
    if (!song) throw new Error('Lagu tiada');
    await tx.objectStore('stems').put(stems, `${songId}:${mode}`);
    song[`hasStems${mode}`] = true;
    await tx.objectStore('songs').put(song);
    await tx.done;
  } catch (e) {
    try { tx.abort(); } catch { /* sudah tamat */ }
    throw wrapQuota(e);
  }
}

export async function getStems(songId, mode) {
  return (await getDb()).get('stems', `${songId}:${mode}`);
}

export async function getSetting(key, def) {
  const v = await (await getDb()).get('settings', key);
  return v === undefined ? def : v;
}

export async function setSetting(key, val) {
  await (await getDb()).put('settings', val, key);
}

export async function pushInbox(file) {
  await (await getDb()).add('inbox', { blob: file, name: file.name || 'lagu', at: Date.now() });
}

export async function drainInbox() {
  const db = await getDb();
  const items = await db.getAll('inbox');
  await db.clear('inbox');
  return items;
}

export async function storageEstimate() {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  return { usage, quota };
}

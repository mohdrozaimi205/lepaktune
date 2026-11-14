import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../src/store/db.js';

const blob = (n = 10) => new Blob([new Uint8Array(n)], { type: 'audio/mpeg' });

beforeEach(async () => {
  await db._resetDb();
  await new Promise((r) => { const req = indexedDB.deleteDatabase('lepaktune'); req.onsuccess = req.onerror = r; });
});

describe('db', () => {
  it('tambah, senarai, padam', async () => {
    const a = await db.addSong({ title: 'A', blob: blob(), durationSec: 10 });
    await db.addSong({ title: 'B', blob: blob(), durationSec: 20 });
    expect((await db.listSongs()).map((s) => s.title).sort()).toEqual(['A', 'B']);
    await db.deleteSong(a);
    expect((await db.listSongs()).map((s) => s.title)).toEqual(['B']);
  });
  it('padam lagu turut padam stem', async () => {
    const a = await db.addSong({ title: 'A', blob: blob(), durationSec: 10 });
    await db.putStems(a, 4, { vocals: blob(), drums: blob(), bass: blob(), other: blob() });
    expect((await db.getSong(a)).hasStems4).toBe(true);
    await db.deleteSong(a);
    expect(await db.getStems(a, 4)).toBeUndefined();
  });
  it('putStems gagal (quota) -> StorageFullError dan tiada stem separa', async () => {
    const a = await db.addSong({ title: 'A', blob: blob(), durationSec: 10 });
    const d = await db.getDb();
    const orig = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (v, k) {
      if (this.name === 'stems') { const e = new DOMException('penuh', 'QuotaExceededError'); throw e; }
      return orig.call(this, v, k);
    };
    try {
      await expect(db.putStems(a, 4, { vocals: blob() })).rejects.toBeInstanceOf(db.StorageFullError);
    } finally { IDBObjectStore.prototype.put = orig; }
    expect(await db.getStems(a, 4)).toBeUndefined();
    expect((await db.getSong(a)).hasStems4).toBe(false);
    void d;
  });
  it('tetapan dan peti masuk', async () => {
    expect(await db.getSetting('format', 'mp3')).toBe('mp3');
    await db.setSetting('format', 'wav');
    expect(await db.getSetting('format', 'mp3')).toBe('wav');
    await db.pushInbox(new File([blob()], 'x.mp3'));
    expect((await db.drainInbox()).length).toBe(1);
    expect((await db.drainInbox()).length).toBe(0);
  });
});

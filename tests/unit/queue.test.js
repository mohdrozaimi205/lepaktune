import { describe, it, expect, vi } from 'vitest';
import { Queue } from '../../src/player/queue.js';

describe('Queue', () => {
  it("ulang 'one' ulang lagu sama bila habis", () => {
    const q = new Queue(); q.setList([1, 2, 3], 2); q.setRepeat('one');
    expect(q.onTrackEnded()).toBe(2);
  });
  it("ulang 'all' kembali ke lagu pertama", () => {
    const q = new Queue(); q.setList([1, 2, 3], 3); q.setRepeat('all');
    expect(q.onTrackEnded()).toBe(1);
  });
  it("ulang 'off' berhenti di hujung", () => {
    const q = new Queue(); q.setList([1, 2], 2); q.setRepeat('off');
    expect(q.onTrackEnded()).toBeNull();
  });
  it('⏭ manual tetap beralih walaupun ulang satu', () => {
    const q = new Queue(); q.setList([1, 2], 1); q.setRepeat('one');
    expect(q.next(true)).toBe(2);
  });
  it('shuffle lawat semua lagu sekali sebelum ulang', () => {
    const q = new Queue(); q.setList([1, 2, 3, 4, 5], 1); q.setShuffle(true);
    const seen = new Set([q.current]);
    for (let i = 0; i < 4; i++) seen.add(q.next(false));
    expect(seen.size).toBe(5);
    expect(q.current).toBe(1 === q.order[0] ? q.order[4] : q.current);
  });
  it('pemasa tidur emit sleep', () => {
    vi.useFakeTimers();
    const q = new Queue(); const fn = vi.fn();
    q.addEventListener('sleep', fn);
    q.startSleepTimer(30);
    vi.advanceTimersByTime(30 * 60000 - 1); expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(fn).toHaveBeenCalledOnce();
    expect(q.sleepEndsAt).toBeNull();
    vi.useRealTimers();
  });
  it('remove lagu semasa kekal dalam julat', () => {
    const q = new Queue(); q.setList([1, 2, 3], 3); q.remove(3);
    expect(q.current).toBe(2);
  });
});

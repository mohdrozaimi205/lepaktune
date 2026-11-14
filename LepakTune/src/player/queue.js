// Giliran lagu: ulang, shuffle, pemasa tidur. Logik tulen (tiada audio) supaya mudah diuji.
export class Queue extends EventTarget {
  constructor({ random = Math.random } = {}) {
    super();
    this.random = random;
    this.list = [];
    this.order = [];
    this.pos = -1;
    this.repeat = 'all'; // 'off' | 'one' | 'all'
    this.shuffle = false;
    this._sleep = null;
    this.sleepEndsAt = null;
  }

  setList(ids, startId = ids[0]) {
    this.list = [...ids];
    this._rebuild(startId);
  }

  get current() {
    return this.pos >= 0 ? this.order[this.pos] : null;
  }

  jumpTo(id) {
    const i = this.order.indexOf(id);
    if (i >= 0) this.pos = i;
    else { this.list.push(id); this._rebuild(id); }
    return this.current;
  }

  _rebuild(startId) {
    if (this.shuffle) {
      const rest = this.list.filter((x) => x !== startId);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      this.order = startId !== undefined && this.list.includes(startId) ? [startId, ...rest] : rest;
    } else {
      this.order = [...this.list];
    }
    this.pos = this.order.length ? Math.max(0, this.order.indexOf(startId)) : -1;
  }

  setShuffle(on) {
    this.shuffle = !!on;
    this._rebuild(this.current ?? undefined);
  }

  setRepeat(mode) {
    if (!['off', 'one', 'all'].includes(mode)) throw new Error('mod ulang tidak sah');
    this.repeat = mode;
  }

  /** Dipanggil bila lagu habis sendiri. Pulangan id seterusnya atau null (berhenti). */
  onTrackEnded() {
    if (this.repeat === 'one') return this.current;
    return this.next(false);
  }

  /** manual=true: butang ⏭ (sentiasa beralih walaupun ulang 'one'). */
  next(manual = true) {
    if (!this.order.length) return null;
    if (this.pos < this.order.length - 1) this.pos++;
    else if (this.repeat === 'all' || manual) {
      if (this.shuffle) this._rebuild(undefined);
      this.pos = 0;
    } else return null;
    return this.current;
  }

  prev() {
    if (!this.order.length) return null;
    this.pos = this.pos > 0 ? this.pos - 1 : this.order.length - 1;
    return this.current;
  }

  remove(id) {
    const cur = this.current;
    this.list = this.list.filter((x) => x !== id);
    this.order = this.order.filter((x) => x !== id);
    this.pos = cur === id ? Math.min(this.pos, this.order.length - 1) : this.order.indexOf(cur);
  }

  startSleepTimer(minutes) {
    this.cancelSleepTimer();
    this.sleepEndsAt = Date.now() + minutes * 60000;
    this._sleep = setTimeout(() => {
      this._sleep = null;
      this.sleepEndsAt = null;
      this.dispatchEvent(new Event('sleep'));
    }, minutes * 60000);
  }

  cancelSleepTimer() {
    if (this._sleep) clearTimeout(this._sleep);
    this._sleep = null;
    this.sleepEndsAt = null;
  }
}

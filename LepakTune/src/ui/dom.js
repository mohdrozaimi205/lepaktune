// Pembantu DOM kecil: h(), toast(), modal().
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** acts: [{label, onClick}] */
export function toast(msg, { bad = false, ms = 3500, acts = [] } = {}) {
  const box = document.getElementById('toasts');
  const t = h('div', { class: `toast${bad ? ' bad' : ''}`, role: 'status' },
    h('span', {}, msg),
    acts.length ? h('div', { class: 'acts' }, acts.map((a) => h('button', { class: 'btn', onClick: () => { a.onClick(); t.remove(); } }, a.label))) : null,
  );
  box.append(t);
  setTimeout(() => t.remove(), acts.length ? Math.max(ms, 8000) : ms);
  return t;
}

/** Pulangan Promise<boolean>. */
export function confirmBox(title, body, { yes = 'Ya', no = 'Batal', danger = false } = {}) {
  return new Promise((resolve) => {
    const done = (v) => { bg.remove(); resolve(v); };
    const bg = h('div', { class: 'modal-bg', onClick: (e) => { if (e.target === bg) done(false); } },
      h('div', { class: 'modal', role: 'dialog' },
        h('h2', {}, title),
        typeof body === 'string' ? h('p', { class: 'muted' }, body) : body,
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost', onClick: () => done(false) }, no),
          h('button', { class: `btn ${danger ? 'danger' : 'hot'}`, onClick: () => done(true) }, yes),
        ),
      ),
    );
    document.body.append(bg);
  });
}

export function infoBox(title, body, actions = []) {
  const bg = h('div', { class: 'modal-bg', onClick: (e) => { if (e.target === bg) bg.remove(); } },
    h('div', { class: 'modal', role: 'dialog' },
      h('h2', {}, title),
      body,
      h('div', { class: 'row' },
        h('button', { class: 'btn ghost', onClick: () => bg.remove() }, 'Tutup'),
        ...actions.map((a) => h('button', { class: 'btn hot', onClick: () => { a.onClick(); if (!a.keep) bg.remove(); } }, a.label)),
      ),
    ),
  );
  document.body.append(bg);
  return bg;
}

export function fmtBytes(n) {
  if (!n) return '0 MB';
  if (n < 1e9) return `${(n / 1e6).toFixed(0)} MB`;
  return `${(n / 1e9).toFixed(1)} GB`;
}

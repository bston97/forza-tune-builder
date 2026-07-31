/* Minimal DOM shim for running index.html's inline <script> under plain Node,
   with no browser and no dependencies. Loads the script text and hands back
   fake globals to eval() it against.

   Element behavior needed by the app (dataset, innerHTML, addEventListener/
   fire for our own event dispatch, querySelectorAll for the .warn-strip and
   input.vi-flatten logic in sheet()) is stubbed just enough to exercise real
   app logic — this is not a browser, so anything relying on real layout,
   CSS, or the DOM tree shape won't work here. Use the app in an actual
   browser for that (see the `run` skill / preview tools). */
const fs = require('fs');
const path = require('path');

function readScript() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  return html.split('<script>')[1].split('</' + 'script>')[0];
}

function makeShim() {
  function fakeEl() {
    const e = {
      innerHTML: '', value: '', className: '', textContent: 'Delete',
      dataset: {}, style: {}, disabled: false, onclick: null, open: false,
      href: '', download: '', _l: {},
      addEventListener(t, f) { (e._l[t] = e._l[t] || []).push(f); },
      fire(t, ev) { (e._l[t] || []).forEach(f => f(ev)); },
      click() { if (e.onclick) e.onclick(); },
      focus() {}, blur() {}, scrollIntoView() {},
      querySelectorAll(sel) {
        if (sel === '.warn') {
          const ms = e.innerHTML.match(/<div class="warn">[\s\S]*?<\/div>/g) || [];
          return ms.map(m => ({ remove() { e.innerHTML = e.innerHTML.replace(m, ''); } }));
        }
        if (sel === 'input.vi') {
          const ms = e.innerHTML.match(/<input class="vi[^"]*"[^>]*>/g) || [];
          return ms.map(m => ({
            value: (m.match(/value="([^"]*)"/) || [])[1] || '',
            className: (m.match(/class="([^"]*)"/) || [])[1] || '',
            parentNode: {
              replaceChild(s) {
                const col = s.style && s.style.color ? ' style="color:' + s.style.color + '"' : '';
                e.innerHTML = e.innerHTML.replace(m, '<span' + col + '>' + s.textContent + '</span>');
              }
            }
          }));
        }
        return [];
      }
    };
    return e;
  }

  const els = {};
  const document = {
    getElementById: id => els[id] || (els[id] = fakeEl()),
    querySelector: () => ({ textContent: '' }),
    addEventListener() {},
    createElement: () => fakeEl(),
    activeElement: { blur() {} }
  };
  const window = { innerWidth: 1280 };
  const localStorage = {
    d: {},
    getItem(k) { return this.d[k] || null; },
    setItem(k, v) { this.d[k] = v; }
  };
  const blobBox = { value: null };
  const URL = { createObjectURL: b => { blobBox.value = b; return 'blob:x'; }, revokeObjectURL() {} };
  const Blob = class { constructor(parts) { this.parts = parts; } };

  return { els, document, window, localStorage, URL, Blob, blobBox };
}

/* Run assertions with a shared PASS/FAIL log format every test file uses. */
function ok(label, cond, extra) {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra !== undefined ? '   ' + extra : ''));
}

module.exports = { readScript, makeShim, ok };

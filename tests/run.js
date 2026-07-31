/* Runs every *.test.js in this directory as a child process, aggregates the
   PASS/FAIL lines each one prints, and exits non-zero if anything failed or
   crashed. This is the single command CI or a remote session should run:

     node tests/run.js

   Each test file is a standalone script (see shim.js) — this file only
   orchestrates and summarizes; it doesn't know anything about what the tests
   check. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter(f => f.endsWith('.test.js'))
  .sort();

let totalPass = 0, totalFail = 0, crashed = [];

for (const f of files) {
  let out;
  try {
    out = execFileSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8' });
  } catch (e) {
    console.log(f.padEnd(20) + 'CRASHED');
    console.log((e.stdout || '') + (e.stderr || e.message));
    crashed.push(f);
    continue;
  }
  const pass = (out.match(/^PASS/gm) || []).length;
  const fail = (out.match(/^FAIL/gm) || []).length;
  totalPass += pass;
  totalFail += fail;
  console.log(f.padEnd(20) + pass + ' pass' + (fail ? ', ' + fail + ' FAIL' : ''));
  if (fail) console.log(out.split('\n').filter(l => l.startsWith('FAIL')).map(l => '  ' + l).join('\n'));
}

console.log('');
console.log('TOTAL: ' + totalPass + ' passed, ' + totalFail + ' failed' +
  (crashed.length ? ', ' + crashed.length + ' file(s) crashed: ' + crashed.join(', ') : ''));

process.exit(totalFail > 0 || crashed.length > 0 ? 1 : 0);

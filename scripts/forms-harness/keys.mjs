// Keyboard and focus checks on the harness `joints` page through the DevTools port.
// node keys.mjs <chrome-ip>
const host = process.argv[2];
const list = await (await fetch(`http://${host}:9222/json/list`)).json();
const target = list.find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl.replace(/ws:\/\/[^/]+/, `ws://${host}:9222`));
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let n = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++n;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const js = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result.value;
const key = async (k, code) => {
  const cr = String.fromCharCode(13);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: code ?? k, windowsVirtualKeyCode: { ArrowDown: 40, ArrowUp: 38, End: 35, Home: 36, Enter: 13 }[k] ?? 0, ...(k === 'Enter' ? { text: cr, unmodifiedText: cr } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: code ?? k });
  await sleep(120);
};
const label = () => js("(document.activeElement && (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim().slice(0,40) || document.activeElement.id)) || 'body'");
const results = [];
const check = (name, ok, detail) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);

await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1200, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file:///out/joints.html' });
await sleep(2500);

// GridRows: arrows move between a column's buttons; Home/End.
await js("document.querySelector('#j-sessions [data-grid-action]').focus()");
let at = await label();
check('focus starts on the first action', at === 'Skip Thu 19 Nov', at);
await key('ArrowDown');
at = await label();
check('ArrowDown goes to the next row\'s action', at === 'Put Thu 24 Dec back', at);
await key('End');
at = await label();
check('End goes to the last action', at === 'Skip Thu 28 Jan', at);
await key('Home');
at = await label();
check('Home goes back to the first', at === 'Skip Thu 19 Nov', at);
// Skip keeps focus on the same row's button (now "Put … back").
await key('Enter', 'Enter');
at = await label();
check('Enter skips; focus stays on the row, now "Put back"', at === 'Put Thu 19 Nov back', at);
const struck = await js("getComputedStyle(document.querySelector('#j-sessions [data-grid-row] [data-strike]')).textDecorationLine");
check('a muted row strikes its number and date', struck === 'line-through', struck);

// GridRows: removing rows moves focus to the action now in that place, then to "Add a variant".
await js("[...document.querySelectorAll('#j-variants [data-grid-action]')][1].focus()");
await key('Enter', 'Enter');
at = await label();
check('removing the last row focuses the action now last', at === 'Remove Unframed sheet', at);
await key('Enter', 'Enter');
at = await label();
check('removing the only row focuses "Add a variant"', /Add a variant/.test(at), at);
const empty = await js("(document.querySelector('#j-variants .frm-grid-empty')||{}).textContent||''");
check('the empty line shows', /No variants/.test(empty), empty);

// PicturesField: Move later, announced, order changed; focus kept when the move reaches the end.
const firstAlt = () => js("document.querySelector('#j-pics .frm-pics-hit').getAttribute('aria-label')");
const before = await firstAlt();
await js("[...document.querySelectorAll('.frm-pics-chosen button')].find(b => b.textContent.includes('Move later')).click()");
await sleep(200);
const after = await firstAlt();
const said = await js("[...document.querySelectorAll('.frm-pics [aria-live]')][0].textContent");
check('Move later reorders the pictures', before !== after && /Detail of the aquatint grain/.test(after), after);
check('the move is announced', /Moved to 2 of 4/.test(said), said);
// keyboard on a tile: Enter chooses it
await js("[...document.querySelectorAll('#j-pics .frm-pics-hit')][3].focus()");
await key('Enter', 'Enter');
const chosen = await js("document.querySelector('#j-pics-chosen .frm-pics-chosen-h').textContent");
check('Enter on a tile chooses it', /Picture 4 of 4/.test(chosen), chosen);
await js("[...document.querySelectorAll('.frm-pics-chosen button')].find(b => b.textContent.includes('Move earlier')).focus()");
await key('Enter', 'Enter');
at = await label();
const chosen2 = await js("document.querySelector('#j-pics-chosen .frm-pics-chosen-h').textContent");
check('Move earlier moves it and keeps focus on the button', /Move earlier/.test(at) && /Picture 3 of 4/.test(chosen2), at + ' / ' + chosen2);

// CreditRows: Another credit adds a row and focuses its person box.
await js("document.querySelector('.frm-credits-add').click()");
await sleep(200);
const rows = await js("document.querySelectorAll('.frm-credit').length");
const focusedRow = await js("(document.activeElement.closest('[data-credit-row]')||{}).getAttribute ? document.activeElement.closest('[data-credit-row]').getAttribute('data-credit-row') : null");
check('Another credit adds a row', rows === 3, String(rows));
check('the new row\'s person box has focus', focusedRow === '2', String(focusedRow));
await js("document.querySelector('.frm-credits-add') && document.querySelector('.frm-credits-add').click()");
await sleep(200);
const addGone = await js("!document.querySelector('.frm-credits-add')");
check('max 4: the add button goes at the limit', addGone === true, String(addGone));

console.log(results.join('\n'));
ws.close();

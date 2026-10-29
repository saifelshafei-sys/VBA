// Smoke test for the Second Home pilot. Run: node book/tests/smoke.js
const { chromium } = require('playwright');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pages = ['index.html', 'chapter-1.html', 'chapter-2.html'];
const sizes = [{ width: 375, height: 812 }, { width: 1280, height: 800 }];
let failures = 0;

function check(ok, msg) {
  if (!ok) { failures++; console.log('FAIL ' + msg); } else { console.log('ok   ' + msg); }
}

(async () => {
  const browser = await chromium.launch();
  for (const file of pages) {
    const url = 'file://' + path.join(root, file);
    for (const size of sizes) {
      const page = await browser.newPage({ viewport: size });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      // Images may be absent until the artwork is added; any other failed file is a real error.
      page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
      page.on('requestfailed', r => { if (!['image', 'font', 'stylesheet'].includes(r.resourceType()) || /style\.css$/.test(r.url())) errors.push('failed ' + r.url()); });
      const res = await page.goto(url).catch(e => { errors.push(e.message); return null; });
      check(res !== null, `${file} @${size.width} loads`);
      await page.waitForTimeout(300);
      check(errors.length === 0, `${file} @${size.width} no console errors ${errors.join(' | ')}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(overflow <= 0, `${file} @${size.width} no horizontal scroll (overflow ${overflow})`);
      await page.close();
    }

    const ctxReduced = await browser.newContext({ reducedMotion: 'reduce' });
    const pr = await ctxReduced.newPage();
    await pr.goto(url);
    await pr.waitForTimeout(300);
    const hidden = await pr.$$eval('[data-reveal]', els => els.filter(e => getComputedStyle(e).opacity !== '1').length);
    check(hidden === 0, `${file} reduced motion: all reveal elements visible (${hidden} hidden)`);
    await ctxReduced.close();

    const ctxNoJs = await browser.newContext({ javaScriptEnabled: false });
    const pn = await ctxNoJs.newPage();
    await pn.goto(url);
    await pn.waitForTimeout(2500); // cover intro fades in via CSS, which runs without JS
    const invisibleList = await pn.$$eval('p', els => els.filter(e => getComputedStyle(e).opacity === '0' || getComputedStyle(e).visibility === 'hidden').map(e => e.className || e.textContent.slice(0, 30)));
    const invisible = invisibleList.length + (invisibleList.length ? ' ' + invisibleList.join(', ') : '');
    check(invisibleList.length === 0, `${file} no JS: all paragraphs visible (${invisible} invisible)`);
    await ctxNoJs.close();
  }

  const p = await browser.newPage();
  await p.goto('file://' + path.join(root, 'index.html'));
  const href = await p.getAttribute('a.begin', 'href').catch(() => null);
  check(href === 'chapter-1.html', `cover link goes to chapter-1.html (got ${href})`);
  const alt = await p.getAttribute('.book img', 'alt').catch(() => '');
  const loaded = await p.$eval('.book img', i => i.naturalWidth).catch(() => 0);
  check(alt.includes('Dina Helmy') && loaded > 0, 'cover image loads and credits Dina Helmy');

  for (const ch of ['chapter-1.html', 'chapter-2.html']) {
    const c = await browser.newPage();
    await c.goto('file://' + path.join(root, ch));
    const words = await c.$$eval('article p', els => els.map(e => e.textContent).join(' ').split(/\s+/).filter(Boolean).length);
    check(words >= 1700, `${ch} length ~2,000 words (got ${words})`);
  }
  const c1 = await browser.newPage();
  await c1.goto('file://' + path.join(root, 'chapter-1.html'));
  check(await c1.$('a[href="chapter-2.html"]') !== null, 'chapter 1 links to chapter 2');

  await browser.close();
  console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();

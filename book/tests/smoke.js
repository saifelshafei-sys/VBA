// Smoke test for the Second Home pilot. Run: node book/tests/smoke.js
const { chromium } = require('playwright');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pages = ['index.html', 'chapter-1.html'];
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
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
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
    const invisible = await pn.$$eval('p', els => els.filter(e => getComputedStyle(e).opacity === '0' || getComputedStyle(e).visibility === 'hidden').length);
    check(invisible === 0, `${file} no JS: all paragraphs visible (${invisible} invisible)`);
    await ctxNoJs.close();
  }

  const p = await browser.newPage();
  await p.goto('file://' + path.join(root, 'index.html'));
  const href = await p.getAttribute('a.begin', 'href').catch(() => null);
  check(href === 'chapter-1.html', `cover link goes to chapter-1.html (got ${href})`);
  const credit = await p.textContent('body').catch(() => '');
  check(credit.includes('D.H.') && credit.includes('Written by Dina Helmy'), 'cover shows author credits');

  const c = await browser.newPage();
  await c.goto('file://' + path.join(root, 'chapter-1.html'));
  const words = await c.$$eval('article p', els => els.map(e => e.textContent).join(' ').split(/\s+/).filter(Boolean).length);
  check(words >= 1700, `chapter 1 length ~2,000 words (got ${words})`);

  await browser.close();
  console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();

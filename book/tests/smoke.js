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

  // Page-turning reader on an iPhone-sized screen
  for (const ch of ['index.html', 'chapter-1.html', 'chapter-2.html']) {
    const r = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await r.goto('file://' + path.join(root, ch));
    await r.waitForSelector('.page.current');
    const info = await r.evaluate(() => {
      const pages = [...document.querySelectorAll('.page')];
      const over = pages.filter(p => { p.style.display = 'block'; const i = p.firstChild; const o = i.scrollHeight > i.clientHeight + 1; p.style.display = ''; return o; }).length;
      return { n: pages.length, over };
    });
    check(info.n >= 2, `${ch} paged into ${info.n} pages`);
    check(info.over === 0, `${ch} no page overflows (${info.over} overflow)`);
    const before = await r.$$eval('.page', ps => ps.findIndex(p => p.classList.contains('current')));
    await r.keyboard.press('ArrowRight');
    await r.waitForTimeout(1600);
    const after = await r.$$eval('.page', ps => ps.findIndex(p => p.classList.contains('current')));
    check(after === before + 1, `${ch} arrow key turns the page (${before} -> ${after})`);
    await r.close();
  }
  // Turning by hand: drag past halfway turns, a short drag falls back, a tap does nothing
  const d = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await d.goto('file://' + path.join(root, 'chapter-1.html') + '#p2');
  await d.waitForSelector('.page.current');
  await d.waitForTimeout(500);
  await d.mouse.move(370, 120); await d.mouse.down(); await d.mouse.move(40, 260, { steps: 15 }); await d.mouse.up();
  await d.waitForTimeout(1000);
  check(await d.evaluate(() => location.hash) === '#p3', 'dragging the page across turns it');
  await d.mouse.move(370, 200); await d.mouse.down(); await d.mouse.move(320, 220, { steps: 30 }); await d.mouse.up();
  await d.waitForTimeout(1000);
  check(await d.evaluate(() => location.hash) === '#p3', 'a short drag lets the page fall back');
  await d.mouse.click(330, 400); await d.waitForTimeout(1000);
  check(await d.evaluate(() => location.hash) === '#p3', 'a tap does not turn the page');
  await d.close();

  const last = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await last.goto('file://' + path.join(root, 'chapter-1.html') + '#end');
  await last.waitForSelector('.page.current');
  await last.waitForTimeout(300);
  await Promise.all([last.waitForNavigation({ timeout: 5000 }).catch(() => null), last.keyboard.press('ArrowRight')]);
  check(/chapter-2\.html(#p1)?$/.test(last.url()), `last page of chapter 1 turns into chapter 2 (${last.url().split('/').pop()})`);

  await browser.close();
  console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();

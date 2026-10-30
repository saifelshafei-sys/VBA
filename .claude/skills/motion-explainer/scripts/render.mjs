// Render a time-driven HTML scene to MP4, frame by frame.
// Usage: node render.mjs <scene.html> <out.mp4> [--fps 30] [--from 0] [--to <seconds>] [--crf 18]
//
// The scene must define:
//   window.EXPLAINER = { duration: <seconds>, width: 1920, height: 1080 }
//   window.renderFrame = (t) => { ... }   // draw the frame at time t (seconds); may return a Promise
// Frames are captured by seeking, not by recording in real time, so output is
// deterministic and never drops frames regardless of machine speed.

import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// CommonJS require honors NODE_PATH and global installs; a bare ESM import does not.
let chromium;
try {
  ({ chromium } = createRequire(resolve(process.cwd(), 'noop.js'))('playwright'));
} catch {
  console.error('Playwright not found. Install it: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const args = process.argv.slice(2);
const positional = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const [scenePath, outPath] = positional;
if (!scenePath || !outPath) {
  console.error('Usage: node render.mjs <scene.html> <out.mp4> [--fps 30] [--from 0] [--to <s>] [--crf 18]');
  process.exit(2);
}

const fps = opt('fps', 30);
const crf = opt('crf', 18);

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
);
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(pathToFileURL(resolve(scenePath)).href);
  await page.evaluate(() => document.fonts && document.fonts.ready);

  const meta = await page.evaluate(() => ({
    ok: typeof window.renderFrame === 'function' && !!window.EXPLAINER,
    ...(window.EXPLAINER || {}),
  }));
  if (!meta.ok) throw new Error('Scene must define window.EXPLAINER and window.renderFrame(t).');
  if (pageErrors.length) throw new Error('Scene threw on load: ' + pageErrors.join(' | '));

  const width = meta.width || 1920;
  const height = meta.height || 1080;
  const from = opt('from', 0);
  const to = Math.min(opt('to', meta.duration), meta.duration);
  const frames = Math.round((to - from) * fps);
  await page.setViewportSize({ width, height });

  const ffmpeg = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', String(crf),
    '-preset', 'medium', '-movflags', '+faststart', outPath,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffmpegDone = new Promise((res, rej) =>
    ffmpeg.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))))
  );

  for (let i = 0; i < frames; i++) {
    const t = from + i / fps;
    await page.evaluate((time) => window.renderFrame(time), t);
    if (pageErrors.length) throw new Error(`Scene threw at t=${t.toFixed(2)}s: ${pageErrors.join(' | ')}`);
    const png = await page.screenshot({ type: 'png' });
    if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
    if (i % fps === 0) process.stdout.write(`\r${(t - from).toFixed(0)}s / ${(to - from).toFixed(0)}s`);
  }
  ffmpeg.stdin.end();
  await ffmpegDone;
  console.log(`\nWrote ${outPath}: ${frames} frames, ${width}x${height} @ ${fps}fps`);
} finally {
  await browser.close();
}

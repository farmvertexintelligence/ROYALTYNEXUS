#!/usr/bin/env node
/*
 * Renders the Royalty Nexus motion graphics from scene.html to video.
 *
 *   python3 -m http.server 8000            # from the repository root
 *   node tools/motion/render.js all        # or: morning | sunset | promo
 *
 * Needs Playwright (Chromium) and ffmpeg. Set FFMPEG=/path/to/ffmpeg if it is
 * not on PATH (`pip install imageio-ffmpeg` bundles one). Set BASE_URL if the
 * server is not on http://localhost:8000.
 */
const { chromium } = require('playwright');
const { spawn, spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = process.env.BASE_URL || 'http://localhost:8000';
const FF = process.env.FFMPEG || 'ffmpeg';

const JOBS = {
  morning: { w: 1280, h: 720, fps: 24, secs: 20, out: 'assets/video/forest-hero', loop: true },
  sunset: { w: 1280, h: 720, fps: 24, secs: 20, out: 'assets/video/forest-lake', loop: true },
  promo: { w: 1920, h: 1080, fps: 30, secs: 26, out: 'royalty-nexus-promo-1080p', loop: false }
};

function ff(args) {
  const r = spawnSync(FF, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + args.join(' '));
}

async function renderJob(browser, mode, job) {
  const page = await browser.newPage({ viewport: { width: job.w, height: job.h } });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(`${BASE}/tools/motion/scene.html?mode=${mode}&w=${job.w}&h=${job.h}`);
  await page.evaluate(() => window.ready);

  const master = path.join(ROOT, `${job.out}.master.mp4`);
  const enc = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(job.fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', master], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round(job.fps * job.secs);
  for (let i = 0; i < frames; i++) {
    await page.evaluate(t => window.render(t), i / job.fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r));
    if (i % 120 === 0) console.log(`${mode}: frame ${i}/${frames}`);
  }
  enc.stdin.end();
  await new Promise(r => enc.on('close', r));
  await page.close();

  const out = path.join(ROOT, job.out);
  if (job.loop) {
    // Light, silent background loops for the website
    ff(['-i', master, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${out}.mp4`]);
    ff(['-i', master, '-an', '-c:v', 'libvpx-vp9', '-crf', '37', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', `${out}.webm`]);
  } else {
    // Social-ready MP4 with a silent audio track (some apps reject video without audio)
    ff(['-i', master, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-shortest', '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', `${out}.mp4`]);
  }
  require('fs').unlinkSync(master);
  console.log(`${mode}: wrote ${job.out}${job.loop ? '.mp4 + .webm' : '.mp4'}`);
}

(async () => {
  const which = process.argv[2] || 'all';
  const modes = which === 'all' ? Object.keys(JOBS) : [which];
  const browser = await chromium.launch();
  for (const m of modes) {
    if (!JOBS[m]) throw new Error('Unknown mode ' + m);
    await renderJob(browser, m, JOBS[m]);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

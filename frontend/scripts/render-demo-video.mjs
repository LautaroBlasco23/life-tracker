#!/usr/bin/env node
// Render the newest demo recording into demo/output/demo.mp4 (+ poster).
//
// Playwright finalizes the .webm only when the context closes, so this must
// run after `npm run demo:video:capture` (npm run demo:video does both).
//
// Usage: node scripts/render-demo-video.mjs
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Walk a directory tree and return all file paths. */
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const FRONTEND_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const RECORDINGS_DIR = path.join(FRONTEND_DIR, 'demo', 'recordings');
const OUTPUT_DIR = path.join(FRONTEND_DIR, 'demo', 'output');

function fail(message) {
  console.error(`render-demo-video: ${message}`);
  process.exit(1);
}

function ensureFFmpeg() {
  const probe = spawnSync('ffmpeg', ['-version']);
  if (probe.error || probe.status !== 0) {
    fail('ffmpeg not found on PATH. Install it (e.g. apt install ffmpeg).');
  }
}

function newestRecording() {
  if (!existsSync(RECORDINGS_DIR)) {
    fail(
      `no recordings dir at ${RECORDINGS_DIR} — run demo:video:capture first.`
    );
  }
  const files = walk(RECORDINGS_DIR)
    .filter((f) => f.endsWith('.webm'))
    .map((full) => ({ full, mtime: statSync(full).mtimeMs }));
  if (!files.length) {
    fail('no .webm recordings found — run demo:video:capture first.');
  }
  files.sort((a, b) => b.mtime - a.mtime);
  return files[0].full;
}

function run(args, label) {
  const result = spawnSync('ffmpeg', args, {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (result.status !== 0)
    fail(`${label} failed (ffmpeg exit ${result.status})`);
}

// Not every distro ffmpeg ships libx264; both libx264 and libopenh264
// produce standard H.264 that plays everywhere.
function pickH264Encoder() {
  const list =
    spawnSync('ffmpeg', ['-hide_banner', '-encoders'], {
      encoding: 'utf8',
    }).stdout || '';
  if (/\blibx264\b/.test(list)) return 'libx264';
  if (/\blibopenh264\b/.test(list)) return 'libopenh264';
  return null;
}

function videoArgs(encoder) {
  return encoder === 'libopenh264'
    ? ['-c:v', 'libopenh264', '-b:v', '4M', '-pix_fmt', 'yuv420p']
    : [
        '-c:v',
        encoder,
        '-crf',
        '22',
        '-preset',
        'medium',
        '-pix_fmt',
        'yuv420p',
      ];
}

const src = newestRecording();
mkdirSync(OUTPUT_DIR, { recursive: true });

const mp4 = path.join(OUTPUT_DIR, 'demo.mp4');
const poster = path.join(OUTPUT_DIR, 'demo-poster.jpg');

const encoder = pickH264Encoder();
if (!encoder) {
  fail('no H.264 encoder available (need libx264 or libopenh264).');
}

console.log(
  `render-demo-video: encoding ${path.relative(FRONTEND_DIR, src)} (${encoder})`
);
run(
  [
    '-y',
    '-i',
    src,
    // Web-optimised H.264: playable everywhere, moov atom first for streaming.
    ...videoArgs(encoder),
    '-movflags',
    '+faststart',
    mp4,
  ],
  'encode'
);

run(['-y', '-i', mp4, '-frames:v', '1', '-q:v', '2', poster], 'poster');

const sizeMb = (statSync(mp4).size / (1024 * 1024)).toFixed(2);
console.log(`render-demo-video: ${mp4} (${sizeMb} MB)`);
console.log(`render-demo-video: ${poster}`);

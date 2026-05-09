// Demo recorder for Dear Mom — Twitter-ready cut.
//
// Rules of this cut:
//  • No camera zooming anywhere. Every shot is full-frame so the prompt,
//    the textarea, and the jar are all visible together. Zooming was
//    cropping context (the prompt header would slip off-screen) and
//    feeling random, so we do without it entirely.
//  • Typing is paced like a real human writing something thoughtful, with
//    a hold after the last character so the viewer can read what was
//    written before we move on.
//  • Animations (paper folding into the jar, the seal cinematic, the lid
//    popping, each note unfolding) get their full duration plus a beat of
//    silence afterward so they land emotionally.
//
//   node scripts/demo.mjs                 # records prod URL
//   node scripts/demo.mjs http://localhost:3000

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { renameSync, readdirSync, unlinkSync, statSync } from "node:fs";
import path from "node:path";

const URL = process.argv[2] || "https://dear-mom-nu.vercel.app";
const OUT = path.resolve("demo");
const VIEW = { width: 1280, height: 720 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Realistic typing — 90ms/char with a tiny pause after punctuation so it
// reads as someone actually thinking about what they're writing.
async function humanType(locator, text, baseDelay = 90) {
  await locator.click();
  await locator.fill("");
  for (const ch of text) {
    await locator.pressSequentially(ch, { delay: baseDelay });
    if (ch === "," || ch === ".") await sleep(220);
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: VIEW },
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  console.log(`→ recording ${URL}`);
  await page.goto(URL, { waitUntil: "networkidle" });

  // Hold on the intro for a beat so the viewer reads "Dear Mom, a jar of
  // memories…" before we click anything.
  await sleep(2200);
  await page.getByRole("button", { name: /get started/i }).click();
  await sleep(1100);

  // ---------- NAME ----------
  const nameInput = page.locator('input[placeholder*="Mom"]').first();
  await humanType(nameInput, "Mom", 110);
  await sleep(1300);
  await page.getByRole("button", { name: /^next/i }).click();
  await sleep(1100);

  // ---------- FROM ----------
  const fromInput = page.locator('input[placeholder*="your name"]').first();
  await humanType(fromInput, "Aayan", 105);
  await sleep(1300);
  await page.getByRole("button", { name: /^next|^skip/i }).click();
  await sleep(1100);

  // ---------- SCENT ----------
  // Hover-in, deliberate tap, let the background colour transition play.
  await sleep(700);
  await page.getByRole("button", { name: /^lavender$/i }).click();
  await sleep(1500);
  await page.getByRole("button", { name: /^next/i }).click();
  await sleep(1100);

  // ---------- RIBBON ----------
  await sleep(700);
  await page.getByRole("button", { name: /blush/i }).click();
  await sleep(1300);
  await page.getByRole("button", { name: /start writing/i }).click();
  await sleep(1300);

  // ---------- MEMORY LOOP ----------
  const memories = [
    "the way you hum while making chai in the morning.",
    "you taught me to take care of myself, without saying it.",
    "the laugh you let out when you're not trying to be polite.",
  ];

  for (const m of memories) {
    // Let the new prompt settle into view before typing.
    await sleep(900);
    const ta = page.locator("textarea");
    await humanType(ta, m, 75);
    // Let the viewer finish reading what was written.
    await sleep(1500);
    await page.getByRole("button", { name: /fold.*drop/i }).click();
    // Folding paper → arc into jar → jar wobble. Plus a beat of stillness.
    await sleep(2200);
  }

  // ---------- SEAL ----------
  await sleep(700);
  await page.getByRole("button", { name: /ready to seal/i }).click();
  await sleep(1300);
  await page.getByRole("button", { name: /seal the jar/i }).click();

  // Watch the full seal cinematic at 1× (lid descends, thud, sparkles,
  // "sealed with love" text). Then wait for navigation to /jar/[id].
  await page.waitForURL(/\/jar\//, { timeout: 12000 });
  await sleep(2200);

  // ---------- JAR VIEWER ----------
  // Soak in the "For Mom" cover before tapping.
  await sleep(1600);
  await page.getByRole("button", { name: /untie the ribbon/i }).click();
  // Lid pop, sparkle burst, notes orbit in.
  await sleep(3200);

  // Open each note in turn.
  for (let safety = 0; safety < 6; safety++) {
    const remaining = page.locator('button[aria-label^="Open note"]');
    if ((await remaining.count()) === 0) break;
    await remaining.first().click();
    // Modal springs in (~0.6s) and trifold unfolds (~1.2s w/ stagger).
    await sleep(1900);
    // Hold on the open letter so the prompt + handwritten line are read.
    await sleep(1600);
    await page.getByRole("button", { name: /fold back up/i }).click();
    // Refold (~1.1s) + dismiss.
    await sleep(1500);
  }

  // ---------- FINAL MESSAGE ----------
  // "I love you, Mom" — let it breathe.
  await sleep(3200);

  // ---------- RESEAL ----------
  // Showcase the reverse animation: the final-message overlay fades out,
  // the lid physically descends back onto the jar, and the jar settles.
  const resealBtn = page.getByRole("button", { name: /seal it back/i });
  if (await resealBtn.count()) {
    await resealBtn.click();
    // 0.7s overlay fade + 0.9s lid descent + wobble settle.
    await sleep(2800);
  }
  // Hold on the resealed jar for a beat before the curtain drops.
  await sleep(1400);

  await context.close();
  await browser.close();

  // Keep the largest webm produced; rename, drop the rest.
  const files = readdirSync(OUT).filter((f) => f.endsWith(".webm"));
  if (!files.length) {
    console.log("⚠ no webm produced");
    return;
  }
  let best = files[0];
  let bestSize = 0;
  for (const f of files) {
    const stat = statSync(path.join(OUT, f));
    if (stat.size > bestSize) {
      bestSize = stat.size;
      best = f;
    }
  }
  for (const f of files) if (f !== best) unlinkSync(path.join(OUT, f));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(OUT, `dear-mom-demo-${stamp}.webm`);
  renameSync(path.join(OUT, best), target);
  console.log(`✓ saved ${target}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

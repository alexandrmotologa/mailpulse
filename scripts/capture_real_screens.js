const puppeteer = require('puppeteer');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 400) resolve(true);
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => req.destroy());
      });
      return true;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Server at ${url} did not respond within ${timeoutMs}ms`);
}

async function run() {
  const rootDir = path.resolve(__dirname, '..');
  const exePath = path.resolve(rootDir, 'mailpulse.exe');
  const imgDir = path.resolve(rootDir, 'docs', 'images');
  const framesDir = path.resolve(rootDir, 'docs', 'frames');

  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
  if (fs.existsSync(framesDir)) {
    fs.rmSync(framesDir, { recursive: true, force: true });
  }
  fs.mkdirSync(framesDir, { recursive: true });

  console.log('[1/5] Starting MailPulse daemon on ports 12025 / 19025 ...');
  const proc = spawn(exePath, [
    '--smtp-port', '12025',
    '--web-port', '19025',
    '--no-open',
    '--seed',
  ], { stdio: 'inherit', cwd: rootDir });

  const cleanup = () => {
    try { proc.kill(); } catch (e) {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const url = 'http://127.0.0.1:19025';
  await waitForServer(url, 10000);
  console.log('MailPulse daemon is ready.');

  console.log('[2/5] Launching Google Chrome via Puppeteer ...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    defaultViewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
    },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  console.log(`Navigating to ${url} ...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1500);

  // Select the OTP verification email card (usually index 1)
  console.log('Selecting OTP email card ...');
  const emailCards = await page.$$('div.cursor-pointer');
  if (emailCards.length > 1) {
    await emailCards[1].click();
    await sleep(800);
  } else if (emailCards.length > 0) {
    await emailCards[0].click();
    await sleep(800);
  }

  // Capture Screenshot 1: Desktop View & OTP Extractor
  console.log('[3/5] Capturing high-res screenshot 1: Desktop View & OTP ...');
  await page.screenshot({ path: path.join(imgDir, 'mailpulse-1.png') });

  // Switch to Spam Audit tab
  console.log('[3/5] Capturing screenshot 2: Spam & Deliverability Audit ...');
  const spamTabBtn = await page.$('button[title*="Deliverability"]');
  if (spamTabBtn) {
    await spamTabBtn.click();
    await sleep(700);
  }
  await page.screenshot({ path: path.join(imgDir, 'mailpulse-2.png') });

  // Switch back to Preview and activate Dual View
  console.log('[3/5] Capturing screenshot 3: Synchronized Dual View ...');
  const previewTabBtn = await page.$('button[title*="Sandbox Preview"]');
  if (previewTabBtn) {
    await previewTabBtn.click();
    await sleep(500);
  }
  const dualViewBtn = await page.$('button[title*="Dual View"]');
  if (dualViewBtn) {
    await dualViewBtn.click();
    await sleep(900);
  }
  await page.screenshot({ path: path.join(imgDir, 'mailpulse-3.png') });

  // Open E2E Code Recipe Modal
  console.log('[3/5] Capturing screenshot 4: E2E Test Automation Recipes ...');
  const e2eBtn = await page.$('button[title*="automated test recipes"]');
  if (e2eBtn) {
    await e2eBtn.click();
    await sleep(700);
  }
  await page.screenshot({ path: path.join(imgDir, 'mailpulse-4.png') });

  // Close modal
  await page.keyboard.press('Escape');
  await sleep(400);

  // Capture Screenshot 5: Mobile Responsive Layout
  console.log('[3/5] Capturing high-res screenshot 5: Mobile Responsive Layout ...');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1000);
  // Select first card in mobile view
  const mobileCards = await page.$$('div.cursor-pointer');
  if (mobileCards.length > 0) {
    await mobileCards[0].click();
    await sleep(800);
  }
  await page.screenshot({ path: path.join(imgDir, 'mailpulse-mobile.png') });

  // Reset to 960x600 for Demo GIF Recording
  console.log('[4/5] Recording frames for animated demo GIF (960x600) ...');
  await page.setViewport({ width: 960, height: 600, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1200);

  const cardsSmall = await page.$$('div.cursor-pointer');
  if (cardsSmall.length > 1) {
    await cardsSmall[1].click();
    await sleep(700);
  } else if (cardsSmall.length > 0) {
    await cardsSmall[0].click();
    await sleep(700);
  }

  let frameIdx = 0;
  const snap = async () => {
    const framePath = path.join(framesDir, `frame_${String(frameIdx).padStart(3, '0')}.png`);
    await page.screenshot({ path: framePath });
    frameIdx++;
  };

  // Scene 1: Desktop View with OTP banner (6 frames)
  for (let i = 0; i < 6; i++) {
    await snap();
    await sleep(150);
  }

  // Scene 2: Switch to Dual View (8 frames)
  const dualBtn = await page.$('button[title*="Dual View"]');
  if (dualBtn) {
    await dualBtn.click();
    await sleep(350);
  }
  for (let i = 0; i < 8; i++) {
    await snap();
    await sleep(150);
  }

  // Scene 3: Switch to Spam tab (7 frames)
  const spamTab = await page.$('button[title*="Deliverability"]');
  if (spamTab) {
    await spamTab.click();
    await sleep(350);
  }
  for (let i = 0; i < 7; i++) {
    await snap();
    await sleep(150);
  }

  // Scene 4: Open E2E Recipes Modal (8 frames)
  const e2eCodeBtn = await page.$('button[title*="automated test recipes"]');
  if (e2eCodeBtn) {
    await e2eCodeBtn.click();
    await sleep(350);
  }
  for (let i = 0; i < 8; i++) {
    await snap();
    await sleep(150);
  }

  // Close modal
  await page.keyboard.press('Escape');
  await sleep(300);

  // Scene 5: Open Chaos Modal (8 frames)
  const chaosBtn = await page.$('button[title*="Chaos"]');
  if (chaosBtn) {
    await chaosBtn.click();
    await sleep(350);
  }
  for (let i = 0; i < 8; i++) {
    await snap();
    await sleep(150);
  }

  // Close chaos modal
  await page.keyboard.press('Escape');
  await sleep(300);

  await browser.close();
  cleanup();

  console.log(`Captured ${frameIdx} frames.`);
  console.log('[5/5] Compiling animated GIF using FFmpeg ...');

  const gifOut = path.join(imgDir, 'mailpulse_demo.gif');
  const ffmpegCmd = `ffmpeg -y -framerate 4 -i "${path.join(framesDir, 'frame_%03d.png')}" -vf "fps=5,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "${gifOut}"`;

  try {
    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log(`Successfully generated demo GIF at ${gifOut}`);
  } catch (err) {
    console.error('FFmpeg compilation failed:', err);
  }

  console.log('All screenshots and animated demo GIF successfully updated!');
}

run().catch((err) => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});

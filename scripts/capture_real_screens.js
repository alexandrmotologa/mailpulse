const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const exePath = path.resolve(__dirname, '..', 'mailpulse.exe');
  const imgDir = path.resolve(__dirname, '..', 'docs', 'images');
  const framesDir = path.resolve(__dirname, '..', 'docs', 'frames');

  if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

  console.log('[1/4] Starting MailPulse daemon on ports 12025 / 19025 ...');
  const proc = spawn(exePath, [
    '--smtp-port', '12025',
    '--web-port', '19025',
    '--no-open',
    '--seed',
  ], { stdio: 'inherit' });

  const cleanup = () => {
    try { proc.kill(); } catch (e) {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  await sleep(1500);

  console.log('[2/4] Launching Google Chrome via Puppeteer ...');
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
  const url = 'http://127.0.0.1:19025';

  console.log(`Navigating to ${url} ...`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1200);

  // Select the OTP verification email card (press 'j' or click)
  console.log('Selecting first email card ...');
  const emailCards = await page.$$('div.cursor-pointer');
  if (emailCards.length > 0) {
    // Click on the second card if available (OTP verification) or first
    const targetCard = emailCards.length > 1 ? emailCards[1] : emailCards[0];
    await targetCard.click();
    await sleep(800);
  } else {
    await page.keyboard.press('j');
    await sleep(800);
  }

  // Capture Screenshot 1: Desktop Sandbox with OTP Extractor & Header Controls
  console.log('[3/4] Capturing high-res screenshot 1: Desktop View & OTP ...');
  await page.screenshot({ path: path.join(imgDir, 'mailpulse-1.png') });

  // Switch to Spam Audit tab
  console.log('[3/4] Capturing screenshot 2: Spam & Deliverability Audit ...');
  const spamTabBtn = await page.$('button[title*="Deliverability"]');
  if (spamTabBtn) {
    await spamTabBtn.click();
    await sleep(600);
  }
  await page.screenshot({ path: path.join(imgDir, 'mailpulse-2.png') });

  // Switch back to Preview and activate Dual View
  console.log('[3/4] Capturing screenshot 3: Dual View with Sync Scrolling ...');
  const previewTabBtn = await page.$('button[title*="Sandbox Preview"]');
  if (previewTabBtn) {
    await previewTabBtn.click();
    await sleep(400);
  }
  const dualViewBtn = await page.$('button[title*="Dual View"]');
  if (dualViewBtn) {
    await dualViewBtn.click();
    await sleep(800);
  }
  await page.screenshot({ path: path.join(imgDir, 'mailpulse-3.png') });

  // Open E2E Code Recipe Modal
  console.log('[3/4] Capturing screenshot 4: E2E Test Automation Recipes ...');
  const e2eBtn = await page.$('button[title*="automated test recipes"]');
  if (e2eBtn) {
    await e2eBtn.click();
    await sleep(600);
  }
  await page.screenshot({ path: path.join(imgDir, 'mailpulse-4.png') });

  // Close modal
  await page.keyboard.press('Escape');
  await sleep(400);

  // Prepare frames for Demo GIF
  console.log('[4/4] Recording frames for animated demo GIF (960x600) ...');
  await page.setViewport({ width: 960, height: 600, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(1000);

  // Select email in 960x600 view
  const cardsSmall = await page.$$('div.cursor-pointer');
  if (cardsSmall.length > 1) {
    await cardsSmall[1].click();
    await sleep(600);
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
    await sleep(300);
  }
  for (let i = 0; i < 8; i++) {
    await snap();
    await sleep(150);
  }

  // Scene 3: Switch to Spam tab (7 frames)
  const spamTab = await page.$('button[title*="Deliverability"]');
  if (spamTab) {
    await spamTab.click();
    await sleep(300);
  }
  for (let i = 0; i < 7; i++) {
    await snap();
    await sleep(150);
  }

  // Scene 4: Open E2E Recipes Modal (8 frames)
  const e2eCodeBtn = await page.$('button[title*="automated test recipes"]');
  if (e2eCodeBtn) {
    await e2eCodeBtn.click();
    await sleep(300);
  }
  for (let i = 0; i < 8; i++) {
    await snap();
    await sleep(150);
  }

  // Close modal
  await page.keyboard.press('Escape');
  await sleep(250);

  // Scene 5: Open Chaos Modal (8 frames)
  const chaosBtn = await page.$('button[title*="Chaos"]');
  if (chaosBtn) {
    await chaosBtn.click();
    await sleep(300);
  }
  for (let i = 0; i < 8; i++) {
    await snap();
    await sleep(150);
  }

  await browser.close();
  cleanup();
  console.log(`Captured ${frameIdx} frames. Ready for FFmpeg encoding.`);
}

run().catch((err) => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});

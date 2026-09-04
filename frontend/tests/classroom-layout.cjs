// Layout-only regression check. No LMS login, student records, or video calls.
// Run with Playwright available on NODE_PATH: node tests/classroom-layout.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const css = fs.readFileSync(path.join(__dirname, '../src/styles/dashboard.css'), 'utf8');
    for (const [width, height] of [[1920, 1080], [1366, 768], [390, 844], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await page.setContent(`<style>${css}</style>
        <div class="classroom-page">
          <header class="classroom-topbar">Classroom layout test</header>
          <main class="classroom-layout">
            <div class="classroom-shell"><div class="classroom-frame"><iframe title="Layout test"></iframe></div></div>
          </main>
        </div>`);
      const measure = () => page.evaluate(() => {
        const box = (selector) => {
          const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
          return { x, y, width, height };
        };
        return {
          shell: box('.classroom-shell'), frame: box('.classroom-frame'), iframe: box('iframe'),
          viewport: { width: innerWidth, height: innerHeight },
          overflow: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth,
        };
      });
      let sizes = await measure();
      assert.deepEqual(sizes.frame, sizes.shell, 'Frame must fill the normal classroom');
      assert.deepEqual(sizes.iframe, sizes.shell, 'Iframe must fill the normal classroom');
      assert.equal(sizes.overflow, false, 'Normal classroom must not scroll');
      await page.evaluate(async () => document.querySelector('.classroom-shell').requestFullscreen());
      await page.waitForFunction(() => !!document.fullscreenElement);
      sizes = await measure();
      assert.deepEqual(sizes.frame, sizes.shell, 'Fullscreen frame must fill the shell');
      assert.deepEqual(sizes.iframe, sizes.shell, 'Fullscreen iframe must fill the shell');
      assert.deepEqual(sizes.shell, { x: 0, y: 0, ...sizes.viewport }, 'Fullscreen must fill the viewport');
      await page.evaluate(() => document.exitFullscreen());
      await page.waitForFunction(() => !document.fullscreenElement);
      sizes = await measure();
      assert.equal(sizes.overflow, false, 'Exiting fullscreen must restore a non-scrolling layout');
      console.log(`PASS ${width}x${height}: normal, fullscreen, and exit`);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });

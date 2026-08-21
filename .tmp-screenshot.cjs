const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('pageerror: ' + err.message));

  await page.goto('http://localhost:5173/Family-Hub/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // let mock fetch (150ms delay) + render settle
  await page.screenshot({ path: 'C:/Users/jlynn/AppData/Local/Temp/pw-glance.png', fullPage: false });

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
  await browser.close();
})();

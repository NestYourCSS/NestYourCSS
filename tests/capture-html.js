import { chromium } from 'playwright';

async function captureHTML(url, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);

    // Open settings
    await page.evaluate(() => {
      const btn = document.getElementById('settings-toggle') || document.getElementById('settingsBtn');
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);

    // Capture settings panel inner HTML
    const html = await page.evaluate(() => {
      const p = document.getElementById('mainSettings');
      if (!p) return 'NOT FOUND';
      // Pretty-print the inner HTML
      return p.innerHTML;
    });

    console.log(`\n========== ${label} SETTINGS HTML ==========`);
    console.log(html);
    console.log(`========== END ${label} SETTINGS HTML ==========`);

    // Also capture full page HTML for structure comparison
    const bodyHTML = await page.evaluate(() => document.body.innerHTML.substring(0, 50000));
    console.log(`\n========== ${label} BODY HTML (first 50k chars) ==========`);
    console.log(bodyHTML);
    console.log(`========== END ${label} BODY HTML ==========`);

    await page.screenshot({ path: `tests/prod-${label}-settings.png`, fullPage: false });
    await browser.close();
  } catch (err) {
    console.error(`${label} failed:`, err.message);
    await page.screenshot({ path: `tests/prod-${label}-error.png`, fullPage: false });
    await browser.close();
  }
}

async function main() {
  await captureHTML('https://nestyourcss.com/', 'nestyourcss');
  await captureHTML('https://quickly.nestyourcss.com/', 'quickly');
}

main().catch(console.error);

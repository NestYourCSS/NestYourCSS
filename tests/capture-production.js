import { chromium } from 'playwright';

async function captureSite(url, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const result = { url, label, errors: [] };

  page.on('console', msg => {
    if (msg.type() === 'error') result.errors.push(`[CONSOLE] ${msg.text()}`);
  });
  page.on('pageerror', err => result.errors.push(`[PAGE_ERROR] ${err.message}`));

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Page structure
    result.title = await page.title();
    result.settingsToggleExists = await page.evaluate(() => !!document.getElementById('settings-toggle') || !!document.getElementById('settingsBtn'));
    result.nestingToggleExists = await page.evaluate(() => !!document.getElementById('nestingToggleBtn'));

    // Check if settings panel opens
    if (result.settingsToggleExists) {
      const sel = await page.evaluate(() => {
        const btn = document.getElementById('settings-toggle') || document.getElementById('settingsBtn');
        if (!btn) return null;
        btn.click();
        return btn.id;
      });
      await page.waitForTimeout(500);
      result.settingsVisible = await page.evaluate(() => {
        const p = document.getElementById('mainSettings');
        if (!p) return false;
        return !p.classList.contains('hidden') && window.getComputedStyle(p).display !== 'none';
      });
      result.settingsHtml = await page.evaluate(() => {
        const p = document.getElementById('mainSettings');
        return p ? p.innerHTML.substring(0, 5000) : 'NOT FOUND';
      });
    }

    // Count custom elements
    result.customElements = await page.evaluate(() => {
      const tags = ['nycss-dropdown', 'nycss-toggle', 'nycss-checkbox', 'nycss-radio-group', 'nycss-stepper', 'nycss-combobox'];
      const counts = {};
      for (const t of tags) counts[t] = document.querySelectorAll(t).length;
      return counts;
    });

    // Check store
    result.storeExists = await page.evaluate(() => {
      return !!(window.__store || window.store);
    });

    // Screenshot full page
    await page.screenshot({ path: `tests/prod-${label.replace(/[^a-z0-9]/gi, '-')}.png`, fullPage: true });

    await page.close();
    await browser.close();
    return result;
  } catch (err) {
    result.error = err.message;
    await page.screenshot({ path: `tests/prod-${label.replace(/[^a-z0-9]/gi, '-')}-error.png`, fullPage: true });
    await page.close();
    await browser.close();
    return result;
  }
}

async function main() {
  const sites = [
    { url: 'https://nestyourcss.com/', label: 'nestyourcss' },
    { url: 'https://quickly.nestyourcss.com/', label: 'quickly' },
  ];

  for (const site of sites) {
    console.log(`\n=== Capturing ${site.label} (${site.url}) ===`);
    const result = await captureSite(site.url, site.label);
    console.log(`Title: ${result.title}`);
    console.log(`Settings toggle: ${result.settingsToggleExists ? 'found' : 'not found'}`);
    console.log(`Settings visible after click: ${result.settingsVisible}`);
    console.log(`Store: ${result.storeExists ? 'found' : 'not found'}`);
    console.log(`Custom elements:`, JSON.stringify(result.customElements));
    if (result.errors.length) {
      console.log(`Errors (${result.errors.length}):`);
      for (const e of result.errors.slice(0, 5)) console.log(`  ${e}`);
    }
    if (result.error) console.log(`FAILED: ${result.error}`);
  }
}

main().catch(console.error);

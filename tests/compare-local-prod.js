import { chromium } from 'playwright';

async function compare(url, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', msg => { if (msg.type() === 'error') console.log(`[${label}] ${msg.text()}`); });

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000);

    // For main site, enter nesting mode first
    if (label === 'local-main' || label === 'prod-main') {
      await page.evaluate(() => document.getElementById('nestingToggleBtn')?.click());
      await page.waitForTimeout(1000);
    }

    // Open settings
    await page.evaluate(() => {
      const btn = document.getElementById('settings-toggle') || document.getElementById('settingsBtn');
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);

    // Capture settings panel rendered HTML
    const settingsHTML = await page.evaluate(() => {
      const p = document.getElementById('mainSettings');
      if (!p) return '<NOT FOUND>';
      // Serialize with child structure
      function serialize(el, depth = 0) {
        if (depth > 5) return '';
        let s = '';
        const tag = el.tagName?.toLowerCase() || '';
        const id = el.id ? ` id="${el.id}"` : '';
        const cls = el.className?.baseVal || el.className || '';
        const clsStr = cls ? ` class="${cls}"` : '';
        const role = el.getAttribute?.('role') ? ` role="${el.getAttribute('role')}"` : '';
        const val = el.getAttribute?.('value') ? ` value="${el.getAttribute('value')}"` : '';
        const checked = el.hasAttribute?.('checked') ? ' checked' : '';
        const sel = el.getAttribute?.('aria-selected') ? ` aria-selected="${el.getAttribute('aria-selected')}"` : '';
        if (tag === 'script' || tag === 'style') return '';
        const children = el.children?.length ? Array.from(el.children).map(c => serialize(c, depth + 1)).join('') : '';
        const text = el.childNodes?.length === 1 && el.firstChild?.nodeType === 3 ? el.textContent.trim() : '';
        const open = `<${tag}${id}${clsStr}${role}${val}${checked}${sel}>`;
        const close = `</${tag}>`;
        if (children) return `${open}\n${children}\n${close}`;
        if (text) return `${open}${text}${close}`;
        return open;
      }
      return serialize(p);
    });

    console.log(`\n========== ${label.toUpperCase()} SETTINGS RENDERED HTML ==========`);
    console.log(settingsHTML.substring(0, 10000));
    console.log(`...`);

    await page.screenshot({ path: `tests/${label}-settings.png`, fullPage: false });
    console.log(`Screenshot: tests/${label}-settings.png`);

    await browser.close();
  } catch (err) {
    console.error(`${label} failed:`, err.message);
    await browser.close();
  }
}

async function main() {
  // Production
  await compare('https://nestyourcss.com/', 'prod-main');
  await compare('https://quickly.nestyourcss.com/', 'prod-quickly');

  // Local
  await compare('http://localhost:3000/', 'local-main');
  await compare('http://localhost:3001/', 'local-quickly');
}

main().catch(console.error);

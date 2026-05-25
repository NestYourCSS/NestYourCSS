import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const logs = [];
  page.on('console', msg => {
    logs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    logs.push(`[PAGE_ERROR] ${err.message}`);
  });

  let failures = 0;

  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Open settings
    await page.evaluate(() => {
      const btn = document.getElementById('settingsBtn');
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);

    async function check(description, pass, detail = '') {
      if (pass) {
        console.log(`  ✓ ${description}`);
      } else {
        console.log(`  ✗ ${description}${detail ? ' — ' + detail : ''}`);
        failures++;
      }
    }

    // ============================================================
    // TEST 1: Indentation toggle uses correct editor indent logic
    // ============================================================
    console.log('\n--- Test 1: Indentation Type ---');
    const indentResult = await page.evaluate(() => {
      const cb = document.getElementById('indentationType');
      if (!cb) return { error: 'toggle not found' };
      const innerInput = cb.querySelector('input[type="checkbox"]');
      if (!innerInput) return { error: 'inner input not found' };
      const store = window.__store;
      const engine = window.configureEngine;

      // Read initial: Hard (checked=true, store=true)
      const initial = {
        checked: cb.checked,
        storeVal: store.indentationType,
        editorIndentChar: window.editorIndentChar,
      };

      // Click to switch to Soft
      innerInput.click();
      const soft = {
        checked: cb.checked,
        storeVal: store.indentationType,
        editorIndentChar: window.editorIndentChar,
      };

      // Click back to Hard
      innerInput.click();
      const hard = {
        checked: cb.checked,
        storeVal: store.indentationType,
        editorIndentChar: window.editorIndentChar,
      };

      return { initial, soft, hard };
    });
    console.log('  Indentation:', JSON.stringify(indentResult));
    if (!indentResult.error) {
      // Hard should mean tabs: indentChar === '\t'
      await check('Initial Hard uses tabs', indentResult.initial.editorIndentChar === '\t',
        `got "${indentResult.initial.editorIndentChar}"`);
      // Soft should mean spaces
      await check('Soft uses spaces', indentResult.soft.editorIndentChar === '    ',
        `got "${indentResult.soft.editorIndentChar}"`);
      // Toggling back to Hard uses tabs again
      await check('Toggled Hard uses tabs', indentResult.hard.editorIndentChar === '\t',
        `got "${indentResult.hard.editorIndentChar}"`);
    }

    // ============================================================
    // TEST 2: Comments toggle updates engine config
    // ============================================================
    console.log('\n--- Test 2: Comments/PreserveComments ---');
    const commentResult = await page.evaluate(() => {
      const cb = document.getElementById('preserveComments');
      if (!cb) return { error: 'toggle not found' };
      const innerInput = cb.querySelector('input[type="checkbox"]');
      if (!innerInput) return { error: 'inner input not found', context: 'preserveComments' };
      const store = window.__store;

      // Default: unchecked, showing "Yes" (value=false -> preserve=true)
      const initial = {
        checked: cb.checked,
        storeVal: store.preserveComments,
        windowVal: window.preserveComments,
      };

      // Click to "No" (checked, value=true -> preserve=false)
      innerInput.click();
      const checked = {
        checked: cb.checked,
        storeVal: store.preserveComments,
        windowVal: window.preserveComments,
      };

      // Click back to "Yes" (unchecked, value=false -> preserve=true)
      innerInput.click();
      const unchecked = {
        checked: cb.checked,
        storeVal: store.preserveComments,
        windowVal: window.preserveComments,
      };

      return { initial, checked, unchecked };
    });
    console.log('  Comments:', JSON.stringify(commentResult));
    if (!commentResult.error) {
      await check('Initial shows Yes (unchecked)', !commentResult.initial.checked);
      await check('Initial preserveComments=true', commentResult.initial.windowVal === true,
        `got ${commentResult.initial.windowVal}`);
      await check('Toggled to No (checked)', commentResult.checked.checked === true);
      await check('No means preserveComments=false', commentResult.checked.windowVal === false,
        `got ${commentResult.checked.windowVal}`);
      await check('Toggled back to Yes', commentResult.unchecked.checked === false);
      await check('Back to preserveComments=true', commentResult.unchecked.windowVal === true,
        `got ${commentResult.unchecked.windowVal}`);
    }

    // ============================================================
    // TEST 3: Mode + Auto interaction
    // ============================================================
    console.log('\n--- Test 3: Mode + Auto ---');
    const modeResult = await page.evaluate(() => {
      const store = window.__store;
      const initial = {
        processMode: window.processMode,
        processAuto: window.processAuto,
        storeMode: store.mode,
        storeAuto: store.auto,
      };

      // Change mode from Nest(3) to Minify(0)
      const modeGroup = document.getElementById('mode');
      if (!modeGroup) return { error: 'mode radio-group not found' };
      const minifyLabel = modeGroup.querySelector('label');
      if (!minifyLabel) return { error: 'minify label not found', context: 'mode' };
      minifyLabel.click();

      const afterModeChange = {
        processMode: window.processMode,
        storeMode: store.mode,
      };

      return { initial, afterModeChange };
    });
    console.log('  Mode:', JSON.stringify(modeResult));
    if (!modeResult.error) {
      await check('Mode changed from Nest(3) to Minify(0)',
        modeResult.afterModeChange.processMode === 0,
        `got ${modeResult.afterModeChange.processMode}`);
    }

    // ============================================================
    // TEST 4: Stepper via mousedown (not click)
    // ============================================================
    console.log('\n--- Test 4: Stepper ---');
    const stResult = await page.evaluate(() => {
      const st = document.getElementById('indentationSize');
      if (!st) return { error: 'stepper not found' };
      const before = st.value;
      const storeBefore = window.__store.indentationSize;
      const upBtn = st.querySelector('.stepper-up');
      if (!upBtn) return { error: 'up button not found' };
      // Dispatch mousedown like a real user
      upBtn.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
      const after = st.value;
      const storeAfter = window.__store.indentationSize;
      return { before, after, incremented: after === before + 1, storeBefore, storeAfter };
    });
    console.log('  Stepper:', JSON.stringify(stResult));
    if (!stResult.error) {
      const expected = stResult.before + 1;
      await check('Stepper incremented', stResult.after === expected,
        `expected ${expected}, got ${stResult.after}`);
    }

    // ============================================================
    // RESULTS
    // ============================================================
    console.log(`\n${'='.repeat(50)}`);
    if (failures === 0) {
      console.log('✓ ALL TESTS PASSED');
    } else {
      console.log(`✗ ${failures} TEST(S) FAILED`);
      await page.screenshot({ path: 'tests/settings-panel-error.png', fullPage: true });
    }

  } catch (err) {
    console.error('Test failed with exception:', err.message);
    await page.screenshot({ path: 'tests/settings-panel-error.png', fullPage: true });
    failures++;
  } finally {
    await browser.close();
    if (failures > 0) process.exit(1);
  }
}

run();

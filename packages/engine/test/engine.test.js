import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { configureEngine, parseCSS, beautifyCSS, renestCSS } from '../src/engine.js';

function nest(input, maxDepth) {
  configureEngine({ maxDepth, indentChar: '\t' });
  const ast = parseCSS(input);
  renestCSS(ast);
  return beautifyCSS(ast);
}

function nestWithStrategy(input, maxDepth, strategy) {
  configureEngine({ maxDepth, indentChar: '\t', strategy });
  const ast = parseCSS(input);
  renestCSS(ast);
  return beautifyCSS(ast);
}

function nestingDepth(css) {
  const lines = css.split('\n');
  let maxDepth = 0;
  for (const line of lines) {
    if (line.includes('{')) {
      const indent = line.search(/\S/);
      if (indent > 0) {
        maxDepth = Math.max(maxDepth, indent);
      }
    }
  }
  return maxDepth;
}

describe('renestCSS with maxDepth', () => {
  const deeplyNestableCSS = `
    .a { color: red; }
    .a .b { color: blue; }
    .a .b .c { color: green; }
    .a .b .c .d { color: yellow; }
  `;

  it('should nest fully when maxDepth is Infinity', () => {
    configureEngine({ maxDepth: Infinity, indentChar: '\t' });
    const result = nest(deeplyNestableCSS, Infinity);
    assert.ok(result.includes('.a'));
    assert.ok(result.includes('.b'));
    assert.ok(result.includes('.c'));
    assert.ok(result.includes('.d'));
    const depth = nestingDepth(result);
    assert.ok(depth >= 3, `Expected deep nesting with Infinity, got nesting depth ${depth}`);
  });

  it('should produce flat CSS when maxDepth is 0 (no nesting)', () => {
    const result = nest(deeplyNestableCSS, 0);
    const depth = nestingDepth(result);
    assert.ok(depth === 0, `Expected no nesting with maxDepth=0, got nesting depth ${depth}`);
  });

  it('should limit nesting to depth 1 when maxDepth is 1', () => {
    const result = nest(deeplyNestableCSS, 1);
    const depth = nestingDepth(result);
    assert.ok(depth <= 1, `Expected max depth 1, got nesting depth ${depth}`);
  });

  it('should limit nesting to depth 2 when maxDepth is 2', () => {
    const result = nest(deeplyNestableCSS, 2);
    const depth = nestingDepth(result);
    assert.ok(depth <= 2, `Expected max depth 2, got nesting depth ${depth}`);
  });

  it('should produce flat CSS when maxDepth is 0', () => {
    const result = nest(deeplyNestableCSS, 0);
    const depth = nestingDepth(result);
    assert.ok(depth === 0, `Expected no nesting with maxDepth=0, got nesting depth ${depth}`);
  });

  it('should preserve existing nesting behavior with default maxDepth', () => {
    configureEngine({ maxDepth: Infinity, indentChar: '\t' });
    const ast = parseCSS(deeplyNestableCSS);
    renestCSS(ast);
    const result = beautifyCSS(ast);
    const depth = nestingDepth(result);
    assert.ok(depth >= 3, 'Default maxDepth should allow full nesting');
  });

  it('should work correctly with mixed selectors at maxDepth limit', () => {
    const css = `
      .a { color: red; }
      .a .b { color: blue; }
      .a .c { color: green; }
    `;
    const result = nest(css, 1);
    const depth = nestingDepth(result);
    assert.ok(depth <= 1);
    assert.ok(result.includes('.a'));
    assert.ok(result.includes('.b'));
    assert.ok(result.includes('.c'));
  });

  it('should handle combinators (>, +, ~) with depth limit', () => {
    const css = `
      .a { color: red; }
      .a > .b { color: blue; }
      .a > .b + .c { color: green; }
    `;
    const result = nest(css, 1);
    const depth = nestingDepth(result);
    assert.ok(depth <= 1);
    assert.ok(result.includes('.a'));
  });

  it('should handle maxDepth=2 with a 4-level deep structure', () => {
    const css = `
      .w { color: red; }
      .w .x { color: blue; }
      .w .x .y { color: green; }
      .w .x .y .z { color: yellow; }
    `;
    const result = nest(css, 2);
    const depth = nestingDepth(result);
    assert.ok(depth <= 2, `Expected max depth 2, got ${depth}`);
    assert.ok(depth >= 1, 'Should have at least 1 level of nesting');
  });

  it('should still merge declarations when maxDepth is limited', () => {
    const css = `
      .a { color: red; }
      .a .b { color: blue; }
      .a .b .c { color: green; }
    `;
    const result = nest(css, 1);
    assert.ok(result.includes('.a'));
    assert.ok(result.includes('.b'));
    assert.ok(result.includes('color: blue'));
    assert.ok(result.includes('color: red'));
    assert.ok(result.includes('color: green'));
    const aBlock = result.match(/\.a \{([^}]*)\}/s);
    if (aBlock) {
      const hasColorRed = aBlock[1].includes('color: red');
      assert.ok(hasColorRed, '.a should still have its own declarations');
    }
  });
});

describe('nesting strategies', () => {
  const testCSS = `
    .a { color: red; }
    .a .b { color: blue; }
    .a .b .c { color: green; }
    .a .b .c .d { color: yellow; }
    .a .b .c .d .e { color: orange; }
  `;

  describe('balanced (default)', () => {
    it('should limit depth to maxDepth-2 with maxDepth=4', () => {
      const result = nestWithStrategy(testCSS, 4, 'balanced');
      const depth = nestingDepth(result);
      assert.ok(depth <= 2, `Balanced with maxDepth=4 should limit to depth 2, got ${depth}`);
    });

    it('should limit depth to maxDepth-1 when maxDepth < 3', () => {
      const result = nestWithStrategy(testCSS, 2, 'balanced');
      const depth = nestingDepth(result);
      assert.ok(depth <= 1, `Balanced with maxDepth=2 should limit to depth 1, got ${depth}`);
    });

    it('should allow full nesting with maxDepth=Infinity', () => {
      const result = nestWithStrategy(testCSS, Infinity, 'balanced');
      const depth = nestingDepth(result);
      assert.ok(depth >= 3, `Balanced with Infinity should allow depth >= 3, got ${depth}`);
    });

    it('should be the default strategy', () => {
      configureEngine({ maxDepth: 4, indentChar: '\t' });
      const ast = parseCSS(testCSS);
      renestCSS(ast);
      const defaultResult = beautifyCSS(ast);

      configureEngine({ maxDepth: 4, indentChar: '\t', strategy: 'balanced' });
      const ast2 = parseCSS(testCSS);
      renestCSS(ast2);
      const explicitResult = beautifyCSS(ast2);

      assert.equal(defaultResult, explicitResult);
    });
  });

  describe('maximize', () => {
    it('should nest to maxDepth-1 with maxDepth=4', () => {
      const result = nestWithStrategy(testCSS, 4, 'maximize');
      const depth = nestingDepth(result);
      assert.ok(depth <= 3, `Maximize with maxDepth=4 should allow depth <= 3, got ${depth}`);
      assert.ok(depth >= 2, `Maximize with maxDepth=4 should have depth >= 2, got ${depth}`);
    });

    it('should produce deeper nesting than balanced', () => {
      const maxResult = nestWithStrategy(testCSS, 4, 'maximize');
      const balResult = nestWithStrategy(testCSS, 4, 'balanced');
      const maxDepth = nestingDepth(maxResult);
      const balDepth = nestingDepth(balResult);
      assert.ok(maxDepth > balDepth, `Maximize depth (${maxDepth}) should exceed balanced depth (${balDepth})`);
    });

    it('should allow full nesting with maxDepth=Infinity', () => {
      const result = nestWithStrategy(testCSS, Infinity, 'maximize');
      const depth = nestingDepth(result);
      assert.ok(depth >= 3, `Maximize with Infinity should allow depth >= 3, got ${depth}`);
    });

    it('should decouple overflow rules as siblings', () => {
      const result = nestWithStrategy(testCSS, 3, 'maximize');
      const rules = result.split('\n').filter(line => line.includes('{') && line.trim() !== '{');
      const hasDecoupled = rules.some(r => r.startsWith('.a .b .c'));
      assert.ok(hasDecoupled, 'Maximize should produce decoupled root-level rules when overflow');
    });
  });

  describe('flattened', () => {
    it('should reparent overflow rules as siblings at the deepest level', () => {
      const result = nestWithStrategy(testCSS, 3, 'flattened');
      const depth = nestingDepth(result);
      assert.ok(depth <= 2, `Flattened with maxDepth=3 should limit depth to 2, got ${depth}`);
    });

    it('should keep overflow selectors relative to the ancestor at depth maxDepth-2', () => {
      const result = nestWithStrategy(`.a { color: red; }\n.a .b { color: blue; }\n.a .b .c { color: green; }\n.a .b .c .d { color: yellow; }`, 3, 'flattened');
      const lines = result.split('\n').map(l => l.trim()).filter(l => l && l !== '{' && l !== '}');
      const hasCorrectSelector = result.includes('.c .d');
      assert.ok(hasCorrectSelector, `Flattened should produce &.c .d descendant, got:\n${result}`);
    });

    it('should produce consistent relationship types (NEST not MERGE) for flattened nodes', () => {
      const css = `
        .x { color: red; }
        .x .y { color: blue; }
        .x .y .z { color: green; }
        .x .y .z .w { color: yellow; }
      `;
      const result = nestWithStrategy(css, 3, 'flattened');
      const depth = nestingDepth(result);
      assert.ok(depth <= 2, `Flattened depth should be <= 2 with maxDepth=3, got ${depth}`);
      assert.ok(result.includes('color: yellow'), 'All values should be preserved');
    });

    it('should allow full nesting with maxDepth=Infinity', () => {
      const result = nestWithStrategy(testCSS, Infinity, 'flattened');
      const depth = nestingDepth(result);
      assert.ok(depth >= 3, `Flattened with Infinity should allow depth >= 3, got ${depth}`);
    });

    it('should behave like maximize when maxDepth is 1 (no ancestor for reparenting)', () => {
      const flatResult = nestWithStrategy(testCSS, 1, 'flattened');
      const maxResult = nestWithStrategy(testCSS, 1, 'maximize');
      assert.equal(flatResult, maxResult, `Flattened with maxDepth=1 should equal maximize`);
    });
  });
});

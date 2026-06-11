import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { configureEngine, parseCSS, beautifyCSS, renestCSS } from '../src/engine.js';

function nest(input, maxDepth) {
  configureEngine({ maxDepth, indentChar: '\t' });
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

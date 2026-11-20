import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { configureEngine, parseCSS, beautifyCSS, denestCSS, minifyCSS, renestCSS } from '../src/engine.js';

const ENGINE_DEFAULTS = {
  preserveComments: false,
  indentChar: '\t',
  maxDepth: Infinity,
  strategy: 'balanced',
  deduplicate: false,
  valueFormat: 'preserve',
  selectorStrategy: 'is',
  scopeStrategy: 'native',
  selectorWidth: 80,
  selectorSingleLine: false,
};

function resetEngine(overrides = {}) {
  configureEngine({ ...ENGINE_DEFAULTS, ...overrides });
}

beforeEach(() => resetEngine());

function stripTrailingNewline(value) {
  return typeof value === 'string' && value.endsWith('\n') ? value.slice(0, -1) : value;
}

function nest(input, maxDepth) {
  configureEngine({ maxDepth, indentChar: '\t' });
  const ast = parseCSS(input);
  renestCSS(ast);
  return stripTrailingNewline(beautifyCSS(ast));
}

function nestWithStrategy(input, maxDepth, strategy) {
  configureEngine({ maxDepth, indentChar: '\t', strategy });
  const ast = parseCSS(input);
  renestCSS(ast);
  return stripTrailingNewline(beautifyCSS(ast));
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

function denest(input) {
  configureEngine({ maxDepth: Infinity, indentChar: '\t', preserveComments: false, deduplicate: false });
  return stripTrailingNewline(minifyCSS(denestCSS(parseCSS(input))));
}

function minify(input) {
  configureEngine({ maxDepth: Infinity, indentChar: '\t', preserveComments: false, deduplicate: false });
  return stripTrailingNewline(minifyCSS(parseCSS(input)));
}

describe('denesting & under selector lists (issue #14)', () => {
  it('wraps the parent list in :is() so trailing selectors bind to every parent', () => {
    const result = denest(`body, .widget { &[hidden] { display: none; } }`);
    assert.equal(result, `:is(body, .widget)[hidden]{display:none}`);
    assert.ok(!result.includes('.widget[hidden]'), 'the trailing selector must not attach only to the last parent');
  });

  it('matches the reproduction from issue #14', () => {
    const result = denest(`body.flag header, body.flag footer { .widget { display: none; } }`);
    assert.equal(result, `body.flag :is(header, footer) .widget{display:none}`);
  });

  it('applies a compound appended to & to every parent in the list', () => {
    const result = denest(`body, #main { & .widget, &.widget { color: red; } }`);
    assert.equal(result, `:is(body, #main) .widget,:is(body, #main).widget{color:red}`);
  });

  it('keeps combinators that follow & bound to every parent', () => {
    assert.equal(denest(`.a, .b { & > .c { color: red; } }`), `:is(.a, .b)>.c{color:red}`);
    assert.equal(denest(`.a, .b { & + .c { color: red; } }`), `:is(.a, .b)+.c{color:red}`);
    assert.equal(denest(`.a, .b { & ~ .c { color: red; } }`), `:is(.a, .b)~.c{color:red}`);
  });

  it('handles multiple & in one compound', () => {
    assert.equal(denest(`.a, .b { && { color: red; } }`), `:is(.a, .b):is(.a, .b){color:red}`);
    assert.equal(denest(`.a, .b { & & { color: red; } }`), `:is(.a, .b) :is(.a, .b){color:red}`);
    assert.equal(denest(`.a, .b { & + & { color: red; } }`), `:is(.a, .b)+:is(.a, .b){color:red}`);
  });

  it('handles & inside functional pseudo-classes', () => {
    assert.equal(denest(`.a, .b { :not(&) { color: red; } }`), `:not(:is(.a, .b)){color:red}`);
    assert.equal(denest(`.a, .b { :has(&) { color: red; } }`), `:has(:is(.a, .b)){color:red}`);
    assert.equal(
      denest(`.a, .b { &:nth-child(2n of &) { color: red; } }`),
      `:is(.a, .b):nth-child(2n of :is(.a, .b)){color:red}`
    );
  });

  it('keeps pseudo-elements after & attached to the whole list', () => {
    assert.equal(denest(`.a, .b { &::before { content: "x"; } }`), `:is(.a, .b)::before{content:"x"}`);
  });

  it('does not use :is() for a single parent selector', () => {
    assert.equal(denest(`.a { & .b { color: red; } }`), `.a .b{color:red}`);
    assert.equal(denest(`.a { &:hover { color: red; } }`), `.a:hover{color:red}`);
  });
});

describe('denesting & inside compounds and leading combinators', () => {
  it('wraps the parent in :is() when concatenating onto a type selector', () => {
    assert.equal(denest(`div { .foo& { color: red; } }`), `.foo:is(div){color:red}`);
    assert.equal(denest(`body { a& { color: red; } }`), `a:is(body){color:red}`);
  });

  it('wraps a complex parent when concatenating into a compound', () => {
    assert.equal(denest(`div .parent { .foo& { color: red; } }`), `.foo:is(div .parent){color:red}`);
  });

  it('concatenates directly onto a class parent', () => {
    assert.equal(denest(`.parent { .foo& { color: red; } }`), `.foo.parent{color:red}`);
  });

  it('prefixes an implied & for selectors that start with a combinator', () => {
    assert.equal(denest(`.a { > .b { color: red; } }`), `.a>.b{color:red}`);
    assert.equal(denest(`.a { + .b { color: red; } }`), `.a+.b{color:red}`);
    assert.equal(denest(`.a { ~ .b { color: red; } }`), `.a~.b{color:red}`);
  });

  it('prefixes an implied & for a leading combinator under a selector list', () => {
    assert.equal(denest(`.a, .b { > .c { color: red; } }`), `:is(.a, .b)>.c{color:red}`);
  });
});

describe('denesting literal & characters', () => {
  it('does not treat an escaped & as a nesting selector', () => {
    assert.equal(denest(`.a { .\\&b { color: red; } }`), `.a .\\&b{color:red}`);
  });

  it('does not treat & inside attribute values as a nesting selector', () => {
    assert.equal(denest(`.a { &[data-x="&"] { color: red; } }`), `.a[data-x="&"]{color:red}`);
  });

  it('does not treat & inside an unquoted attribute value as a nesting selector', () => {
    assert.equal(denest(`.a { &[title="&"] { color: red; } }`), `.a[title="&"]{color:red}`);
  });
});

describe('custom property block values', () => {
  it('keeps a braced block as part of the declaration value', () => {
    assert.equal(minify(`.a { --x: { color: red }; color: blue; }`), `.a{--x:{color:red};color:blue}`);
  });

  it('preserves an empty braced block', () => {
    assert.equal(minify(`.a { --x: {}; }`), `.a{--x:{}}`);
  });

  it('preserves declarations inside a braced block', () => {
    assert.equal(minify(`.a { --x: { a: b; c: d }; }`), `.a{--x:{a:b;c:d}}`);
  });

  it('denests a custom property block without leaking selector syntax', () => {
    assert.equal(denest(`.a { --x: { color: red }; color: blue; }`), `.a{--x:{color:red};color:blue}`);
  });

  it('still parses a rule whose selector starts with a custom-looking name', () => {
    assert.equal(minify(`--foo:hover { color: red; }`), `--foo:hover{color:red}`);
  });
});

describe('value tokenizing around strings, braces and semicolons', () => {
  it('keeps semicolons and braces inside strings', () => {
    assert.equal(minify(`.a { content: "a;b}c"; color: blue; }`), `.a{content:"a;b}c";color:blue}`);
  });

  it('keeps semicolons inside url() tokens', () => {
    assert.equal(
      minify(`.a { background: url(data:image/svg+xml;base64,AAAA); color: blue; }`),
      `.a{background:url(data:image/svg+xml;base64,AAAA);color:blue}`
    );
  });

  it('does not treat braces in a custom property as a nested rule', () => {
    const ast = parseCSS(`.a { --x: { color: red }; }`);
    const rule = ast.body[0];
    assert.equal(rule.body.length, 1);
    assert.equal(rule.body[0].type, 'Declaration');
    assert.equal(rule.body[0].property, '--x');
  });
});

describe('nest round-trip of generated :is() selectors', () => {
  function nestAfterDenest(input) {
    configureEngine({ maxDepth: Infinity, indentChar: '\t', preserveComments: false, deduplicate: false });
    const ast = parseCSS(input);
    denestCSS(ast);
    renestCSS(ast);
    return stripTrailingNewline(minifyCSS(ast));
  }

  it('nests a generated :is() child selector back under its parent list', () => {
    assert.equal(
      nestAfterDenest(`.a, .b { color: blue; & > .c { color: red; } }`),
      `.a,.b{color:blue;&>.c{color:red}}`
    );
  });

  it('nests a generated :is() pseudo-class selector back under its parent list', () => {
    assert.equal(
      nestAfterDenest(`.a, .b { color: blue; &:hover { color: red; } }`),
      `.a,.b{color:blue;&:hover{color:red}}`
    );
  });

  it('nests a generated :is() descendant selector back under its parent list', () => {
    assert.equal(
      nestAfterDenest(`.a .b, .c .d { color: blue; & .e { color: red; } }`),
      `.a .b,.c .d{color:blue;& .e{color:red}}`
    );
  });

  it('round-trips a nested selector list with a trailing compound', () => {
    const input = `body, #main { &[hidden] { display: none; } }`;
    const once = nestAfterDenest(input);
    const twice = nestAfterDenest(once);
    assert.equal(twice, once);
  });
});

/* -------------------------------------------------------------------------- */
/* Broad engine coverage                                                       */
/* -------------------------------------------------------------------------- */

const ALL_MODES = ['beautify', 'minify', 'denest', 'denest-minify', 'nest', 'nest-minify'];
const MINIFIED_MODES = new Set(['minify', 'denest-minify', 'nest-minify']);

function renderMode(input, mode, overrides = {}) {
  resetEngine(overrides);
  const ast = parseCSS(input);

  switch (mode) {
    case 'beautify': return stripTrailingNewline(beautifyCSS(ast));
    case 'minify': return stripTrailingNewline(minifyCSS(ast));
    case 'denest': return stripTrailingNewline(beautifyCSS(denestCSS(ast)));
    case 'denest-minify': return stripTrailingNewline(minifyCSS(denestCSS(ast)));
    case 'nest': return stripTrailingNewline(beautifyCSS(renestCSS(ast)));
    case 'nest-minify': return stripTrailingNewline(minifyCSS(renestCSS(ast)));
    default: throw new Error(`Unknown mode: ${mode}`);
  }
}

/**
 * Visits only characters that are not inside a string or a comment.
 * Used to reason about CSS structure without being fooled by `{` in
 * `content: "}"` or `/* } *\/`.
 */
function scanCssStructure(text, visit) {
  let inString = null;
  let inComment = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inComment) {
      if (char === '*' && next === '/') {
        inComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (char === '\\') {
        i++;
        continue;
      }
      if (char === inString) inString = null;
      continue;
    }

    if (char === '/' && next === '*') {
      inComment = true;
      i++;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    visit(char);
  }
}

function assertBalancedBraces(text, label = '') {
  let depth = 0;
  scanCssStructure(text, (char) => {
    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      assert.ok(depth >= 0, `${label} has a closing brace without an opening brace`);
    }
  });
  assert.equal(depth, 0, `${label} has unbalanced braces:\n${text}`);
}

/** Maximum number of nested Rule ancestors (top-level rules are depth 0). */
function maxRuleNesting(node, depth = -1) {
  let max = depth;
  for (const child of node.body || []) {
    if (child.type === 'Rule') {
      max = Math.max(max, maxRuleNesting(child, depth + 1));
    } else if (child.type === 'AtRule') {
      max = Math.max(max, maxRuleNesting(child, depth));
    }
  }
  return Math.max(0, max);
}

function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

const STATEMENT_AT_RULES = [
  { name: '@import', css: '@import url("theme.css") screen and (max-width: 400px);', fragments: ['@import', 'url("theme.css")', 'screen and (max-width: 400px)'] },
  { name: '@charset', css: '@charset "UTF-8";', fragments: ['@charset', '"UTF-8"'] },
  { name: '@namespace', css: '@namespace svg url(http://www.w3.org/2000/svg);', fragments: ['@namespace', 'url(http://www.w3.org/2000/svg)'] },
  { name: '@layer statement', css: '@layer base, components;', fragments: ['@layer', 'base, components'] },
  { name: '@custom-media', css: '@custom-media --narrow (max-width: 30em);', fragments: ['@custom-media', '--narrow', '(max-width: 30em)'] },
  { name: '@unknown statement', css: '@unknown foo bar;', fragments: ['@unknown', 'foo bar'] },
];

describe('statement at-rules', () => {
  for (const mode of ALL_MODES) {
    it(`preserves every statement at-rule in ${mode} mode`, () => {
      for (const atRule of STATEMENT_AT_RULES) {
        const output = renderMode(atRule.css, mode);
        assert.equal(output, atRule.css, `${mode} mode lost or rewrote ${atRule.name}`);
      }
    });

    it(`preserves statement at-rules mixed with rules in ${mode} mode`, () => {
      const input = [
        ...STATEMENT_AT_RULES.map(atRule => atRule.css),
        '.a { color: red; }',
      ].join('\n');

      const output = renderMode(input, mode);

      for (const atRule of STATEMENT_AT_RULES) {
        for (const fragment of atRule.fragments) {
          assert.ok(output.includes(fragment), `${mode} mode lost "${fragment}" from ${atRule.name}:\n${output}`);
        }
      }
      assert.match(output, /color\s*:\s*red/);
    });
  }

  it('regression: keeps the reported @import in nest mode with comments on', () => {
    const input = `/* Statement at-rules */
@import url("stylesheet.css") screen and (max-width: 400px);
`;
    const output = renderMode(input, 'nest', { preserveComments: true });
    assert.equal(output, `/* Statement at-rules */\n@import url("stylesheet.css") screen and (max-width: 400px);`);
  });

  it('regression: keeps the reported @import in nest mode with comments off', () => {
    const input = `/* Statement at-rules */
@import url("stylesheet.css") screen and (max-width: 400px);
`;
    const output = renderMode(input, 'nest');
    assert.equal(output, '@import url("stylesheet.css") screen and (max-width: 400px);');
  });

  it('keeps root statement at-rules in source order while nesting', () => {
    const input = [
      '@charset "UTF-8";',
      '@import url("a.css");',
      '@namespace svg url(http://www.w3.org/2000/svg);',
      '@layer reset, base;',
      '.a { color: red; }',
    ].join('\n');

    const output = renderMode(input, 'nest');
    const positions = ['@charset', '@import', '@namespace', '@layer', '.a']
      .map(token => output.indexOf(token));

    assert.ok(positions.every(position => position >= 0), `one or more items disappeared:\n${output}`);
    for (let i = 1; i < positions.length; i++) {
      assert.ok(positions[i] > positions[i - 1], `source order changed:\n${output}`);
    }
  });

  it('keeps statement at-rules inside block at-rules while nesting', () => {
    const media = renderMode('@media (min-width: 1px) { @layer base; .a { color: red; } }', 'nest');
    assert.match(media, /@layer base;/);
    assert.match(media, /color\s*:\s*red/);

    const layer = renderMode('@layer base { @layer x, y; .a { color: red; } }', 'nest');
    assert.match(layer, /@layer x, y;/);
    assert.match(layer, /color\s*:\s*red/);
  });

  it('keeps statement at-rules when deduplication is enabled', () => {
    const output = renderMode('@import url("a.css"); .a { color: red; } .a { color: blue; }', 'nest-minify', { deduplicate: true });
    assert.ok(output.includes('@import url("a.css");'));
    assert.match(output, /color:blue/);
  });
});

describe('block at-rules survive every mode', () => {
  const cases = [
    {
      name: '@font-face',
      css: '@font-face { font-family: Test; src: url(test.woff2); }',
      fragments: [/@font-face/, /font-family\s*:\s*Test/, /url\(test\.woff2\)/],
    },
    {
      name: '@keyframes',
      css: '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }',
      fragments: [/@keyframes spin/, /rotate\(0deg\)/, /rotate\(360deg\)/],
    },
    {
      name: '@property',
      css: '@property --brand { syntax: "<color>"; inherits: false; initial-value: red; }',
      fragments: [/@property --brand/, /syntax\s*:\s*"<color>"/, /initial-value\s*:\s*red/],
    },
    {
      name: '@page',
      css: '@page { margin: 1cm; }',
      fragments: [/@page/, /margin\s*:\s*1cm/],
    },
    {
      name: '@supports',
      css: '@supports (display: grid) { .a { display: grid; } }',
      fragments: [/@supports \(display: grid\)/, /display\s*:\s*grid/],
    },
    {
      name: '@layer block',
      css: '@layer base { .a { color: red; } }',
      fragments: [/@layer base/, /color\s*:\s*red/],
    },
    {
      name: '@scope',
      css: '@scope (.card) to (.content) { .title { color: red; } }',
      fragments: [/@scope \(\.card\) to \(\.content\)/, /color\s*:\s*red/],
    },
  ];

  for (const mode of ALL_MODES) {
    it(`preserves block at-rules in ${mode} mode`, () => {
      for (const testCase of cases) {
        const output = renderMode(testCase.css, mode);
        for (const fragment of testCase.fragments) {
          assert.match(output, fragment, `${mode} mode lost ${testCase.name}:\n${output}`);
        }
      }
    });
  }
});

describe('parseCSS structure', () => {
  it('returns an empty stylesheet for empty and whitespace-only input', () => {
    assert.deepEqual(parseCSS('').body, []);
    assert.deepEqual(parseCSS(' \n\t\r\n ').body, []);
  });

  it('parses statement at-rules with a null body', () => {
    const ast = parseCSS('@import url("a.css") screen;');
    assert.equal(ast.body.length, 1);
    assert.equal(ast.body[0].type, 'AtRule');
    assert.equal(ast.body[0].name, 'import');
    assert.equal(ast.body[0].params, 'url("a.css") screen');
    assert.equal(ast.body[0].body, null);
  });

  it('parses block at-rules with an array body', () => {
    const ast = parseCSS('@media (min-width: 1px) { .a { color: red; } }');
    const media = ast.body[0];
    assert.equal(media.type, 'AtRule');
    assert.equal(media.name, 'media');
    assert.ok(Array.isArray(media.body));
    assert.equal(media.body[0].type, 'Rule');
    assert.equal(media.body[0].body[0].type, 'Declaration');
  });

  it('parses declarations, nested rules and comments in one block', () => {
    resetEngine({ preserveComments: true });
    const ast = parseCSS('.a { color: red; .b { margin: 0; } /* tail */ }');
    const rule = ast.body[0];
    assert.equal(rule.type, 'Rule');
    assert.equal(rule.body[0].type, 'Declaration');
    assert.equal(rule.body[1].type, 'Rule');
    assert.equal(rule.body[2].type, 'Comment');
  });

  it('honours preserveComments', () => {
    resetEngine({ preserveComments: true });
    const withComments = parseCSS('/* a */ .a { /* b */ color: red; }');
    assert.equal(withComments.body[0].type, 'Comment');
    assert.equal(withComments.body[1].body[0].type, 'Comment');

    resetEngine({ preserveComments: false });
    const withoutComments = parseCSS('/* a */ .a { /* b */ color: red; }');
    assert.equal(withoutComments.body.length, 1);
    assert.equal(withoutComments.body[0].body.length, 1);
  });

  it('keeps structural characters inside strings', () => {
    const ast = parseCSS('.a { content: "a;b}c{/*x*/"; background: url("a;b}.png"); }');
    const declarations = ast.body[0].body;
    assert.equal(declarations.length, 2);
    assert.equal(declarations[0].type, 'Declaration');
    assert.equal(declarations[1].type, 'Declaration');
  });

  it('handles CRLF input', () => {
    const output = renderMode('.a {\r\n  color: red;\r\n}\r\n.b { color: blue; }', 'minify');
    assert.equal(output, '.a{color:red}.b{color:blue}');
  });

  it('handles a final declaration without a semicolon', () => {
    assert.equal(renderMode('.a { color: red }', 'minify'), '.a{color:red}');
  });

  it('keeps custom property blocks as declaration values', () => {
    const ast = parseCSS('.a { --x: { color: red }; color: blue; }');
    const declarations = ast.body[0].body;
    assert.equal(declarations.length, 2);
    assert.equal(declarations[0].property, '--x');
    assert.equal(declarations[1].property, 'color');
  });

  it('parses @scope preludes and applies the scope root when denesting', () => {
    assert.equal(
      renderMode('@scope (.card) to (.content) { .title { color: red; } }', 'denest-minify'),
      '@scope (.card) to (.content){.card .title{color:red}}'
    );
  });

  it('keeps the scoping-root reference when denesting an @scope', () => {
    // Expanding `&` to `#app` would stop matching: the scoping root is
    // excluded from the styles scoped beneath it.
    assert.equal(
      renderMode('@scope (#app) { & { color: red; } }', 'denest-minify'),
      '@scope (#app){&{color:red}}'
    );
  });

  it('nests a scoping-root rule back under its @scope', () => {
    assert.equal(
      renderMode('@scope (#app) { & { color: red; > main { display: flex; } } }', 'nest-minify'),
      '@scope (#app){&{color:red;>main{display:flex}}}'
    );
  });

  it('does not re-apply a relative @scope prelude to its descendants', () => {
    assert.equal(
      renderMode('@scope (#app) { @scope (& > main) { .title { color: red; } } }', 'denest-minify'),
      '@scope (#app){@scope (& > main){& .title{color:red}}}'
    );
  });
});

const IDEMPOTENCE_CORPUS = [
  '.a { color: red; } .a .b { color: blue; } .a .b .c { color: green; }',
  '@media (min-width: 1px) { .a { color: red; } }',
  '.a { & .b { color: red; } &:hover { color: blue; } }',
  '@layer base { .a { color: red; } }',
  '@import url("a.css"); @charset "UTF-8"; .a { color: red; }',
  '@font-face { font-family: Test; src: url(test.woff2); } .a { color: red; }',
  '@keyframes spin { from { opacity: 0; } to { opacity: 1; } }',
  '.a { color: red; .b { color: blue; } background: white; }',
];

describe('mode idempotence', () => {
  for (const mode of ['beautify', 'minify', 'denest', 'nest']) {
    it(`${mode} output is stable when processed again`, () => {
      for (const css of IDEMPOTENCE_CORPUS) {
        const once = renderMode(css, mode);
        const twice = renderMode(once, mode);
        assert.equal(twice, once, `${mode} is not idempotent for:\n${css}\n\nfirst:\n${once}\n\nsecond:\n${twice}`);
      }
    });
  }

  it('minifying a beautified result matches minifying the original', () => {
    for (const css of IDEMPOTENCE_CORPUS) {
      const direct = renderMode(css, 'minify');
      assert.equal(
        renderMode(renderMode(css, 'beautify'), 'minify'),
        direct,
        `minify(beautify(input)) differs from minify(input) for:\n${css}`
      );
    }
  });
});

describe('nesting depth contract', () => {
  const selectors = ['.depth0'];
  for (let i = 1; i < 7; i++) {
    selectors.push(`${selectors[i - 1]} .depth${i}`);
  }
  const deepCss = selectors.map((selector, i) => `${selector} { --v${i}: ${i}; }`).join('\n');

  for (const strategy of ['balanced', 'maximize', 'flattened']) {
    for (const maxDepth of [0, 1, 2, 3, 4, 6, Infinity]) {
      it(`${strategy} with maxDepth=${maxDepth} respects the depth limit and keeps declarations`, () => {
        const output = renderMode(deepCss, 'nest', { strategy, maxDepth });
        const depth = maxRuleNesting(parseCSS(output));

        if (Number.isFinite(maxDepth)) {
          assert.ok(depth <= maxDepth, `${strategy}/maxDepth=${maxDepth} produced depth ${depth}:\n${output}`);
        }

        for (let i = 0; i < selectors.length; i++) {
          assert.match(output, new RegExp(`--v${i}\\s*:\\s*${i}`), `${strategy}/maxDepth=${maxDepth} lost --v${i}`);
        }
        assertBalancedBraces(output, `${strategy}/maxDepth=${maxDepth}`);
      });
    }
  }
});

describe('deduplication', () => {
  it('merges duplicate rules and keeps the last declaration when enabled', () => {
    const input = '.a { color: red; color: blue; } .a { margin: 0; } .b { color: red; }';
    assert.equal(renderMode(input, 'minify', { deduplicate: true }), '.a{color:blue;margin:0}.b{color:red}');
  });

  it('leaves duplicate rules and declarations alone when disabled', () => {
    const input = '.a { color: red; color: blue; } .a { margin: 0; } .b { color: red; }';
    assert.equal(renderMode(input, 'minify', { deduplicate: false }), '.a{color:red;color:blue}.a{margin:0}.b{color:red}');
  });

  it('does not deduplicate or drop at-rules', () => {
    const input = '@import url("a.css"); .a { color: red; } .a { color: blue; }';
    const output = renderMode(input, 'minify', { deduplicate: true });
    assert.ok(output.startsWith('@import url("a.css");'));
    assert.equal(output, '@import url("a.css");.a{color:blue}');
  });
});

describe('comments', () => {
  const input = '/* top */\n.a { /* inside */ color: red; /* after */ background: blue; }\n/* tail */';

  it('preserves comments when enabled', () => {
    const output = renderMode(input, 'minify', { preserveComments: true });
    assert.equal(output, '/*top*/.a{/*inside*/color:red;/*after*/background:blue}/*tail*/');
  });

  it('removes comments when disabled', () => {
    assert.equal(renderMode(input, 'minify'), '.a{color:red;background:blue}');
  });

  it('preserves comments in values and selectors', () => {
    assert.equal(
      renderMode('.a /* s */ .b { color: red /* mid */ blue; }', 'minify', { preserveComments: true }),
      '.a /* s */ .b{color:red/* mid */blue}'
    );
  });

  it('keeps comments next to statement at-rules', () => {
    const output = renderMode('/* before */ @import url("a.css"); /* after */', 'nest', { preserveComments: true });
    assert.ok(output.includes('/* before */'));
    assert.ok(output.includes('@import url("a.css");'));
    assert.ok(output.includes('/* after */'));
  });
});

describe('strings, escapes and selector edge cases', () => {
  it('does not split declarations on structural characters inside strings', () => {
    const output = renderMode('.a { content: "a;b}c{/*x*/@import"; background: url("a;b}.png"); }', 'minify');
    assert.equal(output, '.a{content:"a;b}c{/*x*/@import";background:url("a;b}.png")}');
  });

  it('keeps escaped selectors intact', () => {
    assert.equal(renderMode('.\\31 23 { color: red; } .a\\&b { color: blue; }', 'minify'), '.\\31 23{color:red}.a\\&b{color:blue}');
  });

  it('does not treat & inside attribute values as a nesting selector', () => {
    assert.equal(
      renderMode('.a[data-x="a&b"] { color: red; } .a[data-x=a\\&b] { color: blue; }', 'minify'),
      '.a[data-x="a&b"]{color:red}.a[data-x=a\\&b]{color:blue}'
    );
  });

  it('handles :is(), :not() and :has() without breaking their arguments', () => {
    const input = ':is(.a, .b) .c:not(.d) > .e:has(.f) { color: red; }';
    assert.equal(renderMode(input, 'minify'), ':is(.a, .b) .c:not(.d)>.e:has(.f){color:red}');
  });
});

describe('real-world stylesheet smoke test', () => {
  const REAL_WORLD_CSS = `@charset "UTF-8";
@import url("base.css") screen and (min-width: 600px);
@layer reset, base, components;
/* theme */
@font-face { font-family: Brand; src: url(brand.woff2); }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@property --brand { syntax: "<color>"; inherits: false; initial-value: #0af; }
:root { --brand: #0af; color: white; }
.nav { display: flex; @media (min-width: 600px) { gap: 1rem; } .link { color: var(--brand); &:hover { color: red; } } }
@supports (display: grid) { .grid { display: grid; } }
@scope (.card) to (.content) { .title { color: red; } }
`;

  for (const mode of ALL_MODES) {
    it(`preserves the important pieces in ${mode} mode`, () => {
      const output = renderMode(REAL_WORLD_CSS, mode);
      assertBalancedBraces(output, mode);

      for (const fragment of [
        /@charset/,
        /@import url\("base\.css"\)/,
        /@layer reset, base, components;/,
        /@font-face/,
        /@keyframes fade/,
        /@property --brand/,
        /@supports \(display: grid\)/,
        /@scope \(\.card\) to \(\.content\)/,
        /--brand\s*:\s*#0af/,
        /display\s*:\s*grid/,
      ]) {
        assert.match(output, fragment, `${mode} mode lost ${fragment}:\n${output}`);
      }
    });
  }

  it('round-trips denest -> nest without losing declarations', () => {
    const nested = renderMode(REAL_WORLD_CSS, 'denest');
    const renested = renderMode(nested, 'nest');
    assert.match(renested, /--brand\s*:\s*#0af/);
    assert.match(renested, /color\s*:\s*var\(--brand\)/);
    assert.match(renested, /@import url\("base\.css"\)/);
    assertBalancedBraces(renested, 'denest -> nest');
  });
});

function generateFuzzCase(seed, random) {
  const declarations = [];
  const statementAtRules = [];
  let ruleId = 0;
  let declId = 0;

  const declaration = () => {
    const name = `v${seed}d${declId}`;
    const value = String(declId);
    declId++;
    declarations.push({ name, value });
    return `--${name}: ${value};`;
  };

  const makeRule = (depth) => {
    const selector = `.f${seed}r${ruleId++}`;
    const body = [declaration()];
    if (random() < 0.5) body.push(declaration());

    if (depth < 2 && random() < 0.4) {
      body.push(`& .child${ruleId++} { ${declaration()} }`);
    }
    if (depth < 1 && random() < 0.3) {
      body.push(`@media (min-width: ${1 + Math.floor(random() * 100)}px) { ${declaration()} }`);
    }

    return `${selector} { ${body.join(' ')} }`;
  };

  const parts = [];
  for (let i = 0; i < 1 + Math.floor(random() * 3); i++) {
    const bucket = random();
    if (bucket < 0.2) {
      const atRule = pick(random, [
        '@import url("fuzz.css") screen;',
        '@namespace svg url(http://www.w3.org/2000/svg);',
        '@layer reset, base;',
        '@custom-media --narrow (max-width: 30em);',
        '@unknown foo bar;',
      ]);
      statementAtRules.push(atRule);
      parts.push(atRule);
    } else if (bucket < 0.4) {
      parts.push(`@media (min-width: ${1 + Math.floor(random() * 100)}px) { ${makeRule(0)} }`);
    } else if (bucket < 0.5) {
      parts.push(`@font-face { font-family: Fuzz${seed}; src: url(fuzz${seed}.woff2); }`);
    } else if (bucket < 0.6) {
      parts.push(`@keyframes k${seed} { from { opacity: 0; } to { opacity: 1; } }`);
    } else {
      parts.push(makeRule(0));
    }
  }

  if (!parts.some(part => part.includes('--v'))) {
    parts.push(makeRule(0));
  }

  return { css: parts.join('\n'), declarations, statementAtRules };
}

describe('randomized invariants', () => {
  it('keeps every declaration and valid structure across all modes (150 seeds)', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const random = mulberry32(seed);
      const { css, declarations, statementAtRules } = generateFuzzCase(seed, random);

      for (const mode of ALL_MODES) {
        const output = renderMode(css, mode);
        assert.equal(typeof output, 'string', `seed ${seed}, ${mode}`);
        assertBalancedBraces(output, `seed ${seed}, ${mode}`);
        assert.ok(!output.includes('undefined'), `seed ${seed}, ${mode} emitted undefined:\n${output}`);
        assert.ok(!output.includes('null'), `seed ${seed}, ${mode} emitted null:\n${output}`);

        for (const statementAtRule of statementAtRules) {
          assert.ok(output.includes(statementAtRule), `seed ${seed}, ${mode} lost ${statementAtRule}:\n${css}\n---\n${output}`);
        }

        for (const declaration of declarations) {
          const needle = MINIFIED_MODES.has(mode)
            ? `--${declaration.name}:${declaration.value}`
            : `--${declaration.name}: ${declaration.value}`;
          assert.ok(
            output.includes(needle),
            `seed ${seed}, ${mode} lost ${needle}:\n${css}\n---\n${output}`
          );
        }
      }

      const minified = renderMode(css, 'minify');
      assert.equal(renderMode(minified, 'minify'), minified, `seed ${seed}, minify is not idempotent`);

      const beautified = renderMode(css, 'beautify');
      assert.equal(renderMode(beautified, 'beautify'), beautified, `seed ${seed}, beautify is not idempotent`);
    }
  });
});

describe('large stylesheet stress test', () => {
  it('does not lose declarations across 200 rules', () => {
    const rules = [];
    for (let i = 0; i < 200; i++) {
      rules.push(`.stress${i} { --stress${i}: ${i}; }`);
      if (i < 199) rules.push(`.stress${i} .stress${i + 1} { --nested${i}: ${i}; }`);
    }
    const css = rules.join('\n');

    for (const mode of ['minify', 'denest-minify', 'nest-minify']) {
      const output = renderMode(css, mode);
      assertBalancedBraces(output, `stress ${mode}`);
      for (let i = 0; i < 200; i++) {
        assert.ok(output.includes(`--stress${i}:${i}`), `${mode} lost --stress${i}`);
        if (i < 199) assert.ok(output.includes(`--nested${i}:${i}`), `${mode} lost --nested${i}`);
      }
    }
  });
});

describe('obscure but valid CSS syntax', () => {
  const lineContinuationSelector = '.a\\\n.b { color: red; }';

  const cases = [
    {
      name: 'at-rule prelude without leading whitespace',
      css: '@media(min-width:1px){.a{color:red}}',
      minify: '@media (min-width:1px){.a{color:red}}',
      nestContains: ['@media (min-width:1px)', 'color: red;'],
    },
    {
      name: 'comment as whitespace in an at-rule prelude',
      css: String.raw`@import/*c*/url("x.css") screen;`,
      minify: String.raw`@import /*c*/url("x.css") screen;`,
    },
    {
      name: 'comment between at-rule name and parenthesized prelude',
      css: '@media/*c*/(min-width:1px){.a{color:red}}',
      minify: '@media /*c*/(min-width:1px){.a{color:red}}',
      nestContains: ['@media /*c*/(min-width:1px)'],
    },
    {
      name: 'string prelude without whitespace',
      css: '@import"x.css";',
      minify: '@import "x.css";',
    },
    {
      name: 'scope prelude without whitespace',
      css: '@scope(.card){.title{color:red}}',
      minify: '@scope (.card){.title{color:red}}',
      nestContains: ['@scope (.card)', '.card .title', 'color: red;'],
    },
    {
      name: 'colon inside a comment before the declaration colon',
      css: String.raw`.a { color/*:*/: red; }`,
      minify: String.raw`.a{color/*:*/:red}`,
      nestContains: [String.raw`color/*:*/: red;`],
    },
    {
      name: 'escaped colon in a property name',
      css: String.raw`.a { color\:x: red; }`,
      minify: String.raw`.a{color\:x:red}`,
      nestContains: [String.raw`color\:x: red;`],
    },
    {
      name: 'escaped space in a selector',
      css: String.raw`.a\ b { color: red; }`,
      minify: String.raw`.a\ b{color:red}`,
      nestContains: [String.raw`.a\ b`],
    },
    {
      name: 'escaped quote inside an attribute string',
      css: String.raw`[data-x="a\"b"] { color: red; }`,
      minify: String.raw`[data-x="a\"b"]{color:red}`,
      nestContains: [String.raw`[data-x="a\"b"]`],
    },
    {
      name: 'escaped closing bracket in an unquoted attribute value',
      css: String.raw`[data-x=a\]b] { color: red; }`,
      minify: String.raw`[data-x=a\]b]{color:red}`,
      nestContains: [String.raw`[data-x=a\]b]`],
    },
    {
      name: 'escaped closing parenthesis in an unquoted url()',
      css: String.raw`.a { background: url(foo\)bar); }`,
      minify: String.raw`.a{background:url(foo\)bar)}`,
      nestContains: [String.raw`url(foo\)bar)`],
    },
    {
      name: 'escaped space in an unquoted url()',
      css: String.raw`.a { background: url(foo\ bar); }`,
      minify: String.raw`.a{background:url(foo\ bar)}`,
      nestContains: [String.raw`url(foo\ bar)`],
    },
    {
      name: 'escaped space in a value',
      css: String.raw`.a { font-family: A\ B; }`,
      minify: String.raw`.a{font-family:A\ B}`,
      nestContains: [String.raw`font-family: A\ B;`],
    },
    {
      name: 'escaped colon in a custom property value',
      css: String.raw`.a { --x: a\:b; }`,
      minify: String.raw`.a{--x:a\:b}`,
      nestContains: [String.raw`--x: a\:b;`],
    },
    {
      name: 'escaped braces in a custom property value',
      css: String.raw`.a { --x: a\{b\}; }`,
      minify: String.raw`.a{--x:a\{b\}}`,
      nestContains: [String.raw`--x: a\{b\};`],
    },
    {
      name: 'escaped semicolon in a custom property value',
      css: String.raw`.a { --x: a\;b; }`,
      minify: String.raw`.a{--x:a\;b}`,
      nestContains: [String.raw`--x: a\;b;`],
    },
    {
      name: 'backslash-newline selector continuation',
      css: lineContinuationSelector,
      minify: '.a\\\n.b{color:red}',
      nestContains: ['.a\\\n.b'],
    },
    {
      name: 'comment between value tokens',
      css: String.raw`.a { color: re/*c*/d; }`,
      minify: String.raw`.a{color:re/*c*/d}`,
      nestContains: [String.raw`color: re /*c*/ d;`],
    },
    {
      name: 'comment immediately after a declaration colon',
      css: String.raw`.a { color:/*c*/red; }`,
      minify: String.raw`.a{color:/*c*/red}`,
      nestContains: [String.raw`color: /*c*/ red;`],
    },
    {
      name: 'comment before !important',
      css: String.raw`.a { --x: red/*c*/!important; }`,
      minify: String.raw`.a{--x:red/*c*/!important}`,
      nestContains: [String.raw`--x: red /*c*/ !important;`],
    },
    {
      name: 'shadow parts, slotted pseudo-elements and host selectors',
      css: '::part(foo) { color: red; } ::slotted(.a) { color: blue; } :host(.b) { color: green; }',
      minify: '::part(foo){color:red}::slotted(.a){color:blue}:host(.b){color:green}',
      nestContains: ['::part(foo)', '::slotted(.a)', ':host(.b)'],
    },
    {
      name: 'nth-child of a selector list',
      css: ':nth-child(2n+1 of :is(.a, .b)) { color: red; }',
      minify: ':nth-child(2n+1 of :is(.a, .b)){color:red}',
    },
    {
      name: 'image-set with descriptors',
      css: '.a { background: image-set(url(a) 1x, url(b) 2x); }',
      minify: '.a{background:image-set(url(a) 1x,url(b) 2x)}',
    },
    {
      name: 'color-mix with percentages',
      css: '.a { color: color-mix(in oklch, red 40%, blue); }',
      minify: '.a{color:color-mix(in oklch,red 40%,blue)}',
    },
    {
      name: 'relative color syntax',
      css: '.a { color: rgb(from red r g b / 50%); }',
      minify: '.a{color:rgb(from red r g b / 50%)}',
    },
    {
      name: 'calc with a custom property fallback',
      css: '.a { width: calc(100% - var(--gap, 1rem)); }',
      minify: '.a{width:calc(100% - var(--gap,1rem))}',
    },
    {
      name: 'font shorthand with a line-height slash and a quoted family',
      css: '.a { font: italic small-caps 700 16px/1.5 "A B", sans-serif; }',
      minify: '.a{font:italic small-caps 700 16px/1.5"A B",sans-serif}',
    },
    {
      name: 'attr() with a type-or-unit tail',
      css: '.a { content: attr(data-x) / "alt"; }',
      minify: '.a{content:attr(data-x)/"alt"}',
    },
    {
      name: 'grid-template-areas with adjacent strings',
      css: '.a { grid-template-areas: "a a" "b b"; }',
      minify: '.a{grid-template-areas:"a a""b b"}',
    },
    {
      name: 'clip-path polygon',
      css: '.a { clip-path: polygon(0 0, 100% 0, 100% 100%); }',
      minify: '.a{clip-path:polygon(0 0,100% 0,100% 100%)}',
    },
    {
      name: 'offset-path with a path() string',
      css: '.a { offset-path: path("M0 0 L10 10"); }',
      minify: '.a{offset-path:path("M0 0 L10 10")}',
    },
    {
      name: 'legacy vendor value containing a colon',
      css: '.a { filter: progid:DXImageTransform.Microsoft.Alpha(Opacity=50); }',
      minify: '.a{filter:progid:DXImageTransform.Microsoft.Alpha(Opacity=50)}',
    },
    {
      name: 'font-feature-values with a nested at-rule',
      css: '@font-feature-values Font { @styleset { nice: 1; } }',
      minify: '@font-feature-values Font{@styleset{nice:1}}',
    },
    {
      name: 'page with a margin at-rule',
      css: '@page :first { margin: 1cm; @top-left { content: "x"; } }',
      minify: '@page :first{margin:1cm;@top-left{content:"x"}}',
    },
    {
      name: 'counter-style descriptors',
      css: '@counter-style thumbs { system: cyclic; symbols: "A"; suffix: " "; }',
      minify: '@counter-style thumbs{system:cyclic;symbols:"A";suffix:" "}',
    },
    {
      name: 'view-transition descriptor',
      css: '@view-transition { navigation: auto; }',
      minify: '@view-transition{navigation:auto}',
    },
    {
      name: 'position-try block',
      css: '@position-try --x { top: 0; }',
      minify: '@position-try --x{top:0}',
    },
    {
      name: 'starting-style block',
      css: '@starting-style { .a { opacity: 0; } }',
      minify: '@starting-style{.a{opacity:0}}',
    },
    {
      name: 'property syntax with a type union',
      css: '@property --x { syntax: "<length> | <percentage>"; inherits: false; initial-value: 0px; }',
      minify: '@property --x{syntax:"<length> | <percentage>";inherits:false;initial-value:0px}',
    },
    {
      name: 'layer block with dotted name',
      css: '@layer a.b { .x { color: red; } }',
      minify: '@layer a.b{.x{color:red}}',
    },
    {
      name: 'form feed whitespace',
      css: '.a\f{\fcolor:\fred;\f}',
      minify: '.a{color:red}',
      nestContains: ['color: red;'],
    },
    {
      name: 'BOM at the start of the stylesheet',
      css: '\uFEFF.a { color: red; }',
      minify: '.a{color:red}',
    },
    {
      name: 'unicode identifiers',
      css: '.café, #日本語, .--x { color: red; }',
      minify: '.café,#日本語,.--x{color:red}',
    },
    {
      name: 'emoji escape in an identifier',
      css: String.raw`.\1F600 { color: red; }`,
      minify: String.raw`.\1F600{color:red}`,
    },
    {
      name: 'uppercase at-rule name with scope semantics',
      css: '@SCOPE (.card) { .title { color: red; } }',
      minify: '@SCOPE (.card){.title{color:red}}',
      nestContains: ['@SCOPE (.card)', '.card .title'],
    },
    {
      name: 'escaped at-rule name',
      css: String.raw`@\6d edia (min-width:1px) { .a { color: red; } }`,
      minify: String.raw`@\6d edia (min-width:1px){.a{color:red}}`,
      nestContains: [String.raw`@\6d edia (min-width:1px)`],
    },
    {
      name: '& in a custom property value is not a nesting selector',
      css: '.a { --x: &; }',
      minify: '.a{--x:&}',
      nestContains: ['--x: &;'],
    },
    {
      name: '& inside a comment',
      css: '.a { /* & */ color: red; }',
      minify: '.a{/*&*/color:red}',
    },
    {
      name: 'braced custom property with !important',
      css: '.a { --x: { color: red } !important; }',
      minify: '.a{--x:{color:red}!important}',
      nestContains: ['--x: { color: red } !important;'],
    },
    {
      name: 'font src with format() and tech()',
      css: '@font-face { src: local("A"), url(a.woff2) format("woff2") tech(color-COLRv1); }',
      minify: '@font-face{src:local("A"),url(a.woff2) format("woff2") tech(color-COLRv1)}',
    },
    {
      name: 'media query list',
      css: '@media screen and (min-width: 1px), print { .a { color: red; } }',
      minify: '@media screen and (min-width: 1px), print{.a{color:red}}',
    },
    {
      name: 'media range syntax',
      css: '@media (400px <= width <= 700px) { .a { color: red; } }',
      minify: '@media (400px <= width <= 700px){.a{color:red}}',
    },
    {
      name: 'quoted url containing a closing parenthesis',
      css: '.a { background: url("foo)bar"); }',
      minify: '.a{background:url("foo)bar")}',
    },
    {
      name: 'escaped backslash in a string',
      css: String.raw`.a { content: "\\\\"; }`,
      minify: String.raw`.a{content:"\\\\"}`,
      nestContains: [String.raw`content: "\\\\";`],
    },
    {
      name: 'emoji in a counter-style symbol',
      css: '@counter-style x { symbols: "\u{1F44D}"; }',
      minify: '@counter-style x{symbols:"\u{1F44D}"}',
    },
    {
      name: ':lang() and :dir()',
      css: ':lang(en-US):dir(rtl) { color: red; }',
      minify: ':lang(en-US):dir(rtl){color:red}',
    },
    {
      name: ':state() and ::highlight()',
      css: ':state(foo)::highlight(bar) { color: red; }',
      minify: ':state(foo)::highlight(bar){color:red}',
    },
    {
      name: '@supports selector(:has(> img))',
      css: '@supports selector(:has(> img)) { .a { color: red; } }',
      minify: '@supports selector(:has(> img)){.a{color:red}}',
    },
    {
      name: '@container style query',
      css: '@container style(--x: 1) { .a { color: red; } }',
      minify: '@container style(--x: 1){.a{color:red}}',
    },
    {
      name: '@scope selector list',
      css: '@scope (.a, .b) to (.c, .d) { .x { color: red; } }',
      minify: '@scope (.a, .b) to (.c, .d){.x{color:red}}',
      nestContains: [':is(.a, .b) .x'],
    },
    {
      name: '@import with layer() and supports()',
      css: '@import url("x.css") layer(base) supports(display: grid) screen;',
      minify: '@import url("x.css") layer(base) supports(display: grid) screen;',
    },
    {
      name: '@namespace with a string URL',
      css: '@namespace svg "http://www.w3.org/2000/svg";',
      minify: '@namespace svg "http://www.w3.org/2000/svg";',
    },
    {
      name: 'hex escape with a terminating space in a value',
      css: String.raw`.a { color: r\65 d; }`,
      minify: String.raw`.a{color:r\65 d}`,
      nestContains: [String.raw`color: r\65 d;`],
    },
    {
      name: 'hex escape in a property name',
      css: String.raw`.a { c\6flor: red; }`,
      minify: String.raw`.a{c\6flor:red}`,
      nestContains: [String.raw`c\6flor: red;`],
    },
    {
      name: 'unicode escape in a string',
      css: String.raw`.a { content: "\201C"; }`,
      minify: String.raw`.a{content:"\201C"}`,
      nestContains: [String.raw`content: "\201C";`],
    },
    {
      name: 'escaped quote in a string',
      css: String.raw`.a { content: "a\"b"; }`,
      minify: String.raw`.a{content:"a\"b"}`,
      nestContains: [String.raw`content: "a\"b";`],
    },
    {
      name: 'NUL escape in a value',
      css: String.raw`.a { --x: \0; }`,
      minify: String.raw`.a{--x:\0}`,
      nestContains: [String.raw`--x: \0;`],
    },
    {
      name: 'surrogate-pair escape in a value',
      css: String.raw`.a { --x: \1F600; }`,
      minify: String.raw`.a{--x:\1F600}`,
      nestContains: [String.raw`--x: \1F600;`],
    },
    {
      name: 'backslash-newline inside a string',
      css: '.a { content: "a\\' + '\n' + 'b"; }',
      minify: '.a{content:"a\\' + '\n' + 'b"}',
      nestContains: ['content: "a\\' + '\n' + 'b";'],
    },
    {
      name: 'hex escape followed by CRLF in a string',
      css: '.a { content: "\\41\nB"; }',
      minify: '.a{content:"\\41\nB"}',
      nestContains: ['content: "\\41\nB";'],
    },
    {
      name: 'escaped !important keyword',
      css: String.raw`.a { color: red !\69mportant; }`,
      minify: String.raw`.a{color:red!\69mportant}`,
      nestContains: [String.raw`color: red !\69mportant;`],
    },
    {
      name: 'nested @supports',
      css: '@supports (display:grid){@supports (gap:1rem){.a{color:red}}}',
      minify: '@supports (display:grid){@supports (gap:1rem){.a{color:red}}}',
    },
    {
      name: 'nested @layer',
      css: '@layer a { @layer b { .x { color: red; } } }',
      minify: '@layer a{@layer b{.x{color:red}}}',
    },
    {
      name: 'nested @container',
      css: '@container (width > 400px) { @container (height > 200px) { .a { color: red; } } }',
      minify: '@container (width > 400px){@container (height > 200px){.a{color:red}}}',
    },
    {
      name: '@media containing @supports',
      css: '@media (min-width:1px){@supports (display:grid){.a{color:red}}}',
      minify: '@media (min-width:1px){@supports (display:grid){.a{color:red}}}',
    },
  ];

  for (const testCase of cases) {
    it(`handles ${testCase.name} in every mode`, () => {
      for (const mode of ['minify', 'beautify', 'denest', 'nest']) {
        const output = renderMode(testCase.css, mode, { preserveComments: true });
        assert.equal(typeof output, 'string', `${mode}: ${testCase.name}`);
        assertBalancedBraces(output, `${mode}: ${testCase.name}`);
        assert.ok(!output.includes('undefined'), `${mode}: ${testCase.name} emitted undefined`);

        if (mode === 'minify') {
          assert.equal(output, testCase.minify, `minify mismatch for ${testCase.name}`);
        }

        if (mode === 'nest' && testCase.nestContains) {
          for (const fragment of testCase.nestContains) {
            assert.ok(output.includes(fragment), `nest lost "${fragment}" for ${testCase.name}:\n${output}`);
          }
        }
      }
    });
  }

  it('parses at-rule names without requiring whitespace', () => {
    resetEngine({ preserveComments: true });

    const media = parseCSS('@media(min-width:1px){.a{color:red}}').body[0];
    assert.equal(media.name, 'media');
    assert.equal(media.params, '(min-width:1px)');

    const scope = parseCSS('@scope(.card){.title{color:red}}').body[0];
    assert.equal(scope.name, 'scope');
    assert.equal(scope.params, '(.card)');

    const imported = parseCSS('@import"x.css";').body[0];
    assert.equal(imported.name, 'import');
    assert.equal(imported.params, '"x.css"');
  });

  it('parses at-rule names across comments', () => {
    resetEngine({ preserveComments: true });

    const imported = parseCSS(String.raw`@import/*c*/url("x.css") screen;`).body[0];
    assert.equal(imported.name, 'import');
    assert.equal(imported.params, String.raw`/*c*/url("x.css") screen`);

    const media = parseCSS('@media/*c*/(min-width:1px){.a{color:red}}').body[0];
    assert.equal(media.name, 'media');
    assert.equal(media.params, '/*c*/(min-width:1px)');
  });

  it('finds the real declaration colon instead of a colon in a comment or escaped name', () => {
    resetEngine({ preserveComments: true });
    const commented = parseCSS('.a { color/*:*/: red; }').body[0].body[0];
    assert.equal(commented.property, 'color/*:*/');
    assert.deepEqual(commented.value, ['red']);

    resetEngine({ preserveComments: false });
    const stripped = parseCSS('.a { color/*:*/: red; }').body[0].body[0];
    assert.equal(stripped.property, 'color');

    resetEngine({ preserveComments: false });
    const escaped = parseCSS(String.raw`.a { color\:x: red; }`).body[0].body[0];
    assert.equal(escaped.property, String.raw`color\:x`);
    assert.deepEqual(escaped.value, ['red']);
  });
});

describe('spec-valid obscure stylesheets', () => {
  it('keeps hex escapes in property and value names', () => {
    const css = String.raw`.card {
  \63\6f\6c\6f\72: r\65 d;
}`;
    const declaration = parseCSS(css).body[0].body[0];

    assert.equal(declaration.property, String.raw`\63\6f\6c\6f\72`);
    assert.deepEqual(declaration.value, [String.raw`r\65 d`]);

    const pretty = `.card {\n\t${String.raw`\63\6f\6c\6f\72`}: ${String.raw`r\65 d`};\n}`;
    assert.equal(renderMode(css, 'beautify'), pretty);
    assert.equal(renderMode(css, 'minify'), String.raw`.card{\63\6f\6c\6f\72:r\65 d}`);
    assert.equal(renderMode(css, 'denest'), pretty);
    assert.equal(renderMode(css, 'nest'), pretty);
  });

  it('accepts a custom property named exactly --', () => {
    const css = `:root {
  --: darkblue;
}

body {
  color: var(--);
}`;
    const declaration = parseCSS(css).body[0].body[0];

    assert.equal(declaration.property, '--');
    assert.deepEqual(declaration.value, ['darkblue']);
    assert.deepEqual(parseCSS(css).body[1].body[0].value, ['var(--)']);
    assert.equal(renderMode(css, 'minify'), ':root{--:darkblue}body{color:var(--)}');
  });

  it('ignores CDO and CDC tokens at the top level only', () => {
    const css = `<!--
body {
  color: green;
}
-->`;

    assert.deepEqual(parseCSS(css).body.map(node => node.type), ['Rule']);
    assert.equal(renderMode(css, 'beautify'), 'body {\n\tcolor: green;\n}');
    assert.equal(renderMode(css, 'minify'), 'body{color:green}');
    assert.equal(renderMode(css, 'denest'), 'body {\n\tcolor: green;\n}');
    assert.equal(renderMode(css, 'nest'), 'body {\n\tcolor: green;\n}');
  });

  it('ignores CDO and CDC around a top-level @import', () => {
    const css = `<!--
@import url("base.css");
-->`;

    assert.equal(renderMode(css, 'minify'), '@import url("base.css");');
    assert.equal(renderMode(css, 'nest'), '@import url("base.css");');
  });

  it('accepts scientific notation in numbers and dimensions', () => {
    const css = `.box {
  width: 1e2px;
  animation-duration: 2.5e-1s;
  line-height: 2e0;
}`;
    const declarations = parseCSS(css).body[0].body;

    assert.deepEqual(declarations.map(d => d.value[0]), ['1e2px', '2.5e-1s', '2e0']);
    assert.equal(
      renderMode(css, 'minify'),
      '.box{width:1e2px;animation-duration:2.5e-1s;line-height:2e0}'
    );
  });

  it('preserves the whitespace token in a whitespace-only custom property', () => {
    const css = `:root {
  --empty: ;
}

.box {
  background-color: var(--empty) red;
}`;
    const declaration = parseCSS(css).body[0].body[0];

    assert.equal(declaration.property, '--empty');
    assert.deepEqual(declaration.value, []);
    assert.equal(declaration.valueWasWhitespaceOnly, true);
    assert.equal(parseCSS('.a { color: ; }').body[0].body[0].valueWasWhitespaceOnly, false);

    assert.equal(
      renderMode(css, 'minify'),
      ':root{--empty: }.box{background-color:var(--empty) red}'
    );
    assert.equal(
      renderMode(css, 'beautify'),
      ':root {\n\t--empty: ;\n}\n\n.box {\n\tbackground-color: var(--empty) red;\n}'
    );
  });

  it('tokenizes the || column combinator without splitting namespaces', () => {
    const css = 'col.highlight || td {\n  background: yellow;\n}';
    const selector = parseCSS(css).body[0].selector[0];

    assert.deepEqual(selector.parts, ['col.highlight', '||', 'td']);
    assert.equal(renderMode(css, 'minify'), 'col.highlight||td{background:yellow}');
    assert.equal(renderMode(css, 'beautify'), 'col.highlight || td {\n\tbackground: yellow;\n}');
    assert.equal(
      renderMode('col.highlight { || td { background: yellow; } }', 'denest'),
      'col.highlight || td {\n\tbackground: yellow;\n}'
    );
    assert.equal(
      renderMode('col.highlight { & || td { background: yellow; } }', 'nest'),
      'col.highlight || td {\n\tbackground: yellow;\n}'
    );
    assert.equal(
      renderMode('col.highlight || td { background: yellow; }\ncol.highlight || td:hover { color: red; }', 'nest'),
      'col.highlight || td {\n\tbackground: yellow;\n\n\t&:hover {\n\t\tcolor: red;\n\t}\n}'
    );

    assert.equal(renderMode('svg|a, *|*, |a { color: red; }', 'minify'), 'svg|a,*|*,|a{color:red}');
    assert.equal(renderMode('[data-x="a||b"] { color: red; }', 'minify'), '[data-x="a||b"]{color:red}');
    assert.equal(
      renderMode(':is(col.highlight || td) { background: yellow; }', 'minify'),
      ':is(col.highlight || td){background:yellow}'
    );
  });

  it('accepts trig functions and constants inside calc()', () => {
    const css = '.spinner {\n  transform: rotate(calc(1turn * sin(pi / 6)));\n}';

    assert.deepEqual(parseCSS(css).body[0].body[0].value, ['rotate(calc(1turn * sin(pi / 6)))']);
    assert.equal(
      renderMode(css, 'minify'),
      '.spinner{transform:rotate(calc(1turn * sin(pi / 6)))}'
    );
  });

  it('round-trips the combined cursed stylesheet and drops only the invalid -- declaration', () => {
    const css = String.raw`<!--
:root {
  --;
  --: 1e2px;
}

.\31st-place {
  \63\6f\6c\6f\72: r\65 d;
  width: var(--);
  transform: rotate(calc(cos(0rad) * 1turn));
  ;;;
}
-->`;

    const minified = renderMode(css, 'minify');
    assert.equal(
      minified,
      String.raw`:root{--:1e2px}.\31st-place{\63\6f\6c\6f\72:r\65 d;width:var(--);transform:rotate(calc(cos(0rad) * 1turn))}`
    );
    assert.ok(!minified.includes('<!--'));
    assert.ok(!minified.includes('-->'));
    assert.ok(!minified.includes('--;'));

    const nested = renderMode(css, 'nest');
    assert.ok(nested.includes(String.raw`.\31st-place`));
    assert.ok(nested.includes(String.raw`\63\6f\6c\6f\72: r\65 d;`));
    assert.ok(nested.includes('--: 1e2px;'));
    assert.ok(!nested.includes('--;'));

    assert.equal(renderMode(':root { --; color: red; }', 'minify'), ':root{color:red}');
  });

  it('keeps every spec-valid oddity stable when processed again', () => {
    const snippets = [
      String.raw`.card { \63\6f\6c\6f\72: r\65 d; }`,
      ':root { --: darkblue; } body { color: var(--); }',
      '<!-- body { color: green; } -->',
      '.box { width: 1e2px; animation-duration: 2.5e-1s; line-height: 2e0; }',
      ':root { --empty: ; } .box { background-color: var(--empty) red; }',
      'col.highlight || td { background: yellow; }',
      '.spinner { transform: rotate(calc(1turn * sin(pi / 6))); }',
    ];

    for (const css of snippets) {
      for (const mode of ['beautify', 'minify', 'denest', 'nest']) {
        const once = renderMode(css, mode);
        const twice = renderMode(once, mode);
        assert.equal(twice, once, `${mode} is not idempotent for ${css}`);
      }
    }
  });
});

describe('Nest mode comment and media placement', () => {
  const fixture = `:root { --x: 1px; }

.header-controls {
    display: flex;
    gap: 1rem;

    @media (width < 1024px) {
        width: 100%;
        justify-content: center;
    }
}

.header-btn {
    cursor: pointer;
    padding: 1rem 1.75ch;

    @media not (prefers-reduced-motion: reduce) {
        transition: background-position 0.125s ease-out, translate 0.2s, filter 0.2s;
    }

    &#settings-toggle svg {
        vertical-align: middle;
    }
}

#mainSettings {
    position: absolute;
    translate: 4rem;

    @media (width < 1024px) {
        left: 0;
        right: 0;
        width: 100%;
        translate: 0;
    }
}

#mainSettings > section {
    border-radius: 2rem;
    padding: 2rem;

    @media (width < 1024px) {
        padding: 1.25rem;
    }
}

#mainSettings > section > ul {
    list-style: none;
    margin: 0;
    padding: 0;

    > li {
        display: grid;

        > span {
            font-size: 1.125rem;
        }

        > div {
            display: flex;
            flex-direction: row;

            > :first-child {
                flex: 1;
            }
        }
    }
}

/* Dropdown list - quickly-specific visuals */
#mainSettings .dropdown > ul {
    background: rgb(from color-mix(in srgb, var(--shades-darkest), var(--pri-colour-darkest) 75%) r g b / 0.75);
    backdrop-filter: blur(25px);
}

/* Stepper - quickly uses inline arrows */
#mainSettings .number > output > input {
    background: transparent;
    border: none;
    color: inherit;
    font: inherit;
    width: 2ch;
}

/* Override UA's absolute stepper arrows */
#mainSettings .number > output > input ~ div {
    position: static;
    translate: none;
}

/* Toggle - quickly uses full-coverage invisible input */
#mainSettings .toggle {
    overflow: hidden;
}

#code-editor-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    padding: var(--header-top) 2rem 2rem 2rem;
    gap: 2rem;

    @media (width < 1024px) {
        padding-left: var(--margin-gap);
        padding-right: var(--margin-gap);
        gap: 1.625rem;
    }

    > #code-editor {
        flex: 1;
        max-width: 100%;
        display: flex;
        margin: 2rem;

        .editorTab {
            line-height: 100%;
            color: rgb(from var(--shades-medium) r g b / 50%);
            font-size: 1rem;

            > .tabButtons > button {
                height: 2rem;
                width: 2rem;

                @media not (prefers-reduced-motion: reduce) {
                    transition: 0.1s;
                }
            }
        }
    }
}`;

  it('attaches comments to their rules instead of orphaning them at the root', () => {
    const output = renderMode(fixture, 'nest', { preserveComments: true });
    for (const comment of [
      '/* Dropdown list - quickly-specific visuals */',
      '/* Stepper - quickly uses inline arrows */',
      '/* Override UA\'s absolute stepper arrows */',
      '/* Toggle - quickly uses full-coverage invisible input */',
    ]) {
      assert.ok(output.includes('\t' + comment), `comment is not attached to a rule: ${comment}`);
      assert.ok(!output.includes('\n' + comment + '\n'), `comment was left at the root: ${comment}`);
    }
  });

  it('keeps responsive media queries nested inside their rules', () => {
    const output = renderMode(fixture, 'nest');
    assert.ok(output.includes('\t@media (width < 1024px) {\n\t\twidth: 100%;'));
    assert.ok(output.includes('\t@media not (prefers-reduced-motion: reduce) {\n\t\ttransition: background-position'));
    assert.ok(output.includes('\t@media (width < 1024px) {\n\t\tpadding-left: var(--margin-gap);'));
    assert.ok(output.includes('\t\t\t\t@media not (prefers-reduced-motion: reduce) {\n\t\t\t\t\ttransition: 0.1s;'));
  });

  it('is idempotent on the fixture', () => {
    const once = renderMode(fixture, 'nest');
    const twice = renderMode(once, 'nest');
    assert.equal(twice, once);
  });
});

describe('engine settings', () => {
  it('selectorStrategy is keeps :is() for parent lists', () => {
    resetEngine({ selectorStrategy: 'is' });
    const ast = denestCSS(parseCSS('.a, .b { & > .c { color: red; } }'));
    assert.equal(minifyCSS(ast).trim(), ':is(.a, .b)>.c{color:red}');
  });

  it('selectorStrategy multiply expands parent lists', () => {
    resetEngine({ selectorStrategy: 'multiply' });
    const ast = denestCSS(parseCSS('.a, .b { & > .c { color: red; } }'));
    assert.equal(minifyCSS(ast).trim(), '.a>.c,.b>.c{color:red}');
  });

  it('scopeStrategy native preserves @scope', () => {
    resetEngine({ scopeStrategy: 'native' });
    const ast = denestCSS(parseCSS('@scope (.card) to (.content) { .title { color: red; } }'));
    assert.ok(minifyCSS(ast).includes('@scope'));
  });

  it('scopeStrategy downlevel flattens @scope', () => {
    resetEngine({ scopeStrategy: 'downlevel' });
    const ast = denestCSS(parseCSS('@scope (.card) to (.content) { .title { color: red; } }'));
    assert.ok(!minifyCSS(ast).includes('@scope'));
    assert.ok(minifyCSS(ast).includes('.card .title'));
  });

  it('valueFormat single-line flattens multiline values', () => {
    resetEngine({ valueFormat: 'single-line' });
    const ast = parseCSS('.a { background: linear-gradient(\n  to right,\n  red,\n  blue\n); }');
    const out = beautifyCSS(ast);
    assert.ok(!out.includes('\n  to right'));
  });

  it('valueFormat preserve keeps multiline values', () => {
    resetEngine({ valueFormat: 'preserve' });
    const ast = parseCSS('.a { background: linear-gradient(\n  to right,\n  red,\n  blue\n); }');
    const out = beautifyCSS(ast);
    assert.ok(out.includes('to right'));
  });

  it('selector wrap: long list wraps each on own line', () => {
    resetEngine({ selectorWidth: 20, selectorSingleLine: false });
    const ast = parseCSS('.foo, .bar, .baz, .qux { color: red; }');
    const out = beautifyCSS(ast);
    assert.ok(out.includes(',\n'), 'expected wrapping');
  });

  it('selector wrap: short list stays inline', () => {
    resetEngine({ selectorWidth: 80, selectorSingleLine: false });
    const ast = parseCSS('.a, .b { color: red; }');
    const out = beautifyCSS(ast);
    assert.ok(out.includes('.a, .b {'), 'expected inline');
  });

  it('selector wrap: single-line override keeps long list inline', () => {
    resetEngine({ selectorWidth: 30, selectorSingleLine: true });
    const ast = parseCSS('.a, .b, .c, .d, .e { color: red; }');
    const out = beautifyCSS(ast);
    assert.ok(!out.includes(',\n'), 'expected no wrapping');
  });

  it('selector wrap: custom width 160 keeps lists inline', () => {
    resetEngine({ selectorWidth: 160, selectorSingleLine: false });
    const ast = parseCSS('.a, .b, .c { color: red; }');
    const out = beautifyCSS(ast);
    assert.ok(out.includes('.a, .b, .c {'), 'expected inline at wide width');
  });
});

describe('trailing newline and comment formatting', () => {
  it('beautifyCSS appends exactly one trailing newline', () => {
    resetEngine();
    const ast = parseCSS('.a { color: red; }');
    const out = beautifyCSS(ast);
    assert.ok(out.endsWith('\n'));
    assert.ok(!out.endsWith('\n\n'));
    assert.equal(out, out.trimEnd() + '\n');
  });

  it('minifyCSS appends exactly one trailing newline', () => {
    resetEngine();
    const ast = parseCSS('.a { color: red; }');
    const out = minifyCSS(ast);
    assert.ok(out.endsWith('\n'));
    assert.ok(!out.endsWith('\n\n'));
    assert.equal(out, out.trimEnd() + '\n');
  });

  it('denestCSS output ends with exactly one newline', () => {
    resetEngine();
    const ast = parseCSS('.a { color: red; }');
    const out = beautifyCSS(denestCSS(ast));
    assert.ok(out.endsWith('\n'));
    assert.ok(!out.endsWith('\n\n'));
  });

  it('renestCSS output ends with exactly one newline', () => {
    resetEngine();
    const ast = parseCSS('.a { color: red; }');
    const out = beautifyCSS(renestCSS(ast));
    assert.ok(out.endsWith('\n'));
    assert.ok(!out.endsWith('\n\n'));
  });

  it('repeated beautify passes do not accumulate newlines', () => {
    resetEngine();
    const first = beautifyCSS(parseCSS('.a { color: red; }'));
    const second = beautifyCSS(parseCSS(first));
    assert.equal(second, first);
  });

  it('empty output is empty', () => {
    resetEngine();
    const ast = parseCSS('');
    assert.equal(beautifyCSS(ast), '');
    assert.equal(minifyCSS(ast), '');
  });

  it('formats multiline block comments without /* * corruption', () => {
    resetEngine({ preserveComments: true, indentChar: '\t' });
    const css = '.a {\n  /*   \n   * Remove the slide in animation  \n   * And make the editors stack  \n   */\n  color: red;\n}';
    const out = beautifyCSS(parseCSS(css));
    assert.ok(!out.includes('/* *'), 'comment must not be corrupted into /* *');
    assert.ok(out.includes('/*'), 'opening comment marker missing');
    assert.ok(out.includes('*/'), 'closing comment marker missing');
    assert.ok(out.includes('Remove the slide in animation'), 'comment text missing');
    assert.ok(out.includes('And make the editors stack'), 'comment text missing');
  });

  it('indents multiline comments to current nesting', () => {
    resetEngine({ preserveComments: true, indentChar: '\t', maxDepth: Infinity });
    const css = '.a {\n  /* line one \n   * line two \n   */\n  color: red;\n}';
    const ast = parseCSS(css);
    renestCSS(ast);
    const out = beautifyCSS(ast);
    // nested under .a, the comment lines should carry the rule indent
    assert.ok(out.includes('\t/*'), 'comment should be indented under the rule');
  });
});
describe('comment formatting variants', () => {
  function bc(css) {
    resetEngine({ preserveComments: true, indentChar: '\t', maxDepth: Infinity });
    return beautifyCSS(parseCSS(css));
  }

  it('no padding normalizes to single spaces', () => {
    assert.ok(bc('.a { /*clean*/ color: red; }').includes('/* clean */'));
  });

  it('excessive padding trims to one space', () => {
    assert.ok(bc('.a { /*   wide   */ color: red; }').includes('/* wide */'));
  });

  it('leading newline collapses to single line', () => {
    assert.ok(bc('.a { /*\nHello world */ color: red; }').includes('/* Hello world */'));
  });

  it('trailing newline collapses to single line', () => {
    assert.ok(bc('.a { /* Hello world\n*/ color: red; }').includes('/* Hello world */'));
  });

  it('padded newlines collapse to single line', () => {
    assert.ok(bc('.a { /*\n Hello world \n*/ color: red; }').includes('/* Hello world */'));
  });

  it('empty /**/ normalizes to /* */', () => {
    assert.ok(bc('.a { /**/ color: red; }').includes('/* */'));
  });

  it('empty /*   */ normalizes to /* */', () => {
    assert.ok(bc('.a { /*   */ color: red; }').includes('/* */'));
  });

  it('empty /*\\n*/ normalizes to /* */', () => {
    assert.ok(bc('.a { /*\n*/ color: red; }').includes('/* */'));
  });

  it('jsdoc asterisk block stays multiline and indented', () => {
    const out = bc('.card {\n/*\n* Title\n* Desc\n*/\n  color: red;\n}');
    assert.ok(out.includes('\t/*\n\t * Title\n\t * Desc\n\t */'));
  });

  it('plain multiline block stays multiline without asterisks', () => {
    const out = bc('.card {\n/*\nLine one\nLine two\n*/\n  color: red;\n}');
    assert.ok(out.includes('\t/*\n\tLine one\n\tLine two\n\t*/'));
  });

  it('divider art is preserved verbatim', () => {
    const out = bc('.card {\n/********************/\n/* SECTION */\n/********************/\n  color: red;\n}');
    assert.ok(out.includes('\t/********************/'));
    assert.ok(out.includes('\t/* SECTION */'));
  });

  it('trailing comment spacing normalized to one space', () => {
    const out = bc('.a { width: 100px;/*comment*/\nheight: 200px;     /* wide gap */ }');
    assert.ok(out.includes('width: 100px; /* comment */'));
    assert.ok(out.includes('height: 200px; /* wide gap */'));
  });

  it('inter-token comment preserved without spaces', () => {
    assert.ok(bc('.a { color/*:*/: red; }').includes('color/*:*/: red;'));
  });

  it('bang license normalizes padding', () => {
    assert.ok(bc('/*!  Package License v1.0.0  */\n.a { color: red; }').includes('/*! Package License v1.0.0 */'));
  });

  it('single line comment collapses', () => {
    const out = bc('/*\nThe actual main CSS file for this website */');
    assert.equal(out.trim(), '/* The actual main CSS file for this website */');
  });
});

describe('scopeStrategy downlevel & resolution', () => {
  it('resolves & to the scope root selector', () => {
    resetEngine({ scopeStrategy: 'downlevel' });
    const css = '@scope (#siteWrapper) { & { margin: 0; } &:has(> .a) { color: red; } & > main { display: flex; } }';
    const ast = denestCSS(parseCSS(css));
    const out = minifyCSS(ast);
    assert.ok(out.includes('#siteWrapper{'), 'root & not resolved');
    assert.ok(out.includes('#siteWrapper:has(> .a)'), 'has() & not resolved');
    assert.ok(out.includes('#siteWrapper>main{'), '> main & not resolved');
    assert.ok(!out.includes('&'), 'orphaned & remains');
  });

  it('keeps @scope wrapper for relative roots', () => {
    resetEngine({ scopeStrategy: 'downlevel' });
    const css = '@scope (& > main) { & { color: red; } }';
    const ast = denestCSS(parseCSS(css));
    const out = minifyCSS(ast);
    assert.ok(out.includes('@scope'), 'relative scope should stay wrapped');
  });
});

describe('engine edge cases', () => {
  it('handles empty input', () => {
    resetEngine();
    const ast = parseCSS('');
    assert.equal(beautifyCSS(ast), '');
    assert.equal(minifyCSS(ast), '');
  });

  it('handles whitespace-only input', () => {
    resetEngine();
    const ast = parseCSS('   \n\n\t  ');
    assert.equal(beautifyCSS(ast).trim(), '');
    assert.equal(minifyCSS(ast).trim(), '');
  });

  it('handles comment-only input', () => {
    resetEngine({ preserveComments: true });
    const ast = parseCSS('/* just a comment */');
    const out = minifyCSS(ast);
    assert.ok(out.includes('/*just a comment*/'));
  });

  it('handles deeply nested CSS (>10 levels)', () => {
    resetEngine();
    let css = '.a {';
    for (let i = 1; i <= 11; i++) css += ` .l${i} {`;
    css += ' color: red; ';
    for (let i = 0; i <= 11; i++) css += '}';
    const ast = parseCSS(css);
    const out = beautifyCSS(ast);
    assert.ok(out.includes('color: red'));
    assert.ok(!out.includes('undefined'));
  });

  it('handles unicode/emoji selectors', () => {
    resetEngine();
    const css = '.?? { color: red; } .caf� { color: blue; }';
    const ast = parseCSS(css);
    const out = minifyCSS(ast);
    assert.ok(out.includes('.??{color:red}'));
    assert.ok(out.includes('.caf�{color:blue}'));
  });
  it('normalizes CRLF input to LF output', () => {
    resetEngine({ valueFormat: 'preserve', preserveComments: true });
    const css = '/* top */\r\n.a {\r\n  /* inside */\r\n  color: red;\r\n  background: linear-gradient(\r\n    to right,\r\n    red,\r\n    blue\r\n  );\r\n}\r\n';
    const ast = parseCSS(css);
    const beautified = beautifyCSS(ast);
    const minified = minifyCSS(ast);
    assert.ok(!beautified.includes('\r'), 'beautify output contains CR');
    assert.ok(!minified.includes('\r'), 'minify output contains CR');
    assert.ok(beautified.includes('\n'), 'beautify output missing LF');
    assert.ok(beautified.includes('to right'), 'multiline value corrupted');
    assert.ok(beautified.includes('/* inside */'), 'comment corrupted');
  });

  it('normalizes lone CR input to LF output', () => {
    resetEngine();
    const css = '.a {\r  color: red;\r}\r';
    const ast = parseCSS(css);
    const out = beautifyCSS(ast);
    assert.ok(!out.includes('\r'));
    assert.ok(out.includes('\n'));
  });
});

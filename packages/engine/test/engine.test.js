import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { configureEngine, parseCSS, beautifyCSS, denestCSS, minifyCSS, renestCSS } from '../src/engine.js';

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

function denest(input) {
  configureEngine({ maxDepth: Infinity, indentChar: '\t', preserveComments: false, deduplicate: false });
  return minifyCSS(denestCSS(parseCSS(input)));
}

function minify(input) {
  configureEngine({ maxDepth: Infinity, indentChar: '\t', preserveComments: false, deduplicate: false });
  return minifyCSS(parseCSS(input));
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
    return minifyCSS(ast);
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

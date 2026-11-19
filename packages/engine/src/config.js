export let _preserveComments = false;
export let _indentChar = '\t';
export let _maxDepth = Infinity;
export let _strategy = 'balanced';
export let _deduplicate = false;
export let _valueFormat = 'preserve';
export let _selectorStrategy = 'is';
export let _scopeStrategy = 'native';

export function configureEngine(opts = {}) {
  if (opts.preserveComments !== undefined) _preserveComments = opts.preserveComments;
  if (opts.indentChar !== undefined) _indentChar = opts.indentChar;
  if (opts.maxDepth !== undefined) _maxDepth = opts.maxDepth;
  if (opts.strategy !== undefined && ['balanced', 'maximize', 'flattened'].includes(opts.strategy)) _strategy = opts.strategy;
  if (opts.deduplicate !== undefined) _deduplicate = opts.deduplicate;
  if (opts.valueFormat !== undefined && ['preserve', 'auto-wrap', 'single-line'].includes(opts.valueFormat)) _valueFormat = opts.valueFormat;
  if (opts.selectorStrategy !== undefined && ['is', 'multiply'].includes(opts.selectorStrategy)) _selectorStrategy = opts.selectorStrategy;
  if (opts.scopeStrategy !== undefined && ['native', 'downlevel'].includes(opts.scopeStrategy)) _scopeStrategy = opts.scopeStrategy;
}

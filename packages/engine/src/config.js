export let _preserveComments = false;
export let _indentChar = '\t';
export let _maxDepth = Infinity;
export let _strategy = 'balanced';
export let _deduplicate = false;

export function configureEngine(opts = {}) {
  if (opts.preserveComments !== undefined) _preserveComments = opts.preserveComments;
  if (opts.indentChar !== undefined) _indentChar = opts.indentChar;
  if (opts.maxDepth !== undefined) _maxDepth = opts.maxDepth;
  if (opts.strategy !== undefined && ['balanced', 'maximize', 'flattened'].includes(opts.strategy)) _strategy = opts.strategy;
  if (opts.deduplicate !== undefined) _deduplicate = opts.deduplicate;
}

let _preserveComments = false;
let _indentChar = '\t';
let _maxDepth = Infinity;
let _strategy = 'balanced';
let _deduplicate = false;
export function configureEngine(opts = {}) {
  console.log('[CONFIGURE_ENGINE] Called with opts:', JSON.stringify(opts));
  console.log('[CONFIGURE_ENGINE] Current _deduplicate before:', _deduplicate);
  if (opts.preserveComments !== undefined) _preserveComments = opts.preserveComments;
  if (opts.indentChar !== undefined) _indentChar = opts.indentChar;
  if (opts.maxDepth !== undefined) _maxDepth = opts.maxDepth;
  if (opts.strategy !== undefined && ['balanced', 'maximize', 'flattened'].includes(opts.strategy)) _strategy = opts.strategy;
  if (opts.deduplicate !== undefined) _deduplicate = opts.deduplicate;
  console.log('[CONFIGURE_ENGINE] Current _deduplicate after:', _deduplicate);
}

function parseSelector(selectorText) {
    const groups = [{ parts: [], newlinesBefore: 0 }];
    let buffer = '';
    let pos = 0;
    const len = selectorText.length;
    const combinators = ['>', '+', '~'];

    let parenDepth = 0;
    let attributeDepth = 0;

    while (pos < len) {
        const char = selectorText[pos];

        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth--;
        else if (char === '[') attributeDepth++;
        else if (char === ']') attributeDepth--;

        if (parenDepth === 0 && attributeDepth === 0) {
            if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
                if (buffer) {
                    groups[groups.length - 1].parts.push(buffer);
                    buffer = '';
                }

                const lastGroup = groups[groups.length - 1];
                if (lastGroup.parts.length > 0) {
                    const lastPart = lastGroup.parts.at(-1);
                    if (lastPart !== ' ' && !combinators.includes(lastPart)) {
                        lastGroup.parts.push(' ');
                    }
                }
                
                pos++;
                continue;
            }

            if (combinators.includes(char) || char === ',') {
                if (buffer) {
                    groups[groups.length - 1].parts.push(buffer);
                    buffer = '';
                }
                
                const lastGroup = groups[groups.length - 1];
                if (lastGroup.parts.length > 0 && lastGroup.parts.at(-1) === ' ') {
                    lastGroup.parts.pop();
                }

                if (char === ',') {
                    pos++;
                    let newlines = 0;
                    let commentBuffer = '';
                    while (pos < len) {
                        const nextChar = selectorText[pos];
                        if (nextChar === '\n') {
                            newlines++;
                            pos++;
                        } else if (nextChar === ' ' || nextChar === '\t' || nextChar === '\r') {
                            pos++;
                        } else if (nextChar === '/' && selectorText[pos + 1] === '*') {
                            const commentStart = pos;
                            pos += 2;
                            while (pos < len && !(selectorText[pos] === '*' && selectorText[pos + 1] === '/')) {
                                pos++;
                            }
                            if (pos < len) pos += 2;
                            
                            if (commentBuffer) commentBuffer += ' ';
                            commentBuffer += selectorText.substring(commentStart, pos);
                        } else {
                            break;
                        }
                    }
                    
                    if (commentBuffer) {
                        lastGroup.commentAfter = commentBuffer.trim();
                    }

                    groups.push({ parts: [], newlinesBefore: Math.min(newlines, 1) });
                    continue;
                } else {
                    lastGroup.parts.push(char);
                }
                pos++;
                continue;
            }
        }

        buffer += char;
        pos++;
    }

    if (buffer) {
        groups[groups.length - 1].parts.push(buffer);
    }

    return groups.map(g => {
        if (g.parts.length > 0 && g.parts.at(-1) === ' ') {
            g.parts.pop();
        }
        return g;
    }).filter(g => g.parts.length > 0);
}

function parseValue(valueText) {
    const tokens = [];
    let buffer = '';
    let pos = 0;
    const len = valueText.length;
    let inString = null;
    let parenDepth = 0;

    const flushBuffer = () => {
        const trimmedBuffer = buffer.trim();
        if (trimmedBuffer) {
            tokens.push(trimmedBuffer);
        }
        buffer = '';
    };

    while (pos < len) {
        const char = valueText[pos];
        const prevChar = pos > 0 ? valueText[pos - 1] : null;

        if (char === '/' && valueText[pos + 1] === '*') {
            flushBuffer();
            const commentStart = pos;
            pos += 2;
            while (pos < len && !(valueText[pos] === '*' && valueText[pos + 1] === '/')) {
                pos++;
            }
            if (pos < len) {
                pos += 2;
            }
            tokens.push(valueText.substring(commentStart, pos));
            continue;
        }

        if (inString) {
            buffer += char;
            if (char === inString && prevChar !== '\\') {
                inString = null;
            }
        } else if (char === '"' || char === "'") {
            buffer += char;
            inString = char;
        } else if (char === '(') {
            parenDepth++;
            buffer += char;
        } else if (char === ')') {
            parenDepth--;
            buffer += char;
            if (parenDepth === 0) {
                flushBuffer();
            }
        } else if ((char === '/' || char === ',') && parenDepth === 0) {
            flushBuffer();
            tokens.push(char);
        } else if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
            if (parenDepth === 0) {
                flushBuffer();
            } else {
                if (buffer.length > 0 && !buffer.endsWith(' ')) {
                   buffer += ' ';
                }
            }
        } else {
            buffer += char;
        }
        pos++;
    }

    flushBuffer();
    return tokens;
}

export function parseCSS(cssString) {
    let pos = 0;
    const len = cssString.length;
    const root = { type: 'Stylesheet', body: [] };
    const stack = [root];

    while (pos < len) {
        const context = stack[stack.length - 1];
        const initSpacesAbove = -1;
        let spacesAbove = initSpacesAbove;

        while (pos < len) {
            const currentChar = cssString[pos];

            if (currentChar === ' ' || currentChar === '\t' || currentChar === '\r') {
                pos++;
                continue;
            } else if (currentChar === '\n') {
                spacesAbove++;
                pos++;
                continue;
            } else if (currentChar === '/' && cssString[pos + 1] === '*') {
                pos += 2;
                const commentStart = pos;
                while (pos < len && (cssString[pos] !== '*' || cssString[pos + 1] !== '/')) {
                    pos++;
                }

                if (_preserveComments) {
                    const lastNode = context.body.at(-1);

                    const isFirstNodeInBlock = typeof lastNode === 'undefined';
                    const isAfterDeclaration = lastNode?.type === 'Declaration';
                    const isInSpecialPosition = isFirstNodeInBlock || isAfterDeclaration;
                    const isInline = spacesAbove === initSpacesAbove;
                    
                    const shouldUseDefaultFormatterBehavior = isInSpecialPosition && isInline;
                    const clampedSpacesAbove = Math.max(0, Math.min(spacesAbove, 1));
                    
                    const commentNode = {
                        type: 'Comment',
                        value: cssString.substring(commentStart, pos).trim(),
                        spacesAbove: shouldUseDefaultFormatterBehavior ? initSpacesAbove : (['Rule', 'AtRule'].includes(lastNode?.type) ? 1 : clampedSpacesAbove)
                    };
                    context.body.push(commentNode);
                }

                if (pos < len) pos += 2;
                spacesAbove = initSpacesAbove;
            } else {
                break;
            }
        }
        
        if (pos >= len) break;
        if (cssString[pos] === '}') {
            stack.pop();
            pos++;
            continue;
        }

        let curlyFound = false;
        let parenDepth = 0;
        let inString = null;
        let segmentBuilder = '';

        while (pos < len) {
            const char = cssString[pos];

            if (inString) {
                if (char === inString && cssString[pos - 1] !== '\\') {
                    inString = null;
                }
            } else if (char === '"' || char === "'") {
                inString = char;
            } else if (char === '/' && cssString[pos + 1] === '*') {
                const commentStart = pos;
                pos += 2; 
                while (pos < len && (cssString[pos] !== '*' || cssString[pos + 1] !== '/')) {
                    pos++;
                }
                if (pos < len) pos += 2;

                if (_preserveComments) {
                    segmentBuilder += cssString.substring(commentStart, pos);
                }
                continue;
            } else if (char === '(') {
                parenDepth++;
            } else if (char === ')') {
                parenDepth--;
            } else if (parenDepth === 0) {
                if (char === '{') {
                    curlyFound = true;
                    break;
                }
                if (char === ';' || (char === '}' && context.type !== 'Stylesheet')) {
                    break;
                }
            }
            
            segmentBuilder += char;
            pos++;
        }
        
        const lastNode = context.body.at(-1);
        const segment = segmentBuilder.trim();

        const declarationSpacesAbove = Math.max(0, Math.min(spacesAbove, 1));
        if (typeof lastNode === 'undefined') spacesAbove = Math.max(-1, Math.min(spacesAbove, 1));
        else if (['Rule', 'AtRule'].includes(lastNode?.type)) spacesAbove = 1;
        else spacesAbove = Math.max(0, Math.min(spacesAbove, 1));

        const newNode = { spacesAbove };

        if (curlyFound) {
            newNode.body = [];
            
            if (segment.startsWith('@')) {
                const firstSpace = segment.indexOf(' ');

                newNode.type = 'AtRule';
                newNode.name = segment.substring(1, firstSpace === -1 ? segment.length : firstSpace);
                newNode.params = firstSpace === -1 ? '' : segment.substring(firstSpace + 1).trim();
            } else {
                newNode.type = 'Rule';
                newNode.selector = parseSelector(segment);
            }
            
            context.body.push(newNode);
            stack.push(newNode);
            pos++;
        } else { 
            if (segment.includes(':') && context.type !== 'Stylesheet') {
                const colonIndex = segment.indexOf(':');
                const property = segment.substring(0, colonIndex).trim();
                const value = segment.substring(colonIndex + 1).trim();
                
                newNode.type = 'Declaration';
                newNode.property = property;
                newNode.value = parseValue(value);
                newNode.spacesAbove = declarationSpacesAbove;
                
                context.body.push(newNode);
            } else if (segment.startsWith('@')) {
                const firstSpace = segment.indexOf(' ');

                newNode.type = 'AtRule';
                newNode.name = segment.substring(1, firstSpace === -1 ? segment.length : firstSpace);
                newNode.params = firstSpace === -1 ? '' : segment.substring(firstSpace + 1).trim();
                newNode.body = null;

                context.body.push(newNode);
            }
            
            if (pos < len && cssString[pos] === ';') {
                pos++;
            }
        }
    }

    return root;
}

function minifySelector(groups) {
    return groups.map(group => group.parts.join('')).join(',');
}

function minifyValue(tokens) {
    if (!tokens || tokens.length === 0) {
        return '';
    }

    const compressToken = (token) => {
        return token.replace(/,(\s+)/g, ',');
    };

    let result = compressToken(tokens[0]);

    for (let i = 1; i < tokens.length; i++) {
        const prevToken = tokens[i - 1];
        const token = compressToken(tokens[i]);

        const lastCharPrev = prevToken.slice(-1);
        const firstCharToken = token[0];

        let spaceNeeded = false;

        if (/[a-zA-Z0-9]/.test(lastCharPrev) && /[a-zA-Z0-9]/.test(firstCharToken)) {
            spaceNeeded = true;
        }
        else if (lastCharPrev === ')' && /[a-zA-Z0-9]/.test(firstCharToken)) {
            spaceNeeded = true;
        }
        else if (/[0-9]/.test(lastCharPrev) && firstCharToken === '.') {
            spaceNeeded = true;
        }
        else if (/[a-zA-Z%]/.test(lastCharPrev) && firstCharToken === '.') {
            spaceNeeded = true;
        }
        else if ((/[0-9a-zA-Z%]/.test(lastCharPrev) || lastCharPrev === ')') && 
                 firstCharToken === '-' && 
                 token.length > 1 && 
                 /[0-9.]/.test(token[1])) {
            spaceNeeded = true;
        }
        else if (lastCharPrev === '%' && /[a-zA-Z0-9.]/.test(firstCharToken)) {
            spaceNeeded = true;
        }

        if (spaceNeeded) {
            result += ' ';
        }
        result += token;
    }

    return result;
}

export function deduplicateCSS(ast, depth = 0) {
    const prefix = '  '.repeat(depth);
    console.group(`${prefix}[DEDUP] Enter deduplicateCSS depth=${depth}, nodeType=${ast?.type}, bodyLength=${ast?.body?.length}`);

    if (!ast || !ast.body) {
        console.log(`${prefix}[DEDUP] No body to process, returning`);
        console.groupEnd();
        return;
    }

    console.log(`${prefix}[DEDUP] Initial body items:`);
    ast.body.forEach((child, i) => {
        if (child.type === 'Rule') {
            const selStr = child.selector.map(g => g.parts.join('')).join(',');
            console.log(`${prefix}[DEDUP]   [${i}] Rule selector="${selStr}", body has ${child.body.length} items`);
        } else if (child.type === 'Declaration') {
            console.log(`${prefix}[DEDUP]   [${i}] Declaration ${child.property}: ${child.value.map?.(v => v)?.join(' ') || child.value}`);
        } else if (child.type === 'AtRule') {
            console.log(`${prefix}[DEDUP]   [${i}] AtRule @${child.name} ${child.params}, body=${child.body ? 'exists (' + child.body.length + ' items)' : 'null'}`);
        } else {
            console.log(`${prefix}[DEDUP]   [${i}] ${child.type}`);
        }
    });

    console.log(`${prefix}[DEDUP] === Step 1: Merge identical selector Rules ===`);
    const newBody = [];
    const ruleMap = new Map();

    for (let i = 0; i < ast.body.length; i++) {
        const child = ast.body[i];

        if (child.type === 'Rule') {
            const selStr = child.selector.map(g => g.parts.join('')).join(',');
            console.log(`${prefix}[DEDUP] Step1: Processing Rule at index ${i}, selector="${selStr}"`);
            if (ruleMap.has(selStr)) {
                const existingRule = ruleMap.get(selStr);
                console.log(`${prefix}[DEDUP] Step1: DUPLICATE selector "${selStr}"! Merging body (${existingRule.body.length} items + ${child.body.length} items)`);
                existingRule.body.push(...child.body);
                const index = newBody.indexOf(existingRule);
                if (index !== -1) {
                    console.log(`${prefix}[DEDUP] Step1: Removing existing rule from position ${index}, will re-push to end`);
                    newBody.splice(index, 1);
                }
                newBody.push(existingRule);
                console.log(`${prefix}[DEDUP] Step1: Merged rule now has ${existingRule.body.length} body items`);
            } else {
                console.log(`${prefix}[DEDUP] Step1: First occurrence of selector "${selStr}", adding to map`);
                ruleMap.set(selStr, child);
                newBody.push(child);
            }
        } else {
            console.log(`${prefix}[DEDUP] Step1: Non-Rule child at index ${i}, passing through`);
            newBody.push(child);
        }
    }

    ast.body = newBody;
    console.log(`${prefix}[DEDUP] After Step1, body has ${ast.body.length} items`);

    console.log(`${prefix}[DEDUP] === Step 2: Deduplicate Declarations ===`);
    const declMap = new Map();
    const blockBody = [];
    for (const child of ast.body) {
        if (child.type === 'Declaration') {
            const valStr = Array.isArray(child.value) ? child.value.join(' ') : String(child.value);
            console.log(`${prefix}[DEDUP] Step2: Processing Declaration: ${child.property}: ${valStr}`);
            if (declMap.has(child.property)) {
                const existing = declMap.get(child.property);
                const existingVal = Array.isArray(existing.value) ? existing.value.join(' ') : String(existing.value);
                console.log(`${prefix}[DEDUP] Step2: DUPLICATE property "${child.property}"! Removing earlier value="${existingVal}", keeping later value="${valStr}"`);
                const index = blockBody.indexOf(existing);
                if (index !== -1) {
                    console.log(`${prefix}[DEDUP] Step2: Removing earlier declaration at blockBody index ${index}`);
                    blockBody.splice(index, 1);
                }
            } else {
                console.log(`${prefix}[DEDUP] Step2: First occurrence of property "${child.property}"`);
            }
            declMap.set(child.property, child);
            blockBody.push(child);
        } else {
            console.log(`${prefix}[DEDUP] Step2: Non-Declaration child, passing through`);
            blockBody.push(child);
        }
    }
    ast.body = blockBody;
    console.log(`${prefix}[DEDUP] After Step2, body has ${ast.body.length} items`);

    console.log(`${prefix}[DEDUP] === Step 3: Recurse into nested Rules/AtRules ===`);
    for (const child of ast.body) {
        if (child.type === 'Rule' || child.type === 'AtRule') {
            const label = child.type === 'Rule'
                ? `Rule selector="${child.selector.map(g => g.parts.join('')).join(',')}"`
                : `AtRule @${child.name} ${child.params}`;
            console.log(`${prefix}[DEDUP] Step3: Recursing into ${label}`);
            deduplicateCSS(child, depth + 1);
        }
    }

    console.log(`${prefix}[DEDUP] Exit deduplicateCSS depth=${depth}`);
    console.groupEnd();
}

export function minifyCSS(ast) {
    console.log('[MINIFY_CSS] Called _deduplicate flag =', _deduplicate);
    if (_deduplicate) {
        console.log('[MINIFY_CSS] _deduplicate is TRUE, calling deduplicateCSS');
        console.log('[MINIFY_CSS] AST before dedup root body length:', ast?.body?.length);
        deduplicateCSS(ast);
        console.log('[MINIFY_CSS] AST after dedup root body length:', ast?.body?.length);
    } else {
        console.log('[MINIFY_CSS] _deduplicate is FALSE, skipping deduplicateCSS');
    }
    function _minify(node) {
        if (!node || !node.body) return '';
        return node.body.map(child => {
            switch (child.type) {
                case 'Comment':
                    return `/*${child.value}*/`;
                case 'Declaration':
                    return `${child.property}:${minifyValue(child.value)};`;
                case 'AtRule':
                    const atRuleString = `@${child.name}${child.params ? ' ' + child.params : ''}`;
                    if (child.body) {
                        let bodyContent = _minify(child);
                        if (bodyContent.at(-1) === ';') bodyContent = bodyContent.slice(0, -1);
                        return bodyContent ? `${atRuleString}{${bodyContent}}` : '';
                    } else {
                        return `${atRuleString};`;
                    }
                case 'Rule':
                    let bodyContent = _minify(child);
                    if (bodyContent.at(-1) === ';') bodyContent = bodyContent.slice(0, -1);
                    return bodyContent ? `${minifySelector(child.selector)}{${bodyContent}}` : '';
                default:
                    return '';
            }
        }).join('');
    }

    return _minify(ast);
}

function beautifyMathContent(content) {
    let result = '';
    let buffer = '';
    let pos = 0;
    const len = content.length;
    let parenDepth = 0;
    const operators = ['+', '-', '*', '/'];

    const flush = () => {
        if (buffer) {
            result += buffer;
            buffer = '';
        }
    };

    while (pos < len) {
        const char = content[pos];

        if (char === '(') {
            parenDepth++;
            buffer += char;
        } else if (char === ')') {
            parenDepth--;
            buffer += char;
        } else if (operators.includes(char) && parenDepth === 0) {
            flush();
            const lastChar = result.trim().at(-1);
            const isUnary = char === '-' && (!lastChar || ['(', '*', '/', '+', '-'].includes(lastChar));
            
            if (!isUnary) result = result.trimEnd() + ' ';
            result += char;
            if (!isUnary) result += ' ';

        } else {
            buffer += char;
        }
        pos++;
    }
    flush();
    return result.replace(/\s+/g, ' ').trim();
}

function beautifySelector(groups, indent) {
    let result = '';
    
    function stringifyGroup(parts) {
        const combinators = ['>', '+', '~'];
        let result = '';
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const prevPart = i > 0 ? parts[i - 1] : null;

            if (i > 0) {
                if (part === ' ' || combinators.includes(part) || (prevPart && combinators.includes(prevPart))) {
                    result += ' ';
                }
            }
            if (part !== ' ') {
                result += part;
            }
        }
        return result;
    }

    groups.forEach((group, index) => {
        result += stringifyGroup(group.parts);
        
        if (group.commentAfter) {
            result += ' ' + group.commentAfter;
        }

        if (index < groups.length - 1) {
            const nextGroup = groups[index + 1];
            result += ',';
            if (nextGroup.newlinesBefore === 1) {
                result += '\n';
                result += indent;
            } else {
                result += ' ';
            }
        }
    });
    return result;
}

function beautifyValue(valueTokens) {
    if (!valueTokens || valueTokens.length === 0) return '';
    const COMMA_PLACEHOLDER = '\x00COMMA\x00';
    
    const processedTokens = valueTokens.map(token => {
        const parenIndex = token.indexOf('(');
        if (parenIndex !== -1 && token.endsWith(')')) {
            const functionName = token.substring(0, parenIndex).toLowerCase().trim();
            const prefix = token.substring(0, parenIndex + 1);
            let content = token.substring(parenIndex + 1, token.length - 1);
            const suffix = ')';
            
            if (functionName === 'calc' || (functionName === '' && token.startsWith('(('))) {
                return prefix + beautifyMathContent(content) + suffix;
            }
            if (functionName === 'url') {
                content = content.trim().replace(/,/g, COMMA_PLACEHOLDER);
                return prefix + content + suffix;
            }
            return prefix + beautifyValue(parseValue(content)) + suffix;
        }
        return token;
    });

    return processedTokens.join(' ').replace(/\s*,\s*/g, ', ').replace(new RegExp(COMMA_PLACEHOLDER, 'g'), ',');
}

export function beautifyCSS(ast, initialIndent = '') {
    console.log('[BEAUTIFY_CSS] Called _deduplicate flag =', _deduplicate);
    if (_deduplicate) {
        console.log('[BEAUTIFY_CSS] _deduplicate is TRUE, calling deduplicateCSS');
        console.log('[BEAUTIFY_CSS] AST before dedup root body length:', ast?.body?.length);
        deduplicateCSS(ast);
        console.log('[BEAUTIFY_CSS] AST after dedup root body length:', ast?.body?.length);
    } else {
        console.log('[BEAUTIFY_CSS] _deduplicate is FALSE, skipping deduplicateCSS');
    }
    const indentChar = _indentChar;
    
    function _beautify(node, indent) {
        if (!node || !node.body) return '';
        let css = '';
        node.body.forEach((child) => {
            if (child.spacesAbove === -1) {
                css += ' ';
            } else {
                css += '\n'.repeat(child.spacesAbove + 1);
            }
            
            if (child.spacesAbove > -1) css += indent;

            switch (child.type) {
                case 'Comment':
                    css += `/* ${child.value} */`;
                    break;
                case 'Declaration':
                    css += `${child.property}: ${beautifyValue(child.value)};`;
                    break;
                case 'AtRule':
                    css += `@${child.name}${child.params ? ' ' + child.params : ''}`;
                    if (child.body) {
                        if (child.body.length > 0) {
                            css += ' {';
                            css += _beautify(child, indent + indentChar);
                            css += '\n' + indent + '}';
                        } else {
                            css += ' {}';
                        }
                    } else {
                        css += ';';
                    }
                    break;
                case 'Rule':
                    css += `${beautifySelector(child.selector, indent)}`;
                    if (child.body.length > 0) {
                        css += ' {';
                        css += _beautify(child, indent + indentChar);
                        css += '\n' + indent + '}';
                    } else {
                        css += ' {}';
                    }
                    break;
            }
        });
        return css;
    }

    return _beautify(ast, initialIndent).trim();
}

function cloneASTNode(node) {
    return JSON.parse(JSON.stringify(node));
}

function stringifySelectorForIs(groups) {
    return groups.map(group => group.parts.join('')).join(',');
}

function combineSelectors(parentGroups, childGroups) {
    const combinators = ['>', '+', '~'];

    if (!parentGroups || parentGroups.length === 0) {
        return childGroups.map(g => {
            const newParts = g.parts.map(p => p.replace(/&/g, ':root'));
            return { ...g, parts: newParts };
        });
    }

    const newSelectorGroups = [];
    const parentIsList = parentGroups.length > 1;

    const parentReplacementStr = stringifySelectorForIs(parentGroups);
    const parentHasTypeSelector = parentGroups.some(g => g.parts.some(p => /^[a-zA-Z]/.test(p) && p !== ' ' && p !== '>' && p !== '+' && p !== '~'));
    
    const subsequentWrapper = (str) => parentHasTypeSelector ? `:is(${str})` : str;

    for (const childGroup of childGroups) {
        const hasAmpersand = childGroup.parts.some(p => p.includes('&'));

        if (!hasAmpersand) {
            const parentParts = parentIsList ? [`:is(${parentReplacementStr})`] : parentGroups[0].parts;
            const childStartsWithCombinator = combinators.includes(childGroup.parts[0]);

            const newGroup = {
                parts: childStartsWithCombinator ? [...parentParts, ...childGroup.parts] : [...parentParts, ' ', ...childGroup.parts],
                newlinesBefore: 0,
                commentAfter: childGroup.commentAfter
            };
            newSelectorGroups.push(newGroup);
            continue;
        }

        let combinedString = '';
        for (const part of childGroup.parts) {
            if (part.includes('&')) {
                let isFirstAmpersand = true;
                const replacedPart = part.replace(/&/g, () => {
                    if (isFirstAmpersand) {
                        isFirstAmpersand = false;
                        return parentReplacementStr;
                    }
                    return subsequentWrapper(parentReplacementStr);
                });
                combinedString += replacedPart;
            } else {
                combinedString += part;
            }
        }
        
        const reparsedGroups = parseSelector(combinedString);
        reparsedGroups.forEach(g => {
            g.commentAfter = childGroup.commentAfter;
        });
        newSelectorGroups.push(...reparsedGroups);
    }

    return newSelectorGroups;
}

export function denestCSS(ast) {
    function _denest(nodes, context) {
        if (!Array.isArray(nodes)) {
            return [];
        }

        const denestedNodes = [];
        let pendingDeclarations = [];

        const flushDeclarations = () => {
            if (pendingDeclarations.length > 0) {
                if (context.selector) {
                    const rule = {
                        type: 'Rule',
                        selector: cloneASTNode(context.selector),
                        body: pendingDeclarations,
                        spacesAbove: denestedNodes.length === 0 ? 0 : 1
                    };
                    denestedNodes.push(rule);
                } else {
                    denestedNodes.push(...pendingDeclarations.filter(n => n.type === 'Comment'));
                }
            }
            pendingDeclarations = [];
        };

        for (const node of nodes) {
            if (node.type === 'Declaration' || node.type === 'Comment') {
                pendingDeclarations.push(cloneASTNode(node));
                continue;
            }
            
            flushDeclarations();

            if (node.type === 'Rule') {
                const newSelector = combineSelectors(context.selector, node.selector);
                const newContext = { ...context, selector: newSelector };
                const childNodes = _denest(node.body, newContext);
                
                if (childNodes.length > 0) {
                    if (denestedNodes.length > 0 && ['Rule', 'AtRule'].includes(denestedNodes.at(-1)?.type)) {
                        if (childNodes[0].spacesAbove === 0) childNodes[0].spacesAbove = 1;
                    }
                    denestedNodes.push(...childNodes);
                } else if (node.body.length === 0) {
                    const emptyRule = {
                        type: 'Rule',
                        selector: cloneASTNode(newSelector),
                        body: [],
                        spacesAbove: denestedNodes.length > 0 && ['Rule', 'AtRule'].includes(denestedNodes.at(-1)?.type) ? 1 : 0
                    };
                    denestedNodes.push(emptyRule);
                }
            }

            if (node.type === 'AtRule') {
                let combinedAtRuleParams = node.params;
                if (context.atRule && context.atRule.name === 'media' && node.name === 'media') {
                     combinedAtRuleParams = `${context.atRule.params} and (${node.params})`;
                }
                
                const newAtRuleContext = { name: node.name, params: combinedAtRuleParams };
                
                const childContext = {
                    selector: context.selector,
                    atRule: newAtRuleContext,
                };
                
                const childNodes = _denest(node.body, childContext);

                if (childNodes.length > 0) {
                    const atRuleWrapper = cloneASTNode(node);
                    atRuleWrapper.params = combinedAtRuleParams;
                    atRuleWrapper.body = childNodes;
                    if (denestedNodes.length > 0) atRuleWrapper.spacesAbove = 1;
                    denestedNodes.push(atRuleWrapper);
                } else if (node.body === null) {
                    denestedNodes.push(cloneASTNode(node));
                } else if (node.body.length === 0) {
                    const emptyAtRule = cloneASTNode(node);
                    emptyAtRule.params = combinedAtRuleParams;
                    emptyAtRule.body = [];
                    if (denestedNodes.length > 0) emptyAtRule.spacesAbove = 1;
                    denestedNodes.push(emptyAtRule);
                }
            }
        }

        flushDeclarations();

        return denestedNodes;
    }

    const newRoot = cloneASTNode(ast);
    newRoot.body = _denest(ast.body, { selector: null, atRule: null });
    return newRoot;
}

function stringifySelector(groups) {
    if (groups._str) return groups._str;
    groups._str = groups.map(g => {
        if (!g._str) g._str = g.parts.join('');
        return g._str;
    }).join(',');
    return groups._str;
}

function findNestingRelationship(parentGroups, childGroups) {
    const parentStr = stringifySelector(parentGroups);
    const childStr = stringifySelector(childGroups);

    if (parentStr === childStr) {
        return { type: 'MERGE', newSelector: parentGroups };
    }

    if (parentGroups.length > 1 && childGroups.length === 1) {
        const childGroup = childGroups[0];
        const firstRel = findSingleGroupNestingRelationship(parentGroups[0], childGroup);
        if (!firstRel) return null;

        const firstRelStr = stringifySelector(firstRel.newSelector);

        for (let i = 1; i < parentGroups.length; i++) {
            const rel = findSingleGroupNestingRelationship(parentGroups[i], childGroup);
            if (!rel || rel.type !== firstRel.type || stringifySelector(rel.newSelector) !== firstRelStr) {
                return null;
            }
        }
        return firstRel;
    }

    if (parentGroups.length === childGroups.length) {
        const relationships = [];
        for (let i = 0; i < childGroups.length; i++) {
            const rel = findSingleGroupNestingRelationship(parentGroups[i], childGroups[i]);
            if (!rel) return null;
            relationships.push(rel);
        }

        const firstRel = relationships[0];
        const firstRelStr = stringifySelector(firstRel.newSelector);
        if (relationships.every(rel => rel.type === firstRel.type && stringifySelector(rel.newSelector) === firstRelStr)) {
            return firstRel;
        }
        return null;
    }

    if (parentGroups.length === 1) {
        const parentGroup = parentGroups[0];
        const relationships = [];
        for (const childGroup of childGroups) {
            const rel = findSingleGroupNestingRelationship(parentGroup, childGroup);
            if (!rel) return null;
            relationships.push(rel);
        }

        const firstRel = relationships[0];
        if (relationships.every(rel => rel.type === firstRel.type)) {
            return {
                type: firstRel.type,
                newSelector: relationships.flatMap(rel => rel.newSelector)
            };
        }
    }

    return null;
}

function findSingleGroupNestingRelationship(parentGroup, childGroup) {
    const parentParts = parentGroup.parts;
    const childParts = childGroup.parts;
    if (!parentGroup._str) parentGroup._str = parentParts.join('');
    const parentStr = parentGroup._str;

    const combinators = ['>', '+', '~'];

    let isMatch = childParts.length > parentParts.length;
    if (isMatch) {
        for (let i = 0; i < parentParts.length; i++) {
            if (childParts[i] !== parentParts[i]) {
                isMatch = false;
                break;
            }
        }
    }

    if (isMatch) {
        const nextPart = childParts[parentParts.length];
        if (nextPart === ' ' || combinators.includes(nextPart)) {
            const newParts = childParts.slice(parentParts.length);
            if (newParts[0] === ' ') newParts.shift();
            return { type: 'NEST', newSelector: [{ parts: newParts, newlinesBefore: 0 }] };
        }
    }

    let isCompoundMatch = childParts.length >= parentParts.length;
    if (isCompoundMatch) {
        for (let i = 0; i < parentParts.length - 1; i++) {
            if (childParts[i] !== parentParts[i]) {
                isCompoundMatch = false;
                break;
            }
        }
    }
    if (isCompoundMatch) {
        const lastParentPart = parentParts.at(-1);
        const correspondingChildPart = childParts[parentParts.length - 1];
        if (correspondingChildPart.startsWith(lastParentPart) && correspondingChildPart.length > lastParentPart.length) {
            const remainder = correspondingChildPart.substring(lastParentPart.length);
            if (!/[a-zA-Z0-9_-]/.test(remainder[0])) {
                const newParts = ['&' + remainder, ...childParts.slice(parentParts.length)];
                return { type: 'NEST', newSelector: [{ parts: newParts, newlinesBefore: 0 }] };
            }
        }
    }

    if (childParts.length > parentParts.length) {
        const hasAmpersandRef = childParts.some(p => typeof p === 'string' && p.startsWith('&'));
        if (!hasAmpersandRef) {
            let isReverseMatch = true;
            for (let i = 0; i < parentParts.length; i++) {
                if (childParts[childParts.length - parentParts.length + i] !== parentParts[i]) {
                    isReverseMatch = false;
                    break;
                }
            }

            if (isReverseMatch) {
                const prevPart = childParts[childParts.length - parentParts.length - 1];
                if (prevPart === ' ' || combinators.includes(prevPart)) {
                    const newParts = [...childParts.slice(0, childParts.length - parentParts.length), '&'];
                    return { type: 'REVERSE_NEST', newSelector: [{ parts: newParts, newlinesBefore: 0 }] };
                }
            }
        }
    }

    return null;
}

export function renestCSS(ast) {
    function scoreMatch(parentNode, relationship) {
        let score = 0;
        for (const group of parentNode.selector) {
            score += group.parts.length;
        }
        const typeOrder = relationship.type === 'MERGE' ? 0 : relationship.type === 'NEST' ? 1 : 2;
        return { typeOrder, score };
    }

    function _renest(node, depth = 0) {
        if (!node.body || node.body.length === 0) {
            return;
        }
        
        const body = node.body;
        const n = body.length;
        const parentOf = new Int32Array(n).fill(-1);
        const rels = new Array(n);

        function getDepth(nodeIndex, parentArray) {
            let d = 0;
            let cur = parentArray[nodeIndex];
            while (cur !== -1) {
                d++;
                cur = parentArray[cur];
            }
            return d;
        }

        const firstTokenMap = new Map();
        const lastTokenMap = new Map();
        for (let i = 0; i < n; i++) {
            const rule = body[i];
            if (rule.type === 'Rule') {
                for (const group of rule.selector) {
                    const first = group.parts[0];
                    const last = group.parts.at(-1);
                    if (!firstTokenMap.has(first)) firstTokenMap.set(first, []);
                    firstTokenMap.get(first).push(i);
                    if (!lastTokenMap.has(last)) lastTokenMap.set(last, []);
                    lastTokenMap.get(last).push(i);
                }
            }
        }
        const sortedFirstTokens = Array.from(firstTokenMap.keys()).sort();

        const candidateMarks = new Uint32Array(n);
        let currentMark = 0;
        const candidates = [];

        for (let i = 0; i < n; i++) {
            const parentNode = body[i];
            
            if (parentNode.type === 'Rule') {
                currentMark++;
                const parentSelector = parentNode.selector;
                for (const group of parentSelector) {
                    const first = group.parts[0];
                    const last = group.parts.at(-1);

                    let low = 0, high = sortedFirstTokens.length - 1;
                    let start = -1;
                    while (low <= high) {
                        let mid = (low + high) >> 1;
                        if (sortedFirstTokens[mid] >= first) {
                            start = mid;
                            high = mid - 1;
                        } else {
                            low = mid + 1;
                        }
                    }

                    if (start !== -1) {
                        for (let k = start; k < sortedFirstTokens.length; k++) {
                            const token = sortedFirstTokens[k];
                            if (!token.startsWith(first)) break;
                            const list = firstTokenMap.get(token);
                            for (let m = 0; m < list.length; m++) {
                                const idx = list[m];
                                if (idx !== i) candidateMarks[idx] = currentMark;
                            }
                        }
                    }

                    const reverseList = lastTokenMap.get(last);
                    if (reverseList) {
                        for (let k = 0; k < reverseList.length; k++) {
                            const idx = reverseList[k];
                            if (idx !== i) candidateMarks[idx] = currentMark;
                        }
                    }
                }

                for (let j = 0; j < n; j++) {
                    if (j !== i && candidateMarks[j] === currentMark && parentOf[j] === -1) {
                        const potentialChild = body[j];
                        const relationship = findNestingRelationship(parentSelector, potentialChild.selector);

                        if (relationship) {
                            if (relationship.type === 'MERGE' && j < i) continue;

                            const score = scoreMatch(parentNode, relationship);
                            candidates.push({ childIdx: j, parentIdx: i, score, relationship });
                        }
                    }
                }
            }
        }

        console.log(`\n[DEBUG RENEST] Found ${candidates.length} nesting candidates. Sorting...`);
        candidates.sort((a, b) => {
            if (a.score.typeOrder !== b.score.typeOrder) return a.score.typeOrder - b.score.typeOrder;
            if (a.score.score !== b.score.score) return b.score.score - a.score.score;
            return a.parentIdx - b.parentIdx;
        });

        for (let idx = 0; idx < candidates.length; idx++) {
            const c = candidates[idx];
            console.log(`[DEBUG RENEST] Candidate ${idx}: child=${c.childIdx}, parent=${c.parentIdx}, relType=${c.relationship.type}, score=${c.score.score}`);
        }

        console.log(`\n[DEBUG RENEST] Assigning parents based on candidates...`);
        for (const c of candidates) {
            if (parentOf[c.childIdx] === -1) {
                parentOf[c.childIdx] = c.parentIdx;
                rels[c.childIdx] = c.relationship;
                console.log(`[DEBUG RENEST] -> Assigned parentOf[${c.childIdx}] = ${c.parentIdx}`);
            } else {
                console.log(`[DEBUG RENEST] -> Skipped child ${c.childIdx} (already has parent ${parentOf[c.childIdx]})`);
            }
        }

        function getAncestorAtDepth(nodeIdx, parentArray, targetDepth) {
            let currentIdx = nodeIdx;
            const path = [];
            while (currentIdx !== -1) {
                path.push(currentIdx);
                currentIdx = parentArray[currentIdx];
            }
            path.reverse();
            if (targetDepth >= 0 && targetDepth < path.length - 1) {
                return path[targetDepth];
            }
            return -1;
        }

        const effectiveMaxDepth = _maxDepth === Infinity ? Infinity : _maxDepth - 1;

        console.log(`\n[DEBUG RENEST] Starting depth adjustment loop.`);
        console.log(`[DEBUG RENEST] _maxDepth: ${_maxDepth}, effectiveMaxDepth: ${effectiveMaxDepth}, _strategy: ${_strategy}`);

        let depthChanged = true;
        let passCounter = 0;
        
        while (depthChanged) {
            passCounter++;
            console.log(`\n[DEBUG RENEST] --- Pass ${passCounter} ---`);
            depthChanged = false;
            
            const treeMaxDepth = new Int32Array(n).fill(0);
            
            console.log(`[DEBUG RENEST] Calculating treeMaxDepth for ${n} nodes...`);
            for (let i = 0; i < n; i++) {
                if (parentOf[i] !== -1) {
                    let d = getDepth(i, parentOf);
                    let cur = i;
                    while (parentOf[cur] !== -1) {
                        cur = parentOf[cur];
                    }
                    if (d > treeMaxDepth[cur]) {
                        treeMaxDepth[cur] = d;
                    }
                }
            }

            for (let i = 0; i < n; i++) {
                if (treeMaxDepth[i] > 0 || parentOf[i] === -1) {
                    console.log(`[DEBUG RENEST] Tree Root ${i} -> max descendants depth: ${treeMaxDepth[i]}`);
                }
            }

            const cutRoots = new Set();

            for (let i = 0; i < n; i++) {
                if (parentOf[i] !== -1) {
                    let curRoot = i;
                    let cur = i;
                    while (parentOf[cur] !== -1) { cur = parentOf[cur]; }
                    curRoot = cur;

                    const dynamicDepth = getDepth(i, parentOf);
                    const totalDepth = depth + dynamicDepth;
                    
                    let limit = effectiveMaxDepth;
                    let cValue = 1;
                    let nValue = 0;

                    if (_strategy === 'balanced' && effectiveMaxDepth !== Infinity) {
                        const M = treeMaxDepth[curRoot];
                        nValue = M + 1;
                        const MaxN = effectiveMaxDepth + 1;
                        cValue = Math.ceil(nValue / MaxN);
                        if (cValue > 1) {
                            limit = Math.floor(nValue / cValue) - 1;
                        }
                    }

                    console.log(`[DEBUG RENEST] Node ${i} | parentOf: ${parentOf[i]} | curRoot: ${curRoot} | dynamicDepth: ${dynamicDepth} | totalDepth: ${totalDepth} | limit: ${limit} (N=${nValue}, C=${cValue})`);

                    if (totalDepth > limit) {
                        if (cutRoots.has(curRoot)) {
                            console.log(`[DEBUG RENEST] -> Node ${i} exceeds limit, but root ${curRoot} already cut in this pass. Skipping.`);
                            continue;
                        }

                        console.log(`[DEBUG RENEST] -> Node ${i} EXCEEDS limit! (totalDepth ${totalDepth} > ${limit})`);
                        cutRoots.add(curRoot);
                        
                        if (_strategy === 'flattened' && _maxDepth !== Infinity) {
                            const targetAncestorDepth = _maxDepth - 2;
                            if (targetAncestorDepth >= 0) {
                                const ancestorIdx = getAncestorAtDepth(i, parentOf, targetAncestorDepth);
                                console.log(`[DEBUG RENEST] -> Flattened strategy: targetAncestorDepth ${targetAncestorDepth}, ancestorIdx ${ancestorIdx}`);
                                if (ancestorIdx !== -1 && ancestorIdx !== parentOf[i]) {
                                    const newRel = findNestingRelationship(body[ancestorIdx].selector, body[i].selector);
                                    if (newRel) {
                                        console.log(`[DEBUG RENEST] -> Reparenting node ${i} to ancestor ${ancestorIdx}`);
                                        parentOf[i] = ancestorIdx;
                                        rels[i] = newRel;
                                        depthChanged = true;
                                        continue;
                                    } else {
                                        console.log(`[DEBUG RENEST] -> Could not find valid nesting relationship for reparenting.`);
                                    }
                                }
                            }
                        }

                        console.log(`[DEBUG RENEST] -> Cutting node ${i} from parent ${parentOf[i]}`);
                        parentOf[i] = -1;
                        rels[i] = null;
                        depthChanged = true;
                    }
                }
            }
            console.log(`[DEBUG RENEST] End of Pass ${passCounter}. depthChanged = ${depthChanged}`);
        }
        console.log(`[DEBUG RENEST] Depth adjustment complete.`);

        const newBody = [];
        for (let i = 0; i < n; i++) {
            if (parentOf[i] === -1) {
                newBody.push(body[i]);
            } else {
                const parentIdx = parentOf[i];
                const parentNode = body[parentIdx];
                const childNode = body[i];
                const rel = rels[i];

                parentNode.body = parentNode.body || [];
                if (rel.type === 'MERGE') {
                    const topMostRule = childNode.body.find((node) => ['Rule', 'AtRule'].includes(node.type));
                    if (parentNode.body.length > 0 && topMostRule) topMostRule.spacesAbove = 1;
                    parentNode.body.push(...childNode.body);
                } else {
                    childNode.selector = rel.newSelector;
                    parentNode.body.push(childNode);
                }
            }
        }
        node.body = newBody;

        for (const childNode of node.body) {
            if (childNode.type === 'Rule' || (childNode.type === 'AtRule' && childNode.body)) {
                _renest(childNode, depth + 1);
            }
        }
    }

    _renest(ast, 0);
    return ast;
}

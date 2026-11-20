import { _preserveComments, _indentChar, _maxDepth, _strategy, _deduplicate, _valueFormat, _selectorStrategy, _scopeStrategy, _selectorWidth, _selectorSingleLine, configureEngine } from './config.js';
export { configureEngine } from './config.js';

const NESTING_COMBINATORS = ['>', '+', '~', '||'];

/**
 * Returns the index just past the CSS escape sequence that starts at `pos`
 * (which must point at a backslash). Handles hex escapes with an optional
 * trailing whitespace terminator, escaped newlines, and single-character
 * escapes, including surrogate pairs.
 */
function consumeEscape(text, pos) {
    let i = pos + 1;
    if (i >= text.length) return i;

    const char = text[i];

    if (char === '\n' || char === '\f') return i + 1;
    if (char === '\r') return text[i + 1] === '\n' ? i + 2 : i + 1;

    if (/[0-9a-fA-F]/.test(char)) {
        let digits = 0;
        while (i < text.length && digits < 6 && /[0-9a-fA-F]/.test(text[i])) {
            i++;
            digits++;
        }
        if (i < text.length && (text[i] === ' ' || text[i] === '\t' || text[i] === '\r' || text[i] === '\n' || text[i] === '\f')) {
            if (text[i] === '\r' && text[i + 1] === '\n') i += 2;
            else i++;
        }
        return i;
    }

    const codePoint = text.codePointAt(i);
    return i + (codePoint > 0xFFFF ? 2 : 1);
}

/**
 * Rebuilds a single selector part while replacing every real nesting selector
 * (`&`) with the result of `replace`. Literal ampersands inside strings,
 * attribute selectors, comments, and escape sequences are left untouched.
 *
 * `replace` receives whether the `&` starts a new compound selector, which
 * lets callers use a plain parent selector where concatenation is safe and an
 * `:is(...)` wrapper where it is not.
 */
function transformNestingSelectors(part, replace) {
    let result = '';
    let pos = 0;
    let compoundStart = true;
    let attributeDepth = 0;
    let inString = null;

    while (pos < part.length) {
        const char = part[pos];

        if (inString) {
            if (char === '\\' && pos + 1 < part.length) {
                const end = consumeEscape(part, pos);
                result += part.slice(pos, end);
                pos = end;
                continue;
            }
            result += char;
            if (char === inString) inString = null;
            pos++;
            continue;
        }

        if (char === '/' && part[pos + 1] === '*') {
            const commentEnd = part.indexOf('*/', pos + 2);
            const end = commentEnd === -1 ? part.length : commentEnd + 2;
            result += part.slice(pos, end);
            pos = end;
            continue;
        }

        if (char === '\\') {
            const end = consumeEscape(part, pos);
            result += part.slice(pos, end);
            pos = end;
            compoundStart = false;
            continue;
        }

        if (char === '"' || char === "'") {
            inString = char;
            result += char;
            pos++;
            compoundStart = false;
            continue;
        }

        if (char === '[') {
            attributeDepth++;
            result += char;
            pos++;
            compoundStart = false;
            continue;
        }

        if (char === ']') {
            if (attributeDepth > 0) attributeDepth--;
            result += char;
            pos++;
            compoundStart = false;
            continue;
        }

        if (char === '&' && attributeDepth === 0) {
            result += replace(compoundStart);
            pos++;
            compoundStart = false;
            continue;
        }

        // `||` is the Selectors 4 column combinator. Treat it like the
        // other combinators when deciding whether `&` starts a compound.
        if (char === '|' && part[pos + 1] === '|' && attributeDepth === 0) {
            result += '||';
            pos += 2;
            compoundStart = true;
            continue;
        }

        result += char;

        if (char === ' ' || char === '\t' || char === '\r' || char === '\n'
            || NESTING_COMBINATORS.includes(char) || char === ',' || char === '(') {
            compoundStart = true;
        } else {
            compoundStart = false;
        }

        pos++;
    }

    return result;
}

function partHasNestingSelector(part) {
    let found = false;
    transformNestingSelectors(part, () => {
        found = true;
        return '&';
    });
    return found;
}

function parseSelector(selectorText) {
    const groups = [{ parts: [], newlinesBefore: 0 }];
    let buffer = '';
    let pos = 0;
    const len = selectorText.length;
    const combinators = NESTING_COMBINATORS;

    let parenDepth = 0;
    let attributeDepth = 0;
    let inString = null;

    while (pos < len) {
        const char = selectorText[pos];

        if (inString) {
            if (char === '\\' && pos + 1 < len) {
                const end = consumeEscape(selectorText, pos);
                buffer += selectorText.slice(pos, end);
                pos = end;
                continue;
            }
            buffer += char;
            if (char === inString) inString = null;
            pos++;
            continue;
        }

        if (char === '/' && selectorText[pos + 1] === '*') {
            const commentEnd = selectorText.indexOf('*/', pos + 2);
            const end = commentEnd === -1 ? len : commentEnd + 2;
            buffer += selectorText.slice(pos, end);
            pos = end;
            continue;
        }

        if (char === '\\') {
            const end = consumeEscape(selectorText, pos);
            buffer += selectorText.slice(pos, end);
            pos = end;
            continue;
        }

        if (char === '"' || char === "'") {
            inString = char;
            buffer += char;
            pos++;
            continue;
        }

        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
        else if (char === '[') attributeDepth++;
        else if (char === ']') attributeDepth = Math.max(0, attributeDepth - 1);

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

            if (char === '|' && selectorText[pos + 1] === '|') {
                if (buffer) {
                    groups[groups.length - 1].parts.push(buffer);
                    buffer = '';
                }

                const lastGroup = groups[groups.length - 1];
                if (lastGroup.parts.length > 0 && lastGroup.parts.at(-1) === ' ') {
                    lastGroup.parts.pop();
                }
                lastGroup.parts.push('||');
                pos += 2;
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

        if (inString) {
            if (char === '\\' && pos + 1 < len) {
                const end = consumeEscape(valueText, pos);
                buffer += valueText.slice(pos, end);
                pos = end;
                continue;
            }
            buffer += char;
            if (char === inString) inString = null;
            pos++;
            continue;
        }

        if (char === '"' || char === "'") {
            buffer += char;
            inString = char;
            pos++;
            continue;
        }

        if (char === '\\') {
            const end = consumeEscape(valueText, pos);
            buffer += valueText.slice(pos, end);
            pos = end;
            continue;
        }

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

        if (char === '(') {
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

/**
 * Finds the first top-level `:` in a declaration-like text, skipping strings,
 * comments, escapes, parentheses and attribute brackets. Returns -1 when there
 * is no such colon.
 */
function findTopLevelColon(text) {
    let parenDepth = 0;
    let attributeDepth = 0;
    let inString = null;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inString) {
            if (char === '\\' && i + 1 < text.length) {
                i = consumeEscape(text, i) - 1;
                continue;
            }
            if (char === inString) inString = null;
            continue;
        }

        if (char === '"' || char === "'") {
            inString = char;
            continue;
        }

        if (char === '\\') {
            i = consumeEscape(text, i) - 1;
            continue;
        }

        if (char === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            i = end === -1 ? text.length : end + 1;
            continue;
        }

        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
        else if (char === '[') attributeDepth++;
        else if (char === ']') attributeDepth = Math.max(0, attributeDepth - 1);
        else if (char === ':' && parenDepth === 0 && attributeDepth === 0) return i;
    }

    return -1;
}

/**
 * True when the text collected so far is a custom property whose value starts
 * with a `{}` block, e.g. `--x: { color: red }`. Custom properties are the only
 * declarations whose values may contain curly blocks, so those braces belong to
 * the value instead of starting a nested rule.
 */
function startsCustomPropertyBlock(text) {
    const colonIndex = findTopLevelColon(text);
    if (colonIndex === -1) return false;
    const property = text.slice(0, colonIndex).trim();
    const rest = text.slice(colonIndex + 1).trim();
    return property.startsWith('--') && rest === '';
}

/**
 * Splits an at-rule prelude into its name and parameters. CSS allows the
 * parameters to start immediately after the at-keyword (for example
 * `@media(min-width: 40em)`) and allows comments to separate tokens, so the
 * split must happen at the end of the identifier rather than at the first
 * space.
 */
function splitAtRuleSegment(segment) {
    let pos = 1;

    while (pos < segment.length) {
        const char = segment[pos];

        if (char === '\\') {
            pos = consumeEscape(segment, pos);
            continue;
        }

        if (/[a-zA-Z0-9_-]/.test(char) || char.codePointAt(0) > 0x7F) {
            pos++;
            continue;
        }

        break;
    }

    return {
        name: segment.slice(1, pos),
        params: segment.slice(pos).trim()
    };
}

export function parseCSS(cssString) {
    // Normalize all line endings to LF so mixed CRLF/CR input never
    // corrupts AST line capture or formatting output.
    cssString = String(cssString).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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
            } else if (context.type === 'Stylesheet' && cssString.startsWith('<!--', pos)) {
                // CDO token: ignored only in the top-level stylesheet.
                pos += 4;
            } else if (context.type === 'Stylesheet' && cssString.startsWith('-->', pos)) {
                // CDC token: ignored only in the top-level stylesheet.
                pos += 3;
            } else if (currentChar === '/' && cssString[pos + 1] === '*') {
                pos += 2;
                const commentStart = pos;
                while (pos < len && (cssString[pos] !== '*' || cssString[pos + 1] !== '/')) {
                    pos++;
                }

                const isBangComment = cssString.substring(commentStart, pos).trimStart().startsWith('!');
                if (_preserveComments || isBangComment) {
                    const lastNode = context.body.at(-1);

                    const isFirstNodeInBlock = typeof lastNode === 'undefined';
                    const isAfterDeclaration = lastNode?.type === 'Declaration';
                    const isInSpecialPosition = isFirstNodeInBlock || isAfterDeclaration;
                    const isInline = spacesAbove === initSpacesAbove;
                    
                    const shouldUseDefaultFormatterBehavior = isInSpecialPosition && isInline;
                    const clampedSpacesAbove = Math.max(0, Math.min(spacesAbove, 1));
                    
                    const commentEnd = pos < len ? pos + 2 : len;
                    const commentNode = {
                        type: 'Comment',
                        value: cssString.substring(commentStart, pos).trim(),
                        // Keep the full original comment so the beautifier can
                        // preserve its multiline shape and indentation.
                        raw: cssString.substring(commentStart - 2, commentEnd),
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
                if (char === '\\' && pos + 1 < len) {
                    const end = consumeEscape(cssString, pos);
                    segmentBuilder += cssString.slice(pos, end);
                    pos = end;
                    continue;
                }
                segmentBuilder += char;
                if (char === inString) inString = null;
                pos++;
                continue;
            }

            if (char === '"' || char === "'") {
                inString = char;
                segmentBuilder += char;
                pos++;
                continue;
            }

            if (char === '\\') {
                const end = consumeEscape(cssString, pos);
                segmentBuilder += cssString.slice(pos, end);
                pos = end;
                continue;
            }

            if (char === '/' && cssString[pos + 1] === '*') {
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
                parenDepth = Math.max(0, parenDepth - 1);
            } else if (parenDepth === 0) {
                if (char === '{') {
                    if (startsCustomPropertyBlock(segmentBuilder)) {
                        // Custom property values may contain `{}` blocks; keep the
                        // whole balanced block as part of the declaration value.
                        segmentBuilder += char;
                        pos++;
                        let braceDepth = 1;
                        while (pos < len && braceDepth > 0) {
                            const blockChar = cssString[pos];

                            if (inString) {
                                segmentBuilder += blockChar;
                                if (blockChar === '\\' && pos + 1 < len) {
                                    const end = consumeEscape(cssString, pos);
                                    segmentBuilder += cssString.slice(pos + 1, end);
                                    pos = end;
                                    continue;
                                }
                                if (blockChar === inString) inString = null;
                                pos++;
                                continue;
                            }

                            if (blockChar === '"' || blockChar === "'") {
                                inString = blockChar;
                                segmentBuilder += blockChar;
                                pos++;
                                continue;
                            }

                            if (blockChar === '\\') {
                                const end = consumeEscape(cssString, pos);
                                segmentBuilder += cssString.slice(pos, end);
                                pos = end;
                                continue;
                            }

                            if (blockChar === '/' && cssString[pos + 1] === '*') {
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
                            }

                            if (blockChar === '{') braceDepth++;
                            else if (blockChar === '}') braceDepth--;

                            segmentBuilder += blockChar;
                            pos++;
                        }
                        continue;
                    }

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
        const rawSegment = segmentBuilder;
        const segment = rawSegment.trim();
        const leadingTrim = rawSegment.length - rawSegment.trimStart().length;

        const declarationSpacesAbove = Math.max(0, Math.min(spacesAbove, 1));
        const lastHasComment = lastNode !== undefined && (
            String(lastNode.property ?? '').includes('/*') ||
            JSON.stringify(lastNode.value ?? '').includes('/*')
        );
        if (typeof lastNode === 'undefined') spacesAbove = Math.max(-1, Math.min(spacesAbove, 1));
        else if (curlyFound && lastNode?.type === 'Declaration' && lastHasComment) spacesAbove = 1;
        else if (['Rule', 'AtRule'].includes(lastNode?.type)) spacesAbove = 1;
        else spacesAbove = Math.max(0, Math.min(spacesAbove, 1));

        const newNode = { spacesAbove };

        if (curlyFound) {
            newNode.body = [];
            
            if (segment.startsWith('@')) {
                const { name, params } = splitAtRuleSegment(segment);

                newNode.type = 'AtRule';
                newNode.name = name;
                newNode.params = params;
            } else {
                newNode.type = 'Rule';
                newNode.selector = parseSelector(segment);
            }
            
            context.body.push(newNode);
            stack.push(newNode);
            pos++;
        } else { 
            const colonIndex = findTopLevelColon(segment);
            if (colonIndex !== -1 && context.type !== 'Stylesheet') {
                const property = segment.substring(0, colonIndex).trim();
                const rawValue = rawSegment.substring(leadingTrim + colonIndex + 1);
                const value = rawValue.trim();
                
                newNode.type = 'Declaration';
                newNode.property = property;
                newNode.value = parseValue(value);
                newNode.valueRaw = rawValue;
                newNode.valueWasWhitespaceOnly = property.startsWith('--') && value === '' && rawValue.length > 0;
                newNode.spacesAbove = declarationSpacesAbove;
                
                context.body.push(newNode);
            } else if (segment.startsWith('@')) {
                const { name, params } = splitAtRuleSegment(segment);

                newNode.type = 'AtRule';
                newNode.name = name;
                newNode.params = params;
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
    if (!ast || !ast.body) {
        return;
    }

    const newBody = [];
    const ruleMap = new Map();

    for (let i = 0; i < ast.body.length; i++) {
        const child = ast.body[i];

        if (child.type === 'Rule') {
            const selStr = child.selector.map(g => g.parts.join('')).join(',');
            if (ruleMap.has(selStr)) {
                const existingRule = ruleMap.get(selStr);
                existingRule.body.push(...child.body);
                const index = newBody.indexOf(existingRule);
                if (index !== -1) {
                    newBody.splice(index, 1);
                }
                newBody.push(existingRule);
            } else {
                ruleMap.set(selStr, child);
                newBody.push(child);
            }
        } else {
            newBody.push(child);
        }
    }

    ast.body = newBody;

    const declMap = new Map();
    const blockBody = [];
    for (const child of ast.body) {
        if (child.type === 'Declaration') {
            if (declMap.has(child.property)) {
                const existing = declMap.get(child.property);
                const index = blockBody.indexOf(existing);
                if (index !== -1) {
                    blockBody.splice(index, 1);
                }
            }
            declMap.set(child.property, child);
            blockBody.push(child);
        } else {
            blockBody.push(child);
        }
    }
    ast.body = blockBody;

    for (const child of ast.body) {
        if (child.type === 'Rule' || child.type === 'AtRule') {
            deduplicateCSS(child, depth + 1);
        }
    }
}

export function minifyCSS(ast) {
    if (_deduplicate) {
        deduplicateCSS(ast);
    }
    function _minify(node) {
        if (!node || !node.body) return '';
        return node.body.map(child => {
            switch (child.type) {
                case 'Comment':
                    return `/*${child.value}*/`;
                case 'Declaration':
                    return `${child.property}:${child.valueWasWhitespaceOnly ? ' ' : ''}${minifyValue(child.value)};`;
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

    const output = factorIsSelectors(_minify(ast));
    return output ? output + '\n' : '';
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

function isArtComment(raw) {
    // Detect decorative headers/dividers/ASCII art that must be preserved.
    if (/[|+]/.test(raw)) return true;
    // Repeated punctuation runs (****, ----, ====, ####) of 4+ chars.
    if (/[*\-=#]{4,}/.test(raw)) return true;
    // Box-drawing or slash runs.
    if (/\/{3,}/.test(raw)) return true;
    return false;
}

function beautifyComment(comment, indent) {
    const raw = typeof comment.raw === 'string' ? comment.raw : null;
    const value = String(comment.value ?? '');

    // Protected art/divider blocks: preserve inner whitespace verbatim,
    // only re-anchoring the whole block to the current indent.
    if (raw !== null && isArtComment(raw)) {
        const lines = raw.split(/\r?\n/).map((line) => line.replace(/[ \t]+$/, ''));
        return lines.map((line, i) => (i === 0 ? line : indent + line)).join('\n');
    }

    // Protected (bang) comments keep `!` glued to `/*`.
    if (value.trimStart().startsWith('!')) {
        const inner = value.trim().replace(/^!\s*/, '! ');
        return `/*${inner} */`.replace('/* ! */', '/* ! */');
    }

    // Collapse comments whose text fits on a single line, even if the
    // original `/*` was on its own line. Only preserve a multiline block
    // shape when the comment text itself spans multiple lines.
    if (raw === null || !value.includes('\n')) {
        if (value.trim() === '') return '/* */';
        return `/* ${value.trim()} */`;
    }

    let inner = raw.replace(/\r\n?/g, '\n');
    if (inner.startsWith('/*')) inner = inner.slice(2);
    if (inner.endsWith('*/')) inner = inner.slice(0, -2);

    const lines = inner.split('\n').map((line) => line.replace(/[ \t]+$/, ''));
    while (lines.length > 0 && lines[0].trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    if (lines.length === 0) return '/* */';

    const blockStyle = raw !== null && /\/\*\s*\n/.test(raw);
    const first = lines[0].trim();
    let opening = '/*';
    let contentLines = lines;
    if (!blockStyle && first !== '' && !first.startsWith('*')) {
        opening = `/* ${first}`;
        contentLines = lines.slice(1);
    }

    const indents = contentLines
        .filter((line) => line.trim() !== '')
        .map((line) => (line.match(/^[ \t]*/) || [''])[0].length);
    const commonIndent = indents.length > 0 ? Math.min(...indents) : 0;

    let hasAsterisk = false;
    let lastContent = '';
    let result = opening;
    for (const line of contentLines) {
        if (line.trim() === '') {
            result += '\n' + indent;
            continue;
        }
        const lineIndent = (line.match(/^[ \t]*/) || [''])[0].length;
        const content = line.slice(Math.min(commonIndent, lineIndent));
        const trimmedContent = content.replace(/[ \t]+$/, '');
        if (trimmedContent.startsWith('*')) hasAsterisk = true;
        const separator = trimmedContent.startsWith('*') ? ' ' : '';
        result += '\n' + indent + separator + trimmedContent;
        lastContent = trimmedContent;
    }
    const closing = hasAsterisk ? ' */' : '*/';
    if (lastContent.endsWith('}')) {
        result += ' ' + closing.trimStart();
    } else {
        result += '\n' + indent + closing;
    }
    return result;
}

function hasTopLevelNewline(text) {
    let inString = null;
    let inComment = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inComment) {
            if (ch === '*' && text[i + 1] === '/') { inComment = false; i++; }
            continue;
        }
        if (inString) {
            if (ch === '\\') { i++; continue; }
            if (ch === inString) inString = null;
            continue;
        }
        if (ch === '/' && text[i + 1] === '*') { inComment = true; i++; continue; }
        if (ch === '"' || ch === "'") { inString = ch; continue; }
        if (ch === '\n') return true;
    }
    return false;
}

function beautifyPreservedValue(raw, indent, indentChar) {
    const lines = String(raw).replace(/\r\n?/g, '\n').split('\n');
    while (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop();
    if (lines.length > 1 && lines[0].trim() === '') lines.shift();
    if (lines.length <= 1) return beautifyValue(parseValue(raw.trim()));
    const first = lines[0].trim();
    const contLines = lines.slice(1);
    const indents = contLines.filter(l => l.trim() !== '').map(l => (l.match(/^[ \t]*/) || [''])[0].length);
    const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
    let out = first;
    for (const l of contLines) {
        if (l.trim() === '') {
            out += '\n' + indent;
            continue;
        }
        const rel = (l.match(/^[ \t]*/) || [''])[0].length - minIndent;
        const content = l.trim();
        out += '\n' + indent + indentChar + (rel > 0 ? ' '.repeat(rel) : '') + content;
    }
    return out;
}

function beautifySelector(groups, indent) {
    let result = '';
    
    function stringifyGroup(parts) {
        const combinators = ['>', '+', '~', '||'];
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

    const groupStrings = groups.map((group) => {
        let s = stringifyGroup(group.parts);
        if (group.commentAfter) s += ' ' + group.commentAfter;
        return s;
    });

    const inline = groupStrings.join(', ');

    // Single-line forced or fits within width: keep on one line.
    if (_selectorSingleLine || (indent.length + inline.length + ' {'.length <= _selectorWidth)) {
        return inline;
    }

    // Otherwise wrap every selector onto its own line.
    if (groupStrings.length <= 1) return inline;
    return groupStrings.join(',\n' + indent);
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
    if (_deduplicate) {
        deduplicateCSS(ast);
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
                    css += beautifyComment(child, indent);
                    break;
                case 'Declaration':
                    if (_valueFormat === 'single-line') {
                        css += `${child.property}: ${beautifyValue(child.value)};`;
                    } else if (_valueFormat === 'preserve' && typeof child.valueRaw === 'string' && hasTopLevelNewline(child.valueRaw)) {
                        css += `${child.property}: ${beautifyPreservedValue(child.valueRaw, indent, indentChar)};`;
                    } else {
                        css += `${child.property}: ${beautifyValue(child.value)};`;
                    }
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

    const output = factorIsSelectors(_beautify(ast, initialIndent).trim());
    return output ? output + '\n' : '';
}

function cloneASTNode(node) {
    return JSON.parse(JSON.stringify(node));
}

function stringifySelectorForIs(groups) {
    return groups.map(group => {
        const text = group.parts.join('');
        return group.commentAfter ? `${text} ${group.commentAfter}` : text;
    }).join(', ');
}

function splitTopLevelCommas(text) {
    const parts = [];
    let depth = 0;
    let inString = null;
    let buffer = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            buffer += ch;
            if (ch === '\\') { buffer += text[i + 1] || ''; i++; continue; }
            if (ch === inString) inString = null;
            continue;
        }
        if (ch === '"' || ch === "'") { inString = ch; buffer += ch; continue; }
        if (ch === '(') { depth++; buffer += ch; continue; }
        if (ch === ')') { depth = Math.max(0, depth - 1); buffer += ch; continue; }
        if (ch === ',' && depth === 0) { parts.push(buffer); buffer = ''; continue; }
        buffer += ch;
    }
    if (buffer.trim() !== '' || parts.length > 0) parts.push(buffer);
    return parts.map(p => p.trim()).filter(p => p.length > 0);
}

function factorIsContent(content) {
    const args = splitTopLevelCommas(content);
    if (args.length < 2) return null;

    const minLen = Math.min(...args.map(a => a.length));
    let common = '';
    for (let i = 0; i < minLen; i++) {
        const ch = args[0][i];
        if (args.every(a => a[i] === ch)) common += ch;
        else break;
    }

    let boundary = -1;
    for (let i = common.length - 1; i >= 0; i--) {
        const c = common[i];
        if (c === ' ' || c === '>' || c === '+' || c === '~') { boundary = i; break; }
    }
    if (boundary < 0) return null;

    const prefix = common.slice(0, boundary + 1).trimEnd();
    const remainders = args.map(a => a.slice(common.slice(0, boundary + 1).length).trim());
    if (remainders.some(r => r.length === 0)) return null;
    if (remainders.some(r => /^[>+~]/.test(r))) return null;
    if (remainders.some(r => /^::/.test(r))) return null;
    if (prefix.includes(':is(') || prefix.includes(':not(') || prefix.includes(':has(')) return null;

    return { prefix, remainders };
}

function factorIsSelectors(text) {
    let result = '';
    let i = 0;
    while (i < text.length) {
        if (text[i] === '/' && text[i + 1] === '*') {
            const end = text.indexOf('*/', i + 2);
            const j = end === -1 ? text.length : end + 2;
            result += text.slice(i, j);
            i = j;
            continue;
        }
        const idx = text.indexOf(':is(', i);
        if (idx === -1) { result += text.slice(i); break; }
        result += text.slice(i, idx);
        let depth = 1;
        let inStr = null;
        let k = idx + 4;
        while (k < text.length && depth > 0) {
            const ch = text[k];
            if (inStr) {
                if (ch === '\\') { k += 2; continue; }
                if (ch === inStr) inStr = null;
                k++;
                continue;
            }
            if (ch === '"' || ch === "'") { inStr = ch; k++; continue; }
            if (ch === '(') depth++;
            else if (ch === ')') { depth--; if (depth === 0) break; }
            k++;
        }
        if (depth !== 0) { result += text.slice(idx); break; }
        const content = text.slice(idx + 4, k);
        const factor = factorIsContent(content);
        if (factor) {
            result += `${factor.prefix} :is(${factor.remainders.join(', ')})`;
        } else {
            result += text.slice(idx, k + 1);
        }
        i = k + 1;
    }
    return result;
}

/**
 * When a parent selector list shares a common prefix that ends at a
 * combinator or whitespace boundary, factor it out so that
 * `:is(a b, a c)` becomes `a :is(b, c)` instead of repeating `a`.
 * Returns `{ prefix, remainders }` or null when factoring is not safe.
 */
function factorCommonPrefix(groups) {
    if (!groups || groups.length < 2) return null;

    const texts = groups.map(g => (g.parts || []).join(''));
    const minLen = Math.min(...texts.map(t => t.length));
    let common = '';
    for (let i = 0; i < minLen; i++) {
        const ch = texts[0][i];
        if (texts.every(t => t[i] === ch)) common += ch;
        else break;
    }

    // Only factor at a whitespace or combinator boundary.
    let boundary = -1;
    for (let i = common.length - 1; i >= 0; i--) {
        const c = common[i];
        if (c === ' ' || c === '>' || c === '+' || c === '~') { boundary = i; break; }
    }
    if (boundary < 0) return null;

    const prefix = common.slice(0, boundary + 1);
    const remainders = texts.map(t => t.slice(prefix.length));
    if (remainders.some(r => r.trim().length === 0)) return null;
    if (remainders.some(r => /^[>+~]/.test(r.trim()))) return null;

    return { prefix, remainders };
}

function compoundStartsWithTypeSelector(parts) {
    const firstPart = parts[0];
    return /^[a-zA-Z*]/.test(firstPart) || firstPart.startsWith('|');
}

function groupIsComplex(parts) {
    return parts.some(part => part === ' ' || NESTING_COMBINATORS.includes(part));
}

/**
 * Extracts the scope root selector from an `@scope` prelude, e.g.
 * `(#siteWrapper)` or `(#siteWrapper) to (.foo)`. Returns null for a
 * global scope (`@scope { … }`).
 */
function getScopeRoot(params) {
    if (!params) return null;
    const trimmed = params.trim();
    if (!trimmed.startsWith('(')) return null;
    let depth = 0;
    let inString = null;
    let start = -1;
    let end = -1;
    for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (inString) {
            if (ch === '\\') { i++; continue; }
            if (ch === inString) inString = null;
            continue;
        }
        if (ch === '"' || ch === "'") { inString = ch; continue; }
        if (ch === '(') {
            if (depth === 0) start = i + 1;
            depth++;
        } else if (ch === ')') {
            depth--;
            if (depth === 0) { end = i; break; }
        }
    }
    if (start === -1 || end === -1) return null;
    const root = trimmed.slice(start, end).trim();
    return root.length > 0 ? root : null;
}

function combineSelectors(parentGroups, childGroups) {
    const combinators = NESTING_COMBINATORS;

    // Selector multiplication strategy: when the parent is a selector list,
    // distribute the child over each parent instead of wrapping the list
    // in `:is()`. This keeps specificity isolated per parent.
    if (_selectorStrategy === 'multiply' && parentGroups && parentGroups.length > 1) {
        const result = [];
        for (const pg of parentGroups) {
            result.push(...combineSelectors([pg], childGroups));
        }
        return result;
    }

    if (!parentGroups || parentGroups.length === 0) {
        return childGroups.map(g => ({
            ...g,
            parts: g.parts.map(p => transformNestingSelectors(p, () => ':root'))
        }));
    }

    const newSelectorGroups = [];
    const parentIsList = parentGroups.length > 1;
    const parentGroup = parentGroups[0];

    const parentText = parentIsList ? '' : parentGroup.parts.join('');
    const parentListText = parentIsList ? stringifySelectorForIs(parentGroups) : parentText;

    // Per the CSS Nesting spec, `&` is equivalent to the parent selector list
    // wrapped in `:is()`. Wrapping is what keeps everything that follows an
    // `&` attached to *every* parent selector instead of only the last one.
    const nestingExpression = parentIsList ? `:is(${parentListText})` : parentText;

    const parentIsComplex = !parentIsList && groupIsComplex(parentGroup.parts);
    const parentStartsWithTypeSelector = !parentIsList && compoundStartsWithTypeSelector(parentGroup.parts);

    // A parent that is a complex selector or starts with a type/universal
    // selector cannot be concatenated into the middle of a compound, so those
    // replacements are wrapped in `:is()` as well (e.g. `.foo&` under `body`).
    const needsCompoundWrapper = parentIsComplex || parentStartsWithTypeSelector;

    for (const childGroup of childGroups) {
        const hasAmpersand = childGroup.parts.some(partHasNestingSelector);
        const childStartsWithCombinator = combinators.includes(childGroup.parts[0]);

        if (!hasAmpersand) {
            const parentParts = parentIsList ? [`:is(${parentListText})`] : parentGroup.parts;

            const newGroup = {
                parts: childStartsWithCombinator ? [...parentParts, ...childGroup.parts] : [...parentParts, ' ', ...childGroup.parts],
                newlinesBefore: 0,
                commentAfter: childGroup.commentAfter
            };
            newSelectorGroups.push(newGroup);
            continue;
        }

        const replaceNestingSelector = (compoundStart) => {
            if (parentIsList) return nestingExpression;
            if (compoundStart) return parentText;
            return needsCompoundWrapper ? `:is(${parentText})` : parentText;
        };

        let combinedString = childGroup.parts
            .map(part => transformNestingSelectors(part, replaceNestingSelector))
            .join('');

        // A nested selector that starts with a combinator is relative and has
        // an implied leading `&`, so the parent selector must be prepended.
        if (childStartsWithCombinator) {
            combinedString = nestingExpression + combinedString;
        }

        const reparsedGroups = parseSelector(combinedString);
        reparsedGroups.forEach((g, index) => {
            if (index === reparsedGroups.length - 1) {
                g.commentAfter = childGroup.commentAfter;
            }
        });
        newSelectorGroups.push(...reparsedGroups);
    }

    return newSelectorGroups;
}

export function denestCSS(ast, preserveWrappers = false) {
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
                // Inside an @scope, a rule whose selector is the scope root
                // must not be combined with the scope root again.
                const inScope = !context.downlevelScope && (!!context.inScope || (context.atRule && String(context.atRule.name).toLowerCase() === 'scope'));
                const scopeRootText = inScope ? (context.scopeRootText || (context.selector ? stringifySelector(context.selector) : '')) : '';
                const atScopeRoot = inScope && scopeRootText !== '' && !!context.selector && stringifySelector(context.selector) === scopeRootText;
                const childText = stringifySelector(node.selector);
                // A rule written with `&` at the top of an @scope targets the
                // scoping root itself. Expanding it to the literal root would
                // stop matching, because the root is excluded from the styles
                // scoped beneath it, so keep `&` as the root reference.
                const referencesScopeRoot = atScopeRoot && childText.includes('&');
                const alreadyQualified = inScope && !referencesScopeRoot && scopeRootText !== '' && (childText === scopeRootText || (childText.startsWith(scopeRootText) && !/[a-zA-Z0-9_-]/.test(childText[scopeRootText.length] || '')) || scopeRootText.endsWith(childText));
                const newSelector = referencesScopeRoot
                    ? combineSelectors(parseSelector('&'), node.selector)
                    : alreadyQualified ? cloneASTNode(node.selector) : combineSelectors(context.selector, node.selector);
                const newContext = { ...context, selector: newSelector };
                const childNodes = _denest(node.body, newContext);
                
                const childRulesCount = node.body.filter(n => n.type === 'Rule' || n.type === 'AtRule').length;
                
                if (preserveWrappers && childRulesCount > 1) {
                    const emptyRule = {
                        type: 'Rule',
                        selector: cloneASTNode(newSelector),
                        body: [],
                        spacesAbove: denestedNodes.length === 0 ? 0 : 1
                    };
                    denestedNodes.push(emptyRule);
                }

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
                const nodeName = node.name.toLowerCase();
                let combinedAtRuleParams = node.params;
                if (context.atRule && context.atRule.name.toLowerCase() === 'media' && nodeName === 'media') {
                     combinedAtRuleParams = `${context.atRule.params} and (${node.params})`;
                }
                
                const newAtRuleContext = { name: node.name, params: combinedAtRuleParams };

                let childSelector = context.selector;
                const parentInScope = !!context.inScope;
                const scopeRoot = getScopeRoot(combinedAtRuleParams);
                const isRelativeScope = !!(scopeRoot && (scopeRoot.includes('&') || /^[>+~]/.test(scopeRoot.trim())));
                // Downleveling a relative scope root cannot be safely flattened
                // to a concrete selector, so keep the @scope wrapper instead.
                const downlevelScope = nodeName === 'scope' && _scopeStrategy === 'downlevel' && !isRelativeScope;
                let thisInScope = parentInScope;
                if (nodeName === 'scope') {
                    if (downlevelScope) {
                        // Downlevel: flatten the scope into descendant
                        // combinators, dropping the donut boundary.
                        if (scopeRoot) {
                            const isRelative = scopeRoot.includes('&') || /^[>+~]/.test(scopeRoot.trim());
                            try {
                                childSelector = isRelative ? parseSelector('&') : parseSelector(scopeRoot);
                            } catch (e) {
                                childSelector = context.selector;
                            }
                        } else {
                            childSelector = context.selector;
                        }
                        thisInScope = false;
                    } else {
                        if (scopeRoot) {
                            const isRelative = scopeRoot.includes('&') || /^[>+~]/.test(scopeRoot.trim());
                            try {
                                childSelector = isRelative ? parseSelector('&') : parseSelector(scopeRoot);
                            } catch (e) {
                                childSelector = context.selector;
                            }
                        } else {
                            childSelector = null;
                        }
                        thisInScope = true;
                    }
                }

                const childContext = {
                    selector: childSelector,
                    atRule: newAtRuleContext,
                    inScope: thisInScope,
                    downlevelScope: downlevelScope || !!context.downlevelScope,
                    scopeRootText: nodeName === 'scope' && childSelector ? stringifySelector(childSelector) : context.scopeRootText,
                };
                
                const childNodes = _denest(node.body, childContext);

                if (downlevelScope && childNodes.length > 0) {
                    if (denestedNodes.length > 0 && ['Rule', 'AtRule'].includes(denestedNodes.at(-1)?.type)) {
                        if (childNodes[0].spacesAbove === 0) childNodes[0].spacesAbove = 1;
                    }
                    denestedNodes.push(...childNodes);
                } else if (childNodes.length > 0) {
                    const atRuleWrapper = cloneASTNode(node);
                    atRuleWrapper.params = combinedAtRuleParams;
                    atRuleWrapper.body = childNodes;
                    if (denestedNodes.length > 0) atRuleWrapper.spacesAbove = 1;
                    denestedNodes.push(atRuleWrapper);
                } else if (downlevelScope) {
                    // Downlevel empty/leaf scope produces no wrapper.
                } else if (node.body === null) {
                    denestedNodes.push(cloneASTNode(node));
                } else if (node.body.length === 0) {
                    const emptyAtRule = cloneASTNode(node);
                    emptyAtRule.params = combinedAtRuleParams;
                    emptyAtRule.body = [];
                    if (denestedNodes.length > 0) emptyAtRule.spacesAbove = 1;
                    denestedNodes.push(emptyAtRule);
                } else {
                    // Preserve leaf at-rules whose bodies contain only declarations
                    // (e.g. @font-face, @page, @property, @counter-style, @nest)
                    // instead of dropping their declarations.
                    denestedNodes.push(cloneASTNode(node));
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

function getIsSelectorPrefix(part) {
    if (typeof part !== 'string' || !part.startsWith(':is(')) {
        return null;
    }

    let depth = 1;
    let pos = 4;
    let inString = null;
    let attributeDepth = 0;

    while (pos < part.length) {
        const char = part[pos];

        if (inString) {
            if (char === '\\' && pos + 1 < part.length) {
                pos = consumeEscape(part, pos);
                continue;
            }
            if (char === inString) inString = null;
            pos++;
            continue;
        }

        if (char === '\\') {
            pos = consumeEscape(part, pos);
            continue;
        }

        if (char === '"' || char === "'") {
            inString = char;
            pos++;
            continue;
        }

        if (char === '[') {
            attributeDepth++;
            pos++;
            continue;
        }

        if (char === ']') {
            if (attributeDepth > 0) attributeDepth--;
            pos++;
            continue;
        }

        if (attributeDepth === 0) {
            if (char === '(') depth++;
            else if (char === ')') {
                depth--;
                if (depth === 0) return part.slice(0, pos + 1);
            }
        }

        pos++;
    }

    return null;
}

function findIsListNestingRelationship(parentGroups, childGroups) {
    if (!parentGroups || parentGroups.length < 2) {
        return null;
    }

    const listExpression = `:is(${stringifySelectorForIs(parentGroups)})`;
    const newSelector = [];

    for (const childGroup of childGroups) {
        const firstPart = childGroup.parts[0];

        if (typeof firstPart !== 'string' || !firstPart.startsWith(listExpression)) {
            return null;
        }

        const remainderFirst = firstPart.slice(listExpression.length);
        const remainderParts = remainderFirst
            ? [remainderFirst, ...childGroup.parts.slice(1)]
            : childGroup.parts.slice(1);

        if (remainderParts.length === 0) {
            if (childGroups.length !== 1) return null;
            return { type: 'MERGE', newSelector: parentGroups };
        }

        remainderParts.unshift('&');
        newSelector.push({
            parts: remainderParts,
            newlinesBefore: 0,
            commentAfter: childGroup.commentAfter
        });
    }

    return newSelector.length > 0 ? { type: 'NEST', newSelector } : null;
}

function findNestingRelationship(parentGroups, childGroups) {
    const parentStr = stringifySelector(parentGroups);
    const childStr = stringifySelector(childGroups);

    // `:is(... > &)` (optionally with a suffix such as `::before`) inside a
    // parent should stay nested in that parent. The denested form is
    // `:is(... > parent)suffix`, so re-nest it as `:is(... > &)suffix`.
    const isWrapped = childGroups.map((group) => {
        const first = group.parts[0];
        if (typeof first !== 'string' || !first.startsWith(':is(')) return null;
        let depth = 1;
        let end = -1;
        for (let k = 4; k < first.length; k++) {
            if (first[k] === '(') depth++;
            else if (first[k] === ')') {
                depth--;
                if (depth === 0) { end = k; break; }
            }
        }
        if (end === -1) return null;
        return { inner: first.slice(4, end), suffix: first.slice(end + 1) };
    });
    if (isWrapped.every(Boolean) && parentGroups.length === childGroups.length) {
        const newGroups = [];
        for (let gi = 0; gi < childGroups.length; gi++) {
            const { inner, suffix } = isWrapped[gi];
            const innerCompact = inner.replace(/\s+/g, '');
            const parentGroup = parentGroups[gi];
            let parentCompact = stringifySelector([parentGroup]).replace(/\s+/g, '');
            // The parent may already carry the same pseudo-element suffix
            // (e.g. `#x::before`); strip it so the inner selector matches.
            if (suffix && parentCompact.endsWith(suffix)) {
                parentCompact = parentCompact.slice(0, parentCompact.length - suffix.length);
            }
            // When the parent is a selector list, `&` denests to
            // `:is(list)`, so also accept that wrapper.
            const parentListExpression = parentGroups.length > 1
                ? ':is(' + parentGroups.map(g => g.parts.join('')).join(',') + ')'
                : null;
            const parentListCompact = parentListExpression !== null ? parentListExpression.replace(/\s+/g, '') : null;
            let matchedSuffix = null;
            if (innerCompact.endsWith(parentCompact)) {
                matchedSuffix = parentCompact;
            } else if (parentListCompact !== null && innerCompact.endsWith(parentListCompact)) {
                matchedSuffix = parentListCompact;
            }
            if (matchedSuffix === null) { newGroups.length = 0; break; }
            const prefix = innerCompact.slice(0, innerCompact.length - matchedSuffix.length);
            newGroups.push({ parts: [':is(' + prefix + '&)' + suffix], newlinesBefore: 0 });
        }
        if (newGroups.length > 0) {
            try {
                return { type: 'NEST', newSelector: newGroups };
            } catch (e) {
                // fall through to normal matching
            }
        }
    }

    if (parentStr === childStr) {
        return { type: 'MERGE', newSelector: parentGroups };
    }

    const isListRelationship = findIsListNestingRelationship(parentGroups, childGroups);
    if (isListRelationship) {
        return isListRelationship;
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

    const combinators = ['>', '+', '~', '||'];

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
    const flatAst = denestCSS(ast, true);
    ast.body = flatAst.body;
    
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
        const isPrefixMap = new Map();
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

                    const isPrefix = getIsSelectorPrefix(first);
                    if (isPrefix) {
                        if (!isPrefixMap.has(isPrefix)) isPrefixMap.set(isPrefix, []);
                        isPrefixMap.get(isPrefix).push(i);
                    }

                    // A flattened `:is(... > &)` rule should be able to re-nest
                    // into the parent it was originally nested under. Register
                    // the inner selector's tokens so candidate matching finds it.
                    if (typeof first === 'string' && first.startsWith(':is(')) {
                        try {
                            let depth = 1;
                            let closeIdx = -1;
                            for (let k = 4; k < first.length; k++) {
                                if (first[k] === '(') depth++;
                                else if (first[k] === ')') { depth--; if (depth === 0) { closeIdx = k; break; } }
                            }
                            const innerText = closeIdx === -1 ? first.slice(4) : first.slice(4, closeIdx);
                            const innerSuffix = closeIdx === -1 ? '' : first.slice(closeIdx + 1);
                            const tokensToRegister = [];
                            tokensToRegister.push(...parseSelector(innerText));
                            // Register tokens from any nested `:is(...)` lists
                            // (the denested form of `&` under a selector list).
                            for (let s = 0; s < innerText.length; s++) {
                                if (innerText.startsWith(':is(', s)) {
                                    let d = 1;
                                    let e = -1;
                                    for (let k = s + 4; k < innerText.length; k++) {
                                        if (innerText[k] === '(') d++;
                                        else if (innerText[k] === ')') { d--; if (d === 0) { e = k; break; } }
                                    }
                                    if (e !== -1) {
                                        try { tokensToRegister.push(...parseSelector(innerText.slice(s + 4, e))); } catch (err) { /* ignore */ }
                                        s = e;
                                    }
                                }
                            }
                            for (const innerGroup of tokensToRegister) {
                                const innerFirst = innerGroup.parts[0];
                                const innerLast = innerGroup.parts.at(-1);
                                if (!firstTokenMap.has(innerFirst)) firstTokenMap.set(innerFirst, []);
                                firstTokenMap.get(innerFirst).push(i);
                                if (!lastTokenMap.has(innerLast)) lastTokenMap.set(innerLast, []);
                                lastTokenMap.get(innerLast).push(i);
                                // The parent may carry a pseudo-element suffix
                                // (e.g. `::before`) that the `:is()` inner lacks.
                                const suffixedLast = innerLast + innerSuffix;
                                if (suffixedLast !== innerLast) {
                                    if (!lastTokenMap.has(suffixedLast)) lastTokenMap.set(suffixedLast, []);
                                    lastTokenMap.get(suffixedLast).push(i);
                                }
                            }
                        } catch (e) {
                            // ignore malformed :is() contents
                        }
                    }
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

                // Rules whose selector begins with `:is(parent selector list)`
                // are the flattened form produced by denestCSS for a nested
                // `&` under a selector list, so let them re-nest as well.
                if (parentSelector.length > 1) {
                    const listExpression = `:is(${stringifySelectorForIs(parentSelector)})`;
                    const isList = isPrefixMap.get(listExpression);
                    if (isList) {
                        for (let k = 0; k < isList.length; k++) {
                            const idx = isList[k];
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

        candidates.sort((a, b) => {
            if (a.score.typeOrder !== b.score.typeOrder) return a.score.typeOrder - b.score.typeOrder;
            if (a.score.score !== b.score.score) return b.score.score - a.score.score;
            return a.parentIdx - b.parentIdx;
        });

        for (const c of candidates) {
            if (parentOf[c.childIdx] === -1) {
                parentOf[c.childIdx] = c.parentIdx;
                rels[c.childIdx] = c.relationship;
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

        let depthChanged = true;
        let passCounter = 0;
        
        while (depthChanged) {
            passCounter++;
            depthChanged = false;
            
            const treeMaxDepth = new Int32Array(n).fill(0);
            
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

                    if (totalDepth > limit) {
                        if (cutRoots.has(curRoot)) {
                            continue;
                        }

                        cutRoots.add(curRoot);
                        
                        if (_strategy === 'flattened' && _maxDepth !== Infinity) {
                            const targetAncestorDepth = _maxDepth - 2;
                            if (targetAncestorDepth >= 0) {
                                const ancestorIdx = getAncestorAtDepth(i, parentOf, targetAncestorDepth);
                                if (ancestorIdx !== -1 && ancestorIdx !== parentOf[i]) {
                                    const newRel = findNestingRelationship(body[ancestorIdx].selector, body[i].selector);
                                    if (newRel) {
                                        parentOf[i] = ancestorIdx;
                                        rels[i] = newRel;
                                        depthChanged = true;
                                        continue;
                                    }
                                }
                            }
                        }

                        parentOf[i] = -1;
                        rels[i] = null;
                        depthChanged = true;
                    }
                }
            }
        }

        const newBody = [];
        let pendingComments = [];
        for (let i = 0; i < n; i++) {
            if (body[i].type === 'Comment') {
                pendingComments.push(body[i]);
                continue;
            }

            if (parentOf[i] === -1) {
                newBody.push(...pendingComments);
                pendingComments = [];
                newBody.push(body[i]);
            } else {
                const parentIdx = parentOf[i];
                const parentNode = body[parentIdx];
                const childNode = body[i];
                const rel = rels[i];

                parentNode.body = parentNode.body || [];
                if (pendingComments.length > 0) {
                    const movedComments = pendingComments.map((comment) => cloneASTNode(comment));
                    childNode.body = [...movedComments, ...(childNode.body || [])];
                    pendingComments = [];
                }

                if (rel.type === 'MERGE') {
                    for (const movedNode of childNode.body) {
                        if ((movedNode.type === 'Rule' || movedNode.type === 'AtRule') && parentNode.body.length > 0) {
                            movedNode.spacesAbove = 1;
                        }
                    }
                    parentNode.body.push(...childNode.body);
                } else {
                    if (parentNode.body.length > 0 && (childNode.type === 'Rule' || childNode.type === 'AtRule')) {
                        childNode.spacesAbove = 1;
                    }
                    childNode.selector = rel.newSelector;
                    parentNode.body.push(childNode);
                }
            }
        }
        newBody.push(...pendingComments);
        node.body = newBody;

        for (const childNode of node.body) {
            if (childNode.type === 'Rule' || (childNode.type === 'AtRule' && childNode.body)) {
                _renest(childNode, depth + 1);
            }
        }
    }



    nestHoistedAtRules(ast);
    _renest(ast, 0);


    function stringifySelectorForNesting(groups) {
        return groups.map((group) => (group.parts || []).join('')).join(', ');
    }

    function nestHoistedAtRules(root) {
        if (!root || !Array.isArray(root.body)) return;

        const oldBody = root.body;
        const newBody = [];
        let pendingComments = [];

        for (let i = 0; i < oldBody.length; i++) {
            const node = oldBody[i];

            if (node.type === 'Comment') {
                pendingComments.push(node);
                continue;
            }

            // Only nest hoisted at-rules whose body is a flat list of rules.
            // At-rules that wrap nested at-rules (e.g. @media { @scope { ... } })
            // or multiple unrelated scopes must stay hoisted to preserve semantics.
            const hasNestedAtRule = Array.isArray(node.body) && node.body.some((child) => child.type === 'AtRule');
            if (node.type === 'AtRule' && Array.isArray(node.body) && !hasNestedAtRule && node.body.some((child) => child.type === 'Rule')) {
                const matchedRules = node.body.filter((child) => child.type === 'Rule');
                const parents = new Map();


                function findParentRule(selectorGroups) {
                    const selector = stringifySelectorForNesting(selectorGroups);

                    // Prefer the rule whose selector is exactly the media's
                    // inner selector. Otherwise a shorter prefix such as
                    // `#code-editor-wrapper` can steal a media that belongs to
                    // `#code-editor-wrapper > #code-editor`.
                    const exactMatches = oldBody.filter(c => c.type === 'Rule' && stringifySelectorForNesting(c.selector) === selector);
                    const preferredExact = exactMatches.find(c => c.body && c.body.length > 0) || exactMatches[0];
                    if (preferredExact) return preferredExact;

                    const prefixMatches = oldBody.filter(c => c.type === 'Rule' && findNestingRelationship(c.selector, selectorGroups));
                    const preferredPrefix = prefixMatches.find(c => c.body && c.body.length > 0) || prefixMatches[0];
                    if (preferredPrefix) return preferredPrefix;

                    return null;
                }

                for (const rule of matchedRules) {
                    const parent = findParentRule(rule.selector);

                    if (!parent) {
                        parents.clear();
                        break;
                    }

                    if (!parents.has(parent)) parents.set(parent, []);
                    parents.get(parent).push(rule);
                }

                if (parents.size > 0) {
                    let firstParent = true;
                    for (const [parent, rules] of parents) {
                        const nestedAtRule = cloneASTNode(node);
                        nestedAtRule.body = [];
                        for (const rule of rules) {
                            nestedAtRule.body.push(...cloneASTNode(rule.body || []));
                        }

                        if (firstParent) {
                            const movedComments = pendingComments.map((comment) => cloneASTNode(comment));
                            nestedAtRule.body = [...movedComments, ...nestedAtRule.body];
                            firstParent = false;
                        }

                        nestedAtRule.spacesAbove = parent.body && parent.body.length > 0 ? 1 : 0;
                        parent.body = parent.body || [];
                        parent.body.push(nestedAtRule);
                    }

                    pendingComments = [];
                    continue;
                }
            }

            newBody.push(...pendingComments);
            pendingComments = [];
            newBody.push(node);
        }

        newBody.push(...pendingComments);
        root.body = newBody;
    }


    function removeEmptyRules(node) {
        if (!node || !node.body) return;
        
        for (let i = node.body.length - 1; i >= 0; i--) {
            const child = node.body[i];
            
            if (child.type === 'Rule' || child.type === 'AtRule') {
                // Statement at-rules such as `@import`, `@charset`,
                // `@namespace`, `@layer a, b;`, and `@custom-media` have no
                // block (body === null). They are content, not empty rules.
                if (child.type === 'AtRule' && child.body === null) continue;

                removeEmptyRules(child);
                
                const hasContent = child.body && child.body.some(n => 
                    n.type === 'Declaration' || 
                    n.type === 'Rule' || 
                    n.type === 'AtRule' || 
                    n.type === 'Comment'
                );
                
                if (!hasContent) {
                    node.body.splice(i, 1);
                }
            }
        }
    }
    
    removeEmptyRules(ast);

    return ast;
}

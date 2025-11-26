// ============================================
// papagaio
// ============================================

const papagaio_version = "0.0.8"
const MAX_ITERATIONS = 512;
let globalClearFlag = false;

// ============================================
// CONFIG GLOBAL DE DELIMITADORES
// ============================================
let OPEN = "{";
let CLOSE = "}";

function changeQuote(open, close) {
    OPEN = open;
    CLOSE = close;
}

let SIGIL = "$";

function changeSigil(s) {
    SIGIL = s;
}

// delimitadores de pattern
const patternDelims = [
    ["{", "}"] // padrão
];

function registerDelimiter(open, close) {
    patternDelims.push([open, close]);
}

function findClosingDelim(open) {
    for (const [o, c] of patternDelims) {
        if (o === open) return c;
    }
    return null;
}

function isRegisteredOpen(ch) {
    return patternDelims.some(([o, _]) => o === ch);
}

function extractBlock(src, openpos, open = OPEN, close = CLOSE) {
    let i = openpos;
    let depth = 0;
    let startInner = null;
    let inString = false;
    let strChar = '';

    while (i < src.length) {
        let ch = src[i];

        if (inString) {
            if (ch === '\\') { i += 2; continue; }
            if (ch === strChar) { inString = false; strChar = ''; }
            i++;
            continue;
        } else {
            if (ch === '"' || ch === "'" || ch === "`") {
                inString = true;
                strChar = ch;
                i++;
                continue;
            }
        }

        if (ch === open) {
            depth++;
            if (startInner === null) startInner = i + 1;
        } else if (ch === close) {
            depth--;
            if (depth === 0) {
                const inner = startInner !== null ? src.substring(startInner, i) : '';
                return [inner, i + 1];
            }
        }

        i++;
    }

    const inner = startInner !== null ? src.substring(startInner) : '';
    return [inner, src.length];
}


// ============================================
// SISTEMA GLOBAL DE CONTADOR + UNIQUE
// ============================================
const counterState = {
    value: 0,
    unique: 0,
    reset() {
        this.value = 0;
        this.unique = 0;
    },
    genUnique() {
        return "u" + (this.unique++).toString(36);
    }
};

function patternToRegex(pattern) {
    let regex = '';
    let i = 0;

    const S = SIGIL;
    const S2 = SIGIL + SIGIL;

    while (i < pattern.length) {

        // $$ → concat
        if (pattern.startsWith(S2, i)) {
            regex += '\\s*';
            i += S2.length;
            continue;
        }

        // captura delimitador + sigil + var
        if (isRegisteredOpen(pattern[i]) && pattern.startsWith(S, i + 1)) {

            const openDelim = pattern[i];
            const closeDelim = findClosingDelim(openDelim);

            let j = i + 1 + S.length;
            while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) j++;

            if (j < pattern.length && pattern[j] === closeDelim) {

                const escapedOpen = escapeRegex(openDelim);
                const escapedClose = escapeRegex(closeDelim);

                const innerRegex = buildBalancedBlockRegex(openDelim, closeDelim);

                regex += `${escapedOpen}(${innerRegex})${escapedClose}`;
                i = j + 1;
                continue;
            }
        }


        // captura $var...token genérico
        if (pattern[i] === S) {
            let j = i + S.length;
            let varName = '';
            while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) {
                varName += pattern[j];
                j++;
            }

            if (
                varName &&
                pattern.slice(j, j + 3) === '...' // mantém sintaxe ... igual
            ) {
                j += 3;
                let token = '';
                while (j < pattern.length && /\S/.test(pattern[j])) {
                    token += pattern[j];
                    j++;
                }

                if (token) {
                    const escapedToken = escapeRegex(token);
                    regex += `((?:.|\\r|\\n)*?)${escapedToken}`;
                    i = j;
                    continue;
                }
            }

            if (varName) {
                regex += '(\\S+)';
                i = j;
                continue;
            }

            regex += escapeRegex(S);
            i += S.length;
            continue;
        }

        if (/\s/.test(pattern[i])) {
            regex += '\\s+';
            while (i < pattern.length && /\s/.test(pattern[i])) i++;
            continue;
        }

        const char = pattern[i];
        regex += /[.*+?^${}()|[\]\\]/.test(char) ? '\\' + char : char;
        i++;
    }

    return new RegExp(regex, 'g');
}



// Função auxiliar para gerar regex que captura blocos balanceados
function buildBalancedBlockRegex(open, close) {
    const escapedOpen = open === '(' ? '\\(' : (open === '[' ? '\\[' : open === '{' ? '\\{' : open === '<' ? '\\<' : open);
    const escapedClose = close === ')' ? '\\)' : (close === ']' ? '\\]' : close === '}' ? '\\}' : close === '>' ? '\\>' : close);

    // Regex para capturar blocos balanceados
    // Ex: {a{b}c} -> captura a{b}c
    return `(?:[^${escapedOpen}${escapedClose}\\\\]|\\\\.|${escapedOpen}(?:[^${escapedOpen}${escapedClose}\\\\]|\\\\.)*${escapedClose})*`;
}
function extractVarNames(pattern) {
    const vars = [];
    const seen = new Set();
    const S = SIGIL;
    let i = 0;

    while (i < pattern.length) {

        // delimitadores com ${sigil}var
        if (isRegisteredOpen(pattern[i]) && pattern.startsWith(S, i + 1)) {

            const openDelim = pattern[i];
            const closeDelim = findClosingDelim(openDelim);

            let j = i + 1 + S.length;
            while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) j++;

            if (j < pattern.length && pattern[j] === closeDelim) {

                const varName = pattern.slice(i + 1 + S.length, j);

                if (!seen.has(varName)) {
                    vars.push(S + varName);
                    seen.add(varName);
                }

                i = j + 1;
                continue;
            }
        }


        // $var...token
        if (pattern.startsWith(S, i)) {
            let j = i + S.length;
            let varName = '';

            while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) {
                varName += pattern[j];
                j++;
            }

            if (varName && pattern.slice(j, j + 3) === '...') {
                j += 3;
                let token = '';
                while (j < pattern.length && /\S/.test(pattern[j])) {
                    token += pattern[j];
                    j++;
                }
                if (!seen.has(varName)) {
                    vars.push(S + varName);
                    seen.add(varName);
                }
                i = j;
                continue;
            }

            if (varName && !seen.has(varName)) {
                vars.push(S + varName);
                seen.add(varName);
            }
            i = j;
            continue;
        }

        i++;
    }

    return vars;
}


// ============================================
// INTEGRAÇÕES PRINCIPAIS
// ============================================

// === COLETA DE MACROS (MODIFICADA) ===
function collectMacros(src) {
    const macros = {};

    // exemplo: macro nome {
    const macroRegex = new RegExp(`\\bmacro\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\${OPEN}`, "g");

    let match;
    const matches = [];

    while ((match = macroRegex.exec(src)) !== null) {
        matches.push({
            name: match[1],
            matchStart: match.index,
            openPos: match.index + match[0].length - 1
        });
    }

    for (let j = matches.length - 1; j >= 0; j--) {
        const m = matches[j];
        const [body, posAfter] = extractBlock(src, m.openPos, OPEN, CLOSE);
        macros[m.name] = body;

        let left = src.substring(0, m.matchStart);
        let right = src.substring(posAfter);
        src = collapseLocalNewlines(left, right);
    }

    return [macros, src];
}

// === COLETA DE PATTERNS (MODIFICADA) ===
function collectPatterns(src) {
    const patterns = [];

    const patternRegex = new RegExp(`\\bpattern\\s*\\${OPEN}`, "g");

    let match;
    const matches = [];

    while ((match = patternRegex.exec(src)) !== null) {
        matches.push({
            matchStart: match.index,
            openPos: match.index + match[0].length - 1
        });
    }

    for (let j = matches.length - 1; j >= 0; j--) {
        const m = matches[j];
        const [matchPattern, posAfterMatch] = extractBlock(src, m.openPos, OPEN, CLOSE);

        let k = posAfterMatch;
        while (k < src.length && /\s/.test(src[k])) k++;

        if (k < src.length && src[k] === OPEN) {
            const [replacePattern, posAfterReplace] = extractBlock(src, k, OPEN, CLOSE);

            patterns.push({
                match: matchPattern.trim(),
                replace: replacePattern.trim()
            });

            let left = src.substring(0, m.matchStart);
            let right = src.substring(posAfterReplace);
            src = collapseLocalNewlines(left, right);
        }
    }

    return [patterns, src];
}

function applyPatterns(src, patterns) {
    let globalClearFlag = false;
    let lastResult = "";
    const S = SIGIL;

    for (const pattern of patterns) {
        let changed = true;
        let iterations = 0;

        while (changed && iterations < MAX_ITERATIONS) {
            changed = false;
            iterations++;

            const regex = patternToRegex(pattern.match);
            const varNames = extractVarNames(pattern.match);

            src = src.replace(regex, (...args) => {
                changed = true;
                const fullMatch = args[0];
                const captures = args.slice(1, -2);
                const matchStart = args[args.length - 2];
                const matchEnd = matchStart + fullMatch.length;

                const varMap = {};
                for (let i = 0; i < varNames.length; i++) {
                    varMap[varNames[i]] = captures[i] || '';
                }

                const _pre  = src.slice(0, matchStart);
                const _post = src.slice(matchEnd);

                let result = pattern.replace;

                // variáveis normais
                for (const [key, val] of Object.entries(varMap)) {
                    const escaped = escapeRegex(key);
                    result = result.replace(new RegExp(escaped + '(?![A-Za-z0-9_])', 'g'), val);
                }

                // unique
                result = result.replace(new RegExp(`${escapeRegex(S)}unique\\b`, 'g'),
                    () => counterState.genUnique()
                );

                // concat sigil-sigil
                const S2 = S + S;
                result = result.replace(new RegExp(escapeRegex(S2), 'g'), '');

                // clear
                const clearRe = new RegExp(`${escapeRegex(S)}clear\\b`, 'g');
                if (clearRe.test(result)) {
                    result = result.replace(clearRe, '');
                    globalClearFlag = true;
                }

                // pre/post/match
                result = result
                    .replace(new RegExp(`${escapeRegex(S)}pre\\b`, 'g'), _pre)
                    .replace(new RegExp(`${escapeRegex(S)}post\\b`, 'g'), _post)
                    .replace(new RegExp(`${escapeRegex(S)}match\\b`, 'g'), fullMatch);

                lastResult = result;
                return result;
            });

            if (globalClearFlag) {
                src = lastResult;
                globalClearFlag = false;
                changed = true;
            }
        }
    }

    return src;
}

function expandMacros(src, macros) {
    const S = SIGIL;

    for (const name of Object.keys(macros)) {
        const body = macros[name];
        let changed = true;
        let iterations = 0;

        while (changed && iterations < MAX_ITERATIONS) {
            changed = false;
            iterations++;

            const originalSrc = src;
            let i = 0;
            let result = '';

            while (i < src.length) {
                const remaining = src.slice(i);
                const nameMatch = remaining.match(new RegExp(`^(.*?)\\b${escapeRegex(name)}\\b`, 's'));
                if (!nameMatch) { result += remaining; break; }

                result += nameMatch[1];
                i += nameMatch[0].length;

                let k = i;
                while (k < src.length && src[k] === ' ') k++;

                let vals = [];

                if (k < src.length && src[k] === '(') {
                    const [argsStr, posAfter] = extractBlock(src, k, '(', ')');
                    vals = argsStr.split(',').map(v => v.trim());
                    i = posAfter;
                    changed = true;
                } else {
                    const m = src.slice(i).match(/^(\s+([^\s{};()]+(?:\s+[^\s{};()]+)*?))?(?=\s*[{};()$]|\n|$)/);
                    if (m && m[2]) {
                        vals = m[2].split(/\s+/);
                        i += m[0].length;
                        changed = true;
                    } else {
                        result += name;
                        continue;
                    }
                }

                let exp = body;

                exp = exp.replace(new RegExp(`${escapeRegex(S)}0\\b`, 'g'), name);

                for (let j = 0; j < vals.length; j++) {
                    const num = j + 1;
                    exp = exp.replace(new RegExp(`${escapeRegex(S)}${num}\\b`, 'g'), vals[j]);
                }

                exp = exp.replace(new RegExp(`${escapeRegex(S)}\\d+\\b`, 'g'), '');

                result += exp;
            }

            src = result;
            if (src === originalSrc) changed = false;
        }
    }

    return src;
}


function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collapseLocalNewlines(left, right) {
    // remove excesso no fim do trecho anterior
    left = left.replace(/\n+$/, '\n');
    // remove excesso no começo do trecho posterior
    right = right.replace(/^\n+/, '\n');
    
    // se ambos começam/terminam com \n, acaba duplicando.
    // força ficar apenas UM \n entre eles.
    if (left.endsWith('\n') && right.startsWith('\n')) {
        right = right.replace(/^\n+/, '\n');
    }
    
    // remove newline inicial se não houver nada antes
    if (left === '' && right.startsWith('\n')) {
        right = right.replace(/^\n+/, '');
    }

    return left + right;
}

function processEvalBlocks(src) {
    const evalRegex = new RegExp(`\\beval\\s*\\${OPEN}`, "g");

    let match;
    const matches = [];

    while ((match = evalRegex.exec(src)) !== null) {
        matches.push({
            matchStart: match.index,
            openPos: match.index + match[0].length - 1
        });
    }

    for (let j = matches.length - 1; j >= 0; j--) {
        const m = matches[j];

        const [content, posAfter] = extractBlock(src, m.openPos, OPEN, CLOSE);

        let out = "";
        try {
            out = String(
                Function("papagaio", "ctx", `"use strict"; return (${content});`)
                (papagaio, { })
            );
        } catch (e) {
            out = "";
        }

        let left = src.substring(0, m.matchStart);
        let right = src.substring(posAfter);
        src = left + out + right;
    }

    return src;
}

// === PROCESSAMENTO DE BLOCOS ISOLADOS ===
function processLocalBlocks(src) {
    const localRegex = new RegExp(`\\blocal\\s*\\${OPEN}`, "g");

    let match;
    const matches = [];

    while ((match = localRegex.exec(src)) !== null) {
        matches.push({
            matchStart: match.index,
            openPos: match.index + match[0].length - 1
        });
    }

    for (let j = matches.length - 1; j >= 0; j--) {
        const m = matches[j];
        const [content, posAfter] = extractBlock(src, m.openPos, OPEN, CLOSE);

        const processedContent = papagaio(content);

        let left = src.substring(0, m.matchStart);
        let right = src.substring(posAfter);

        let prefix = "";
        if (left.endsWith("\n")) {
            prefix = "\n";
            left = left.slice(0, -1);
        }

        src = left + prefix + processedContent + right;
    }

    return src;
}

function processEarlyBlocks(src) {
    const re = new RegExp(`\\bearly\\s*\\${OPEN}`, "g");
    let match;
    const matches = [];

    while ((match = re.exec(src)) !== null) {
        matches.push({
            matchStart: match.index,
            openPos: match.index + match[0].length - 1
        });
    }

    for (let j = matches.length - 1; j >= 0; j--) {
        const m = matches[j];

        const [content, posAfter] = extractBlock(src, m.openPos, OPEN, CLOSE);

        const out = processEarlyBlocks(content); // recursivo

        src = src.substring(0, m.matchStart) + out + src.substring(posAfter);
    }

    return src;
}

function processLateBlocks(src) {
    const re = new RegExp(`\\blate\\s*\\${OPEN}`, "g");
    let match;
    const matches = [];

    while ((match = re.exec(src)) !== null) {
        matches.push({
            matchStart: match.index,
            openPos: match.index + match[0].length - 1
        });
    }

    for (let j = matches.length - 1; j >= 0; j--) {
        const m = matches[j];

        const [content, posAfter] = extractBlock(src, m.openPos, OPEN, CLOSE);

        const out = processLateBlocks(content); // recursivo

        src = src.substring(0, m.matchStart) + out + src.substring(posAfter);
    }

    return src;
}

function papagaio(input) {
    let src = input;

    // pré-passagem
    src = processEarlyBlocks(src);

    // passagem principal
    src = processLocalBlocks(src);
    src = processEvalBlocks(src);

    const [macros, s1] = collectMacros(src);
    src = s1;

    const [patterns, s2] = collectPatterns(src);
    src = s2;

    src = applyPatterns(src, patterns);
    src = expandMacros(src, macros);

    // pós-passagem
    src = processLateBlocks(src);

    return src;
}


// Export para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
    // Node.js / CommonJS
    module.exports = { papagaio };
} else if (typeof exports !== 'undefined') {
    // Browser / QuickJS
    exports.papagaio = papagaio;
}
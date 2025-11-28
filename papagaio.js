// ============================================
// papagaio - a easy to use preprocessor
// ============================================

class Papagaio {
    version = "0.1.1";
    maxRecursion = 512;
    
    // Private state
    #counterState = { value: 0, unique: 0 };
    
    // Public configuration
    delimiters = [["{", "}"]];
    sigil = "$";
    
    // Public state - processing state
    content = "";
    #matchContent = "";
    #scopeContent = "";
    #evalContent = "";

    constructor() {
        this.#resetCounterState();
    }

    // ============================================
    // PUBLIC API
    // ============================================

    process(input) {
        this.content = input;

        let src = input;
        let last = null;
        let iter = 0;

        const open = this.#getDefaultOpen();   // delimitador atual
        const close = this.#getDefaultClose();

        // regex para detectar blocos papagaio remanescentes
        const pending = () => {
            const rEval    = new RegExp(`\\beval\\s*\\${open}`, "g");
            const rScope   = new RegExp(`\\bscope\\s*\\${open}`, "g");
            const rPattern = new RegExp(`\\bpattern\\s*\\${open}`, "g");
            const rMacro   = new RegExp(`\\bmacro\\s+[A-Za-z_][A-Za-z0-9_]*\\s*\\${open}`, "g");
            return rEval.test(src)
                || rScope.test(src)
                || rPattern.test(src)
                || rMacro.test(src);
        };

        // fixpoint loop
        while (src !== last && iter < this.maxRecursion) {
            iter++;
            last = src;

            // --- pipeline padrão ---
            src = this.#processScopeBlocks(src);
            src = this.#processEvalBlocks(src);

            const [macros, s1] = this.#collectMacros(src);
            src = s1;

            const [patterns, s2] = this.#collectPatterns(src);
            src = s2;

            src = this.#applyPatterns(src, patterns);
            src = this.#expandMacros(src, macros);

            // --- se sobrou bloco papagaio → roda de novo ---
            if (!pending()) break;
        }

        this.content = src;
        return src;
    }

    // ============================================
    // PRIVATE METHODS
    // ============================================

    #resetCounterState() {
        this.#counterState.value = 0;
        this.#counterState.unique = 0;
    }

    #genUnique() {
        return "u" + (this.#counterState.unique++).toString(36);
    }

    #findClosingDelim(open) {
        for (const [o, c] of this.delimiters) {
            if (o === open) return c;
        }
        return null;
    }

    #isRegisteredOpen(ch) {
        return this.delimiters.some(([o, _]) => o === ch);
    }

    #getDefaultOpen() {
        return this.delimiters[0][0];
    }

    #getDefaultClose() {
        return this.delimiters[0][1];
    }

    #extractBlock(src, openpos, open = null, close = null) {
        if (!open) open = this.#getDefaultOpen();
        if (!close) close = this.#getDefaultClose();

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

    #patternToRegex(pattern) {
        let regex = '';
        let i = 0;

        const S = this.sigil;
        const S2 = this.sigil + this.sigil;
        const open = this.#getDefaultOpen();
        const close = this.#getDefaultClose();

        while (i < pattern.length) {
            if (pattern.startsWith(S2, i)) {
                regex += '\\s*';
                i += S2.length;
                continue;
            }

            if (this.#isRegisteredOpen(pattern[i]) && pattern.startsWith(S, i + 1)) {
                const openDelim = pattern[i];
                const closeDelim = this.#findClosingDelim(openDelim);

                let j = i + 1 + S.length;
                while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) j++;

                if (j < pattern.length && pattern[j] === closeDelim) {
                    const escapedOpen = this.#escapeRegex(openDelim);
                    const escapedClose = this.#escapeRegex(closeDelim);
                    const innerRegex = this.#buildBalancedBlockRegex(openDelim, closeDelim);

                    regex += `${escapedOpen}(${innerRegex})${escapedClose}`;
                    i = j + 1;
                    continue;
                }
            }

            if (pattern[i] === S) {
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

                    if (token) {
                        const escapedToken = this.#escapeRegex(token);
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

                regex += this.#escapeRegex(S);
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

    #buildBalancedBlockRegex(open, close) {
        const escapedOpen = open === '(' ? '\\(' : (open === '[' ? '\\[' : open === '{' ? '\\{' : open === '<' ? '\\<' : open);
        const escapedClose = close === ')' ? '\\)' : (close === ']' ? '\\]' : close === '}' ? '\\}' : close === '>' ? '\\>' : close);

        return `(?:[^${escapedOpen}${escapedClose}\\\\]|\\\\.|${escapedOpen}(?:[^${escapedOpen}${escapedClose}\\\\]|\\\\.)*${escapedClose})*`;
    }

    #extractVarNames(pattern) {
        const vars = [];
        const seen = new Set();
        const S = this.sigil;
        let i = 0;

        while (i < pattern.length) {
            if (this.#isRegisteredOpen(pattern[i]) && pattern.startsWith(S, i + 1)) {
                const openDelim = pattern[i];
                const closeDelim = this.#findClosingDelim(openDelim);

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

    #collectMacros(src) {
        const macros = {};
        const open = this.#getDefaultOpen();
        const macroRegex = new RegExp(`\\bmacro\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\${open}`, "g");

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
            const [body, posAfter] = this.#extractBlock(src, m.openPos);
            macros[m.name] = body;

            let left = src.substring(0, m.matchStart);
            let right = src.substring(posAfter);
            src = this.#collapseLocalNewlines(left, right);
        }

        return [macros, src];
    }

    #patternDepthAt(src, pos) {
        const open = "pattern";
        let depth = 0;

        // scaneia até 'pos' contando quantos pattern{ e } ocorreram
        let i = 0;
        while (i < pos) {
            // identificação de pattern{
            if (src.startsWith("pattern", i)) {
                let j = i + 7;
                while (j < src.length && /\s/.test(src[j])) j++;

                if (src[j] === "{") {
                    depth++;
                }
            }

            if (src[i] === "}") {
                if (depth > 0) depth--;
            }

            i++;
        }

        return depth;
    }


    #collectPatterns(src) {
        const patterns = [];
        const open = this.#getDefaultOpen();
        const close = this.#getDefaultClose();
        const patternRegex = /\bpattern\s*\{/g;

        let resultSrc = src;
        let out = "";
        let i = 0;

        while (i < resultSrc.length) {
            patternRegex.lastIndex = i;
            const m = patternRegex.exec(resultSrc);
            if (!m) break;

            const start = m.index;

            // Antes de aceitar, precisamos saber se estamos dentro de outro pattern
            const depth = this.#patternDepthAt(resultSrc, start);

            if (depth > 0) {
                // pattern interno: pula, não coleta, não remove
                i = start + 1;
                continue;
            }

            // Coletar pattern de nível global
            const openPos = m.index + m[0].length - 1;
            const [matchPattern, posAfterMatch] = this.#extractBlock(resultSrc, openPos);

            let k = posAfterMatch;
            while (k < resultSrc.length && /\s/.test(resultSrc[k])) k++;

            if (k < resultSrc.length && resultSrc[k] === open) {
                const [replacePattern, posAfterReplace] = this.#extractBlock(resultSrc, k);

                patterns.push({
                    match: matchPattern.trim(),
                    replace: replacePattern.trim()
                });

                // Remove o bloco completo do src
                resultSrc =
                    resultSrc.slice(0, start) +
                    resultSrc.slice(posAfterReplace);

                // Continua logo após o ponto removido
                i = start;
                continue;
            }

            i = start + 1;
        }

        return [patterns, resultSrc];
    }

    #applyPatterns(src, patterns) {
        let globalClearFlag = false;
        let lastResult = "";
        const S = this.sigil;

        for (const pattern of patterns) {
            let changed = true;
            let iterations = 0;

            while (changed && iterations < this.maxRecursion) {
                changed = false;
                iterations++;

                const regex = this.#patternToRegex(pattern.match);
                const varNames = this.#extractVarNames(pattern.match);

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

                    this.#matchContent = fullMatch;

                    const _pre = src.slice(0, matchStart);
                    const _post = src.slice(matchEnd);

                    let result = pattern.replace;

                    for (const [key, val] of Object.entries(varMap)) {
                        const escaped = this.#escapeRegex(key);
                        result = result.replace(new RegExp(escaped + '(?![A-Za-z0-9_])', 'g'), val);
                    }

                    result = result.replace(new RegExp(`${this.#escapeRegex(S)}unique\\b`, 'g'),
                        () => this.#genUnique()
                    );

                    const S2 = S + S;
                    result = result.replace(new RegExp(this.#escapeRegex(S2), 'g'), '');

                    const clearRe = new RegExp(`${this.#escapeRegex(S)}clear\\b`, 'g');
                    if (clearRe.test(result)) {
                        result = result.replace(clearRe, '');
                        globalClearFlag = true;
                    }

                    result = result
                        .replace(new RegExp(`${this.#escapeRegex(S)}pre\\b`, 'g'), _pre)
                        .replace(new RegExp(`${this.#escapeRegex(S)}post\\b`, 'g'), _post)
                        .replace(new RegExp(`${this.#escapeRegex(S)}match\\b`, 'g'), fullMatch);

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

    #expandMacros(src, macros) {
        const S = this.sigil;

        for (const name of Object.keys(macros)) {
            const body = macros[name];
            let changed = true;
            let iterations = 0;

            while (changed && iterations < this.maxRecursion) {
                changed = false;
                iterations++;

                const callRegex = new RegExp(`\\b${this.#escapeRegex(name)}\\s*\\(`, 'g');
                
                let match;
                const matches = [];

                while ((match = callRegex.exec(src)) !== null) {
                    matches.push({
                        matchStart: match.index,
                        openPos: match.index + match[0].length - 1
                    });
                }

                for (let j = matches.length - 1; j >= 0; j--) {
                    const m = matches[j];
                    const [argsStr, posAfter] = this.#extractBlock(src, m.openPos, '(', ')');
                    const vals = argsStr.split(',').map(v => v.trim());

                    let exp = body;

                    // Substituição flexível de $0, $1, $2 etc, mesmo dentro de palavras
                    for (let k = vals.length; k >= 0; k--) {
                        const sigil = k === 0 ? S + '0' : S + k;
                        const pattern = new RegExp(this.#escapeRegex(sigil) + '(?![0-9])', 'g');
                        const replacement = k === 0 ? name : (vals[k - 1] !== undefined ? vals[k - 1] : '');
                        exp = exp.replace(pattern, replacement);
                    }

                    let left = src.substring(0, m.matchStart);
                    let right = src.substring(posAfter);
                    src = left + exp + right;
                    changed = true;
                }
            }
        }

        return src;
    }

    #escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    #collapseLocalNewlines(left, right) {
        left = left.replace(/\n+$/, '\n');
        right = right.replace(/^\n+/, '\n');

        if (left.endsWith('\n') && right.startsWith('\n')) {
            right = right.replace(/^\n+/, '\n');
        }

        if (left === '' && right.startsWith('\n')) {
            right = right.replace(/^\n+/, '');
        }

        return left + right;
    }

    #processEvalBlocks(src) {
        const open = this.#getDefaultOpen();
        const evalRegex = new RegExp(`\\beval\\s*\\${open}`, "g");

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

            const [content, posAfter] = this.#extractBlock(src, m.openPos);
            this.#evalContent = content;

            let out = "";
            try {
                // O conteúdo é o corpo de uma função autoinvocada
                const wrappedCode = `"use strict"; return (function() { ${content} })();`;

                out = String(
                    Function("papagaio", "ctx", wrappedCode)(this, {})
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

    #processScopeBlocks(src) {
        const open = this.#getDefaultOpen();
        const scopeRegex = new RegExp(`\\bscope\\s*\\${open}`, "g");

        let match;
        const matches = [];

        while ((match = scopeRegex.exec(src)) !== null) {
            matches.push({
                matchStart: match.index,
                openPos: match.index + match[0].length - 1
            });
        }

        for (let j = matches.length - 1; j >= 0; j--) {
            const m = matches[j];
            const [content, posAfter] = this.#extractBlock(src, m.openPos);

            this.#scopeContent = content;
            const processedContent = this.process(content);

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


}

// Export para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Papagaio };
} else if (typeof exports !== 'undefined') {
    exports.Papagaio = Papagaio;
}
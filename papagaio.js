// ============================================
// papagaio - a easy to use preprocessor
// ============================================

export class Papagaio {
    maxRecursion = 512;
    
    // Private state
    #counterState = { value: 0, unique: 0 };
    
    // Public configuration
    delimiters = [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
    ];
    sigil = "$";
    keywords = {
        pattern: "pattern",
        context: "context"
    };
    
    // Public state - processing state
    content = "";

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
            const rContext   = new RegExp(`\\b${this.keywords.context}\\s*\\${open}`, "g");
            const rPattern = new RegExp(`\\b${this.keywords.pattern}\\s*\\${open}`, "g");
            return rContext.test(src)
                || rPattern.test(src)
        };

        // fixpoint loop
        while (src !== last && iter < this.maxRecursion) {
            iter++;
            last = src;

            // --- pipeline padrão ---
            src = this.#processContextBlocks(src);

            const [patterns, s2] = this.#collectPatterns(src);
            src = s2;

            src = this.#applyPatterns(src, patterns);

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

                    // Aqui convertemos o token em uma parte de regex:
                    // - qualquer ocorrência de $$ (S2) vira \s*
                    // - o restante é escapado apropriadamente
                    let tokenRegex = '';
                    if (token.length === 0) {
                        tokenRegex = ''; // sem token → apenas captura sem terminador
                    } else {
                        // dividir pelo S2 e escapar cada pedaço literal
                        const parts = token.split(S2);
                        tokenRegex = parts.map(p => this.#escapeRegex(p)).join('\\s*');
                    }

                    // captura não-gulosa para o ... seguida do token interpretado
                    regex += `((?:.|\\r|\\n)*?)${tokenRegex}`;
                    i = j;
                    continue;
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

    #patternDepthAt(src, pos) {
        const open = this.keywords.pattern;
        let depth = 0;

        // scaneia até 'pos' contando quantos pattern{ e } ocorreram
        let i = 0;
        while (i < pos) {
            // identificação de pattern{
            if (src.startsWith(this.keywords.pattern, i)) {
                let j = i + this.keywords.pattern.length;
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
        const patternRegex = new RegExp(`\\b${this.keywords.pattern}\\s*\\{`, "g");

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

                    result = result.replace(/\$eval\{([^}]*)\}/g, (_, code) => {
                        try {
                            // O conteúdo é o corpo de uma função autoinvocada
                            const wrappedCode = `"use strict"; return (function() { ${code} })();`;

                            let out = String(
                                Function("papagaio", "ctx", wrappedCode)(this, {})
                            );
                            return out;
                        } catch {
                            return "";
                        }
                    });

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

    #escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    #processContextBlocks(src) {
        const open = this.#getDefaultOpen();
        const contextRegex = new RegExp(`\\b${this.keywords.context}\\s*\\${open}`, "g");

        let match;
        const matches = [];

        while ((match = contextRegex.exec(src)) !== null) {
            matches.push({
                matchStart: match.index,
                openPos: match.index + match[0].length - 1
            });
        }

        for (let j = matches.length - 1; j >= 0; j--) {
            const m = matches[j];
            const [content, posAfter] = this.#extractBlock(src, m.openPos);

            if (!content.trim()) {
                // Contexto vazio → apenas remove a palavra "context" mas mantém o resto intacto
                src = src.slice(0, m.matchStart) + src.slice(posAfter);
                continue;
            }

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
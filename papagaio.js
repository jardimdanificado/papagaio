// ============================================
// papagaio - a easy to use preprocessor (simplified)
// ============================================

export class Papagaio {
    maxRecursion = 512;
    
    // Private state
    #counterState = { value: 0, unique: 0 };
    
    // Public configuration
    open = "{";
    close = "}";
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

        // regex para detectar blocos papagaio remanescentes
        const pending = () => {
            const rContext = new RegExp(`\\b${this.keywords.context}\\s*\\${this.open}`, "g");
            const rPattern = new RegExp(`\\b${this.keywords.pattern}\\s*\\${this.open}`, "g");
            return rContext.test(src) || rPattern.test(src);
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

    #extractBlock(src, openpos) {
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

            if (ch === this.open) {
                depth++;
                if (startInner === null) startInner = i + 1;
            } else if (ch === this.close) {
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
        const balancedInfo = [];

        while (i < pattern.length) {
            if (pattern.startsWith(S2, i)) {
                regex += '\\s*';
                i += S2.length;
                continue;
            }

            // Detect: $block {name} {open} {close}
            if (pattern.startsWith(S + 'block', i)) {
                let j = i + S.length + 'block'.length;
                
                // Skip whitespace
                while (j < pattern.length && /\s/.test(pattern[j])) j++;
                
                // Extract {name}
                if (j < pattern.length && pattern[j] === this.open) {
                    const [nameContent, nameEnd] = this.#extractBlock(pattern, j);
                    const varName = nameContent.trim();
                    j = nameEnd;
                    
                    // Skip whitespace
                    while (j < pattern.length && /\s/.test(pattern[j])) j++;
                    
                    // Extract {open}
                    let openDelim = this.open;
                    if (j < pattern.length && pattern[j] === this.open) {
                        const [openContent, openEnd] = this.#extractBlock(pattern, j);
                        openDelim = openContent.trim() || this.open;
                        j = openEnd;
                        
                        // Skip whitespace
                        while (j < pattern.length && /\s/.test(pattern[j])) j++;
                    }
                    
                    // Extract {close}
                    let closeDelim = this.close;
                    if (j < pattern.length && pattern[j] === this.open) {
                        const [closeContent, closeEnd] = this.#extractBlock(pattern, j);
                        closeDelim = closeContent.trim() || this.close;
                        
                        // Armazena info de balanced para processar depois
                        balancedInfo.push({
                            index: regex.length,
                            openDelim,
                            closeDelim
                        });
                        
                        // Adiciona placeholder
                        regex += '(BALANCED_CAPTURE)';
                        
                        i = closeEnd;
                        continue;
                    }
                }
            }

            if (pattern[i] === S) {
                let j = i + S.length;
                let varName = '';
                while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) {
                    varName += pattern[j];
                    j++;
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

        // Agora substitui os placeholders por regex balanceados reais
        let finalRegex = regex;
        for (let idx = balancedInfo.length - 1; idx >= 0; idx--) {
            const info = balancedInfo[idx];
            const escapedOpen = this.#escapeRegex(info.openDelim);
            const escapedClose = this.#escapeRegex(info.closeDelim);
            
            // Regex para capturar balanceado
            const balancedRegex = `${escapedOpen}([\\s\\S]*?)${escapedClose}`;
            finalRegex = finalRegex.replace('(BALANCED_CAPTURE)', balancedRegex);
        }

        return new RegExp(finalRegex, 'g');
    }

    #extractVarNamesWithBalanced(pattern) {
        const vars = [];
        const seen = new Set();
        const S = this.sigil;
        let i = 0;

        while (i < pattern.length) {
            // Detect: $block {name} {open} {close}
            if (pattern.startsWith(S + 'block', i)) {
                let j = i + S.length + 'block'.length;
                
                // Skip whitespace
                while (j < pattern.length && /\s/.test(pattern[j])) j++;
                
                // Extract {name}
                if (j < pattern.length && pattern[j] === this.open) {
                    const [nameContent, nameEnd] = this.#extractBlock(pattern, j);
                    const varName = nameContent.trim();
                    
                    if (varName && !seen.has(varName)) {
                        vars.push(S + varName);
                        seen.add(varName);
                    }
                    
                    j = nameEnd;
                    
                    // Skip {open}
                    while (j < pattern.length && /\s/.test(pattern[j])) j++;
                    if (j < pattern.length && pattern[j] === this.open) {
                        this.#extractBlock(pattern, j);
                        j = this.#extractBlock(pattern, j)[1];
                    }
                    
                    // Skip {close}
                    while (j < pattern.length && /\s/.test(pattern[j])) j++;
                    if (j < pattern.length && pattern[j] === this.open) {
                        this.#extractBlock(pattern, j);
                        j = this.#extractBlock(pattern, j)[1];
                    }
                    
                    i = j;
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
        let depth = 0;

        let i = 0;
        while (i < pos) {
            if (src.startsWith(this.keywords.pattern, i)) {
                let j = i + this.keywords.pattern.length;
                while (j < src.length && /\s/.test(src[j])) j++;

                if (src[j] === this.open) {
                    depth++;
                }
            }

            if (src[i] === this.close) {
                if (depth > 0) depth--;
            }

            i++;
        }

        return depth;
    }

    #collectPatterns(src) {
        const patterns = [];
        const patternRegex = new RegExp(`\\b${this.keywords.pattern}\\s*\\${this.open}`, "g");

        let resultSrc = src;
        let i = 0;

        while (i < resultSrc.length) {
            patternRegex.lastIndex = i;
            const m = patternRegex.exec(resultSrc);
            if (!m) break;

            const start = m.index;

            const depth = this.#patternDepthAt(resultSrc, start);

            if (depth > 0) {
                i = start + 1;
                continue;
            }

            const openPos = m.index + m[0].length - 1;
            const [matchPattern, posAfterMatch] = this.#extractBlock(resultSrc, openPos);

            let k = posAfterMatch;
            while (k < resultSrc.length && /\s/.test(resultSrc[k])) k++;

            if (k < resultSrc.length && resultSrc[k] === this.open) {
                const [replacePattern, posAfterReplace] = this.#extractBlock(resultSrc, k);

                patterns.push({
                    match: matchPattern.trim(),
                    replace: replacePattern.trim()
                });

                resultSrc =
                    resultSrc.slice(0, start) +
                    resultSrc.slice(posAfterReplace);

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
                const varNames = this.#extractVarNamesWithBalanced(pattern.match);

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

                    const _prefix = src.slice(0, matchStart);
                    const _suffix = src.slice(matchEnd);

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
                        .replace(new RegExp(`${this.#escapeRegex(S)}prefix\\b`, 'g'), _prefix)
                        .replace(new RegExp(`${this.#escapeRegex(S)}suffix\\b`, 'g'), _suffix)
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
        const contextRegex = new RegExp(`\\b${this.keywords.context}\\s*\\${this.open}`, "g");

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
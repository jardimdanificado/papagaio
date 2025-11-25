// ============================================
// painho
// ============================================

const painho_version = "0.0.3"
const MAX_ITERATIONS = 512;
let globalClearFlag = false;

function stripDoubleHashWS(s) {
    // remove whitespace adjacente à esquerda e direita de cada ##
    return s.replace(/(\s*)##(\s*)/g, "");
}


// === EXTRAÇÃO DE BLOCO BALANCEADO ===
function extractBlock(src, openpos, open, close) {
    let i = openpos;
    let depth = 0;
    let startInner = null;
    let inString = false;
    let strChar = '';
    while (i < src.length) {
        let ch = src[i];
        if (inString) {
            if (ch === '\\') {
                i += 2;
                continue;
            }
            if (ch === strChar) {
                inString = false;
                strChar = '';
            }
            i++;
            continue;
        } else {
            if (ch === '"' || ch === "'") {
                inString = true;
                strChar = ch;
                i++;
                continue;
            }
        }
        if (ch === open) {
            depth++;
            if (startInner === null) {
                startInner = i + 1;
            }
        } else if (ch === close) {
            depth--;
            if (depth === 0) {
                const inner = startInner !== null 
                    ? src.substring(startInner, i) 
                    : '';
                const posAfterClose = i + 1;
                return [inner, posAfterClose];
            }
        }
        i++;
    }
    const inner = startInner !== null 
        ? src.substring(startInner) 
        : '';
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
    let varCounter = 0;

    while (i < pattern.length) {
        // --- match exclusivo de whitespace personalizado ---
        // #n  -> exatamente "\n"
        // ##n -> zero ou mais "\n"
        // #s  -> exatamente " "
        // ##s -> zero ou mais " "
        // #t  -> exatamente "\t"
        // ##t -> zero ou mais "\t"
        if (pattern[i] === '#') {
            let count = 1;
            let j = i + 1;

            // conta quantidade de #
            while (j < pattern.length && pattern[j] === '#') {
                count++;
                j++;
            }

            // pega o tipo (#n #s #t)
            const type = pattern[j];
            if (type === 'n' || type === 's' || type === 't') {
                const unit =
                    type === 'n' ? '\\n' :
                    type === 's' ? ' '   :
                                '\\t';

                // 1 # → 1 unidade literal
                // 2+ # → zero ou mais
                if (count === 1) {
                    regex += unit;
                } else {
                    regex += unit + '*';
                }

                i = j + 1;
                continue;
            }
        }

        // Verifica por $$
        if (i + 1 < pattern.length && pattern[i] === '$' && pattern[i + 1] === '$') {
            regex += '\\s*';
            i += 2;
            continue;
        }

        // Verifica por delimitadores com variáveis: {$var}, ($var), [$var]
        if ((pattern[i] === '{' || pattern[i] === '(' || pattern[i] === '[') &&
            i + 1 < pattern.length && pattern[i + 1] === '$') {

            const openDelim = pattern[i];
            const closeDelim = openDelim === '{' ? '}' : (openDelim === '(' ? ')' : ']');

            // Captura nome da variável
            let j = i + 2; // pula o delimitador e o $
            while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) {
                j++;
            }

            // Verifica se fecha com o delimitador correto
            if (j < pattern.length && pattern[j] === closeDelim) {
                const escapedOpen = openDelim === '(' ? '\\(' : (openDelim === '[' ? '\\[' : openDelim === '{' ? '\\{' : openDelim);
                const escapedClose = closeDelim === ')' ? '\\)' : (closeDelim === ']' ? '\\]' : closeDelim === '}' ? '\\}' : closeDelim);

                // Usa a função auxiliar para capturar blocos balanceados
                const innerRegex = buildBalancedBlockRegex(openDelim, closeDelim);

                regex += escapedOpen + '(' + innerRegex + ')' + escapedClose;
                varCounter++;
                i = j + 1;
                continue;
            }
        }

        // Verifica por captura até token: $var...token
        if (pattern[i] === '$') {
            let j = i + 1;
            let varName = '';
            while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) {
                varName += pattern[j];
                j++;
            }

            if (varName && j < pattern.length && pattern[j] === '.' && j + 2 < pattern.length && pattern[j + 1] === '.' && pattern[j + 2] === '.') {
                // Achamos $var...
                j += 3; // pula ...
                let token = '';
                while (j < pattern.length && /\S/.test(pattern[j])) { // Lê até encontrar um espaço ou fim
                    token += pattern[j];
                    j++;
                }

                if (token) {
                    // Escapa o token para regex
                    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // Captura qualquer coisa até o token (não-greedy)
                    regex += '((?:.|\\r|\\n)*?)' + escapedToken;
                    varCounter++;
                    i = j;
                    continue;
                }
            }

            // Se não for ...token, apenas captura variável normal
            if (varName) {
                regex += '(\\S+)';
                varCounter++;
                i = j;
            } else {
                regex += '\\$';
                i++;
            }
            continue;
        }

        if (/\s/.test(pattern[i])) {
            // Qualquer whitespace vira \s+
            regex += '\\s+';
            // Pula todos os espaços consecutivos no pattern
            while (i < pattern.length && /\s/.test(pattern[i])) {
                i++;
            }
        } else {
            // Caractere literal (escapa se necessário)
            const char = pattern[i];
            if (/[.*+?^${}()|[\]\\]/.test(char)) {
                regex += '\\' + char;
            } else {
                regex += char;
            }
            i++;
        }
    }

    return new RegExp(regex, 'g');
}

// Função auxiliar para gerar regex que captura blocos balanceados
function buildBalancedBlockRegex(open, close) {
    const escapedOpen = open === '(' ? '\\(' : (open === '[' ? '\\[' : open === '{' ? '\\{' : open);
    const escapedClose = close === ')' ? '\\)' : (close === ']' ? '\\]' : close === '}' ? '\\}' : close);

    // Regex para capturar blocos balanceados
    // Ex: {a{b}c} -> captura a{b}c
    return `(?:[^${escapedOpen}${escapedClose}\\\\]|\\\\.|${escapedOpen}(?:[^${escapedOpen}${escapedClose}\\\\]|\\\\.)*${escapedClose})*`;
}

// Versão corrigida de extractVarNames
function extractVarNames(pattern) {
    const vars = [];
    const seen = new Set();
    let i = 0;

    while (i < pattern.length) {
        // Verifica por $$
        if (i + 1 < pattern.length && pattern[i] === '$' && pattern[i + 1] === '$') {
            i += 2;
            continue;
        }

        // Verifica por delimitadores com variáveis
        if ((pattern[i] === '{' || pattern[i] === '(' || pattern[i] === '[') &&
            i + 1 < pattern.length && pattern[i + 1] === '$') {

            const closeDelim = pattern[i] === '{' ? '}' : (pattern[i] === '(' ? ')' : ']');
            let j = i + 2;

            while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) {
                j++;
            }

            if (j < pattern.length && pattern[j] === closeDelim) {
                const varName = pattern.substring(i + 2, j);
                if (!seen.has(varName)) {
                    vars.push('$' + varName);
                    seen.add(varName);
                }
                i = j + 1;
                continue;
            }
        }

        // Verifica por captura até token: $var...token
        if (pattern[i] === '$') {
            let j = i + 1;
            let varName = '';
            while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) {
                varName += pattern[j];
                j++;
            }

            if (varName && j < pattern.length && pattern[j] === '.' && j + 2 < pattern.length && pattern[j + 1] === '.' && pattern[j + 2] === '.') {
                // Achamos $var...
                j += 3; // pula ...
                let token = '';
                while (j < pattern.length && /\S/.test(pattern[j])) { // Lê até encontrar um espaço ou fim
                    token += pattern[j];
                    j++;
                }

                if (token && !seen.has(varName)) {
                    vars.push('$' + varName);
                    seen.add(varName);
                }
                i = j;
                continue;
            }

            if (varName && !seen.has(varName)) {
                vars.push('$' + varName);
                seen.add(varName);
            }
            i = j;
        } else {
            i++;
        }
    }

    return vars;
}

// Processa operadores de contador ($counter, $counter++, $counter--)
function processCounterOperators(str) {
    // $counter++ -> incrementa
    str = str.replace(/\$counter\+\+/g, () => {
        counterState.value++;
        return "";
    });
    
    // $counter-- -> decrementa
    str = str.replace(/\$counter--/g, () => {
        counterState.value--;
        return "";
    });
    
    // $counter -> retorna valor atual (sem modificar)
    str = str.replace(/\$counter(?!\+|-)/g, () => {
        return counterState.value.toString();
    });
    
    return str;
}

// ============================================
// INTEGRAÇÕES PRINCIPAIS
// ============================================

// === COLETA DE MACROS (MODIFICADA) ===
function collectMacros(src) {
    const macros = {};
    const macroRegex = /\bmacro\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
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
        const [body, posAfter] = extractBlock(src, m.openPos, '{', '}');
        // Processa contadores no corpo do macro
        macros[m.name] = processCounterOperators(body);
        // remove também whitespace adjacente
        let left = src.substring(0, m.matchStart);
        let right = src.substring(posAfter);
        src = collapseLocalNewlines(left, right);
    }
    return [macros, src];
}

// === COLETA DE PATTERNS (MODIFICADA) ===
function collectPatterns(src) {
    const patterns = [];
    const patternRegex = /\bpattern\s*\{/g;
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
        const [matchPattern, posAfterMatch] = extractBlock(src, m.openPos, '{', '}');
        
        let k = posAfterMatch;
        while (k < src.length && /\s/.test(src[k])) k++;
        
        if (k < src.length && src[k] === '{') {
            const [replacePattern, posAfterReplace] = extractBlock(src, k, '{', '}');
            patterns.push({
                match: stripDoubleHashWS(matchPattern.trim()),
                replace: processCounterOperators(stripDoubleHashWS(replacePattern.trim()))
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

                // monta varMap
                const varMap = {};
                for (let i = 0; i < varNames.length; i++) {
                    varMap[varNames[i]] = captures[i] || '';
                }

                const _pre   = src.slice(0, matchStart);
                const _post  = src.slice(matchEnd);

                let result = pattern.replace;

                // --------------------------
                // substitui variáveis normais
                // --------------------------
                for (const [varName, value] of Object.entries(varMap)) {
                    const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    result = result.replace(new RegExp(escaped + '(?![A-Za-z0-9_])', 'g'), value);
                }

                // unique
                result = result.replace(/\$unique\b/g, () =>
                    counterState.genUnique()
                );

                // eval
                result = result.replace(/\$eval\{([^}]*)\}/g, (_, code) => {
                    try {
                        return String(Function("ctx", `"use strict"; return (${code})`)({
                            _pre, _post, match: fullMatch, vars: varMap
                        }));
                    } catch {
                        return "";
                    }
                });

                // counters
                result = processCounterOperators(result);

                // concat ($$ → nada)
                result = result.replace(/\$\$/g, '');

                // ======================================================
                // PATCH ESSENCIAL:
                // detectar $clear ANTES de expandir $pre/$post/$match
                // evita que "$clear##$pre" vire "$clearasddasda",
                // o que impediria a regex de detectar.
                // ======================================================
                if (/\$clear\b/.test(result)) {
                    result = result.replace(/\$clear\b/g, '');
                    globalClearFlag = true;
                }

                // agora expande $pre/$post/$match
                result = result.replace(/\$pre\b/g, _pre);
                result = result.replace(/\$post\b/g, _post);
                result = result.replace(/\$match\b/g, fullMatch);

                lastResult = result;
                return result;
            });

            // aplica clear no final da rodada
            if (globalClearFlag) {
                src = lastResult;
                globalClearFlag = false;
                changed = true; // força nova rodada com src limpo
            }
        }
    }

    return src;
}



// === EXPANSÃO DE MACROS (MODIFICADA) ===
function expandMacros(src, macros) {
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
                const remaining = src.substring(i);
                const nameMatch = remaining.match(new RegExp(`^(.*?)\\b${escapeRegex(name)}\\b`, 's'));
                
                if (!nameMatch) {
                    result += remaining;
                    break;
                }
                
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
                    const spaceMatch = src.substring(i).match(/^(\s+([^\s{};()]+(?:\s+[^\s{};()]+)*?))?(?=\s*[{};()$]|\n|$)/);
                    if (spaceMatch && spaceMatch[2]) {
                        vals = spaceMatch[2].split(/\s+/);
                        i += spaceMatch[0].length;
                        changed = true;
                    } else {
                        result += name;
                        continue;
                    }
                }
                
                let exp = body;
                exp = exp.replace(/\$0\b/g, name);
                for (let j = 0; j < vals.length; j++) {
                    const paramNum = j + 1;
                    const paramVal = vals[j];
                    exp = exp.replace(new RegExp(`\\$${paramNum}(?!\\d)`, 'g'), paramVal);
                }
                exp = exp.replace(/\$\d+\b/g, '');
                // Processa contadores na expansão do macro
                exp = processCounterOperators(exp);
                result += exp;
            }
            
            src = result;
            
            if (src === originalSrc) {
                changed = false;
            }
        }
    }
    return src;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\        src = src.replace(/(@?[A-Za-z_][@A-Za-z0-9_]*)\s*<<=\s*(@?[A-Za-z0-9_()]+(?:\s*\([^)]*\))?)/g');
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


// === FUNÇÃO PÚBLICA PRINCIPAL ===
function painho(input) {
    let src = input;
    const [macros, srcAfterMacros] = collectMacros(src);
    src = srcAfterMacros;
    const [patterns, srcAfterPatterns] = collectPatterns(src);
    src = srcAfterPatterns;
    src = applyPatterns(src, patterns);  // Aplica patterns antes de expandir macros
    src = expandMacros(src, macros);
    return src;
}

// Export para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
    // Node.js / CommonJS
    module.exports = { painho };
} else if (typeof exports !== 'undefined') {
    // Browser / QuickJS
    exports.painho = painho;
}

export class Papagaio {
  maxRecursion = 512;
  #counter = { value: 0, unique: 0 };
  open = "{";
  close = "}";
  sigil = "$";
  keywords = { pattern: "pattern", context: "context" };
  content = "";

  constructor() {
    this.#counter.value = 0;
    this.#counter.unique = 0;
  }

  process(input) {
    this.content = input;
    let src = input, last = null, iter = 0;
    const pending = () => {
      const rCtx = new RegExp(`\\b${this.keywords.context}\\s*\\${this.open}`, "g");
      const rPat = new RegExp(`\\b${this.keywords.pattern}\\s*\\${this.open}`, "g");
      return rCtx.test(src) || rPat.test(src);
    };
    while (src !== last && iter < this.maxRecursion) {
      iter++;
      last = src;
      src = this.#procContext(src);
      const [patterns, s2] = this.#collectPatterns(src);
      src = s2;
      src = this.#applyPatterns(src, patterns);
      if (!pending()) break;
    }
    return this.content = src, src;
  }

  #procContext(src) {
    const ctxRe = new RegExp(`\\b${this.keywords.context}\\s*\\${this.open}`, "g");
    let m, matches = [];
    while ((m = ctxRe.exec(src)) !== null)
      matches.push({ idx: m.index, pos: m.index + m[0].length - 1 });
    for (let j = matches.length - 1; j >= 0; j--) {
      const x = matches[j], [content, posAfter] = this.#extractBlock(src, x.pos);
      if (!content.trim()) {
        src = src.slice(0, x.idx) + src.slice(posAfter);
        continue;
      }
      const proc = this.process(content);
      let left = src.substring(0, x.idx), right = src.substring(posAfter);
      let prefix = left.endsWith("\n") ? "\n" : "";
      if (prefix) left = left.slice(0, -1);
      src = left + prefix + proc + right;
    }
    return src;
  }

  #extractBlock(src, openPos) {
    let i = openPos, depth = 0, innerStart = null, inStr = false, strChar = '';
    while (i < src.length) {
      const ch = src[i];
      if (inStr) {
        if (ch === '\\') i += 2;
        else if (ch === strChar) { inStr = false; strChar = ''; i++; }
        else i++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inStr = true;
        strChar = ch;
        i++;
        continue;
      }
      if (ch === this.open) {
        depth++;
        if (innerStart === null) innerStart = i + 1;
      } else if (ch === this.close) {
        depth--;
        if (depth === 0) return [innerStart !== null ? src.substring(innerStart, i) : '', i + 1];
      }
      i++;
    }
    return [innerStart !== null ? src.substring(innerStart) : '', src.length];
  }

  #patternToRegex(pattern) {
    let regex = '', i = 0;
    const S = this.sigil, S2 = S + S;
    while (i < pattern.length) {
      if (pattern.startsWith(S2, i)) {
        regex += '\\s*';
        i += S2.length;
        continue;
      }
      if (pattern.startsWith(S + 'block', i)) {
        let j = i + S.length + 'block'.length;
        while (j < pattern.length && /\s/.test(pattern[j])) j++;
        
        // Extrair nome como identificador simples
        let varName = '';
        while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) {
          varName += pattern[j++];
        }
        
        if (varName) {
          while (j < pattern.length && /\s/.test(pattern[j])) j++;
          
          // Extrair delimitador de abertura
          let openDelim = this.open;
          if (j < pattern.length && pattern[j] === this.open) {
            const [c, e] = this.#extractBlock(pattern, j);
            openDelim = c.trim() || this.open;
            j = e;
            while (j < pattern.length && /\s/.test(pattern[j])) j++;
          }
          
          // Extrair delimitador de fechamento
          let closeDelim = this.close;
          if (j < pattern.length && pattern[j] === this.open) {
            const [c, e] = this.#extractBlock(pattern, j);
            closeDelim = c.trim() || this.close;
            j = e;
          }
          
          const eoMask = this.#escapeRegex(openDelim);
          const ecMask = this.#escapeRegex(closeDelim);
          regex += `${eoMask}([\\s\\S]*?)${ecMask}`;
          i = j;
          continue;
        }
      }
      if (pattern[i] === S) {
        let j = i + S.length, varName = '';
        while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) varName += pattern[j++];
        if (varName) {
          regex += '(\\S+)';
          i = j;
        } else {
          regex += this.#escapeRegex(S);
          i += S.length;
        }
        continue;
      }
      if (/\s/.test(pattern[i])) {
        regex += '\\s+';
        while (i < pattern.length && /\s/.test(pattern[i])) i++;
        continue;
      }
      const ch = pattern[i];
      regex += /[.*+?^${}()|[\]\\]/.test(ch) ? '\\' + ch : ch;
      i++;
    }
    return new RegExp(regex, 'g');
  }

  #extractVarNames(pattern) {
    const vars = [], seen = new Set(), S = this.sigil, S2 = S + S;
    let i = 0;
    while (i < pattern.length) {
      if (pattern.startsWith(S + 'block', i)) {
        let j = i + S.length + 'block'.length;
        while (j < pattern.length && /\s/.test(pattern[j])) j++;
        
        // Extrair nome como identificador simples
        let varName = '';
        while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) {
          varName += pattern[j++];
        }
        
        if (varName && !seen.has(varName)) {
          vars.push(S + varName);
          seen.add(varName);
        }
        
        if (varName) {
          while (j < pattern.length && /\s/.test(pattern[j])) j++;
          
          // Pular delimitador de abertura
          if (j < pattern.length && pattern[j] === this.open) {
            const [, ne] = this.#extractBlock(pattern, j);
            j = ne;
            while (j < pattern.length && /\s/.test(pattern[j])) j++;
          }
          
          // Pular delimitador de fechamento
          if (j < pattern.length && pattern[j] === this.open) {
            const [, ne] = this.#extractBlock(pattern, j);
            j = ne;
          }
        }
        
        i = j;
        continue;
      }
      // FIX: Checar por $ primeiro (espaço flexível)
      if (pattern.startsWith(S2, i)) {
        i += S2.length;
        continue;
      }
      if (pattern.startsWith(S, i)) {
        let j = i + S.length, varName = '';
        while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) varName += pattern[j++];
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

  #collectPatterns(src) {
    const patterns = [], patRe = new RegExp(`\\b${this.keywords.pattern}\\s*\\${this.open}`, "g");
    let result = src, i = 0;
    while (i < result.length) {
      patRe.lastIndex = i;
      const m = patRe.exec(result);
      if (!m) break;
      const start = m.index, openPos = m.index + m[0].length - 1;
      const [matchPat, posAfterMatch] = this.#extractBlock(result, openPos);
      let k = posAfterMatch;
      while (k < result.length && /\s/.test(result[k])) k++;
      if (k < result.length && result[k] === this.open) {
        const [replacePat, posAfterReplace] = this.#extractBlock(result, k);
        patterns.push({ match: matchPat.trim(), replace: replacePat.trim() });
        result = result.slice(0, start) + result.slice(posAfterReplace);
        i = start;
        continue;
      }
      i = start + 1;
    }
    return [patterns, result];
  }

  #applyPatterns(src, patterns) {
    let clearFlag = false, lastResult = "", S = this.sigil;
    for (const pat of patterns) {
      // Aplicar uma única vez
      const regex = this.#patternToRegex(pat.match);
      const varNames = this.#extractVarNames(pat.match);
      src = src.replace(regex, (...args) => {
        const fullMatch = args[0];
        const captures = args.slice(1, -2);
        const matchStart = args[args.length - 2];
        const matchEnd = matchStart + fullMatch.length;
        let result = pat.replace;
        const varMap = {};
        for (let i = 0; i < varNames.length; i++)
          varMap[varNames[i]] = captures[i] || '';
        for (const [k, v] of Object.entries(varMap)) {
          const keyEsc = this.#escapeRegex(k);
          result = result.replace(new RegExp(keyEsc + '(?![A-Za-z0-9_])', 'g'), v);
        }
        result = result.replace(new RegExp(`${this.#escapeRegex(S)}unique\\b`, 'g'), 
          () => this.#genUnique());
        result = result.replace(/\$eval\{([^}]*)\}/g, (_, code) => {
          try {
            const wrapped = `"use strict"; return (function() { ${code} })();`;
            return String(Function("papagaio", "ctx", wrapped)(this, {}));
          } catch {
            return "";
          }
        });
        const S2 = S + S;
        result = result.replace(new RegExp(this.#escapeRegex(S2), 'g'), '');
        if (new RegExp(`${this.#escapeRegex(S)}clear\\b`, 'g').test(result)) {
          result = result.replace(new RegExp(`${this.#escapeRegex(S)}clear\\b`, 'g'), '');
          clearFlag = true;
        }
        result = result
          .replace(new RegExp(`${this.#escapeRegex(S)}prefix\\b`, 'g'), src.slice(0, matchStart))
          .replace(new RegExp(`${this.#escapeRegex(S)}suffix\\b`, 'g'), src.slice(matchEnd))
          .replace(new RegExp(`${this.#escapeRegex(S)}match\\b`, 'g'), fullMatch);
        lastResult = result;
        return result;
      });
      if (clearFlag) {
        src = lastResult;
        clearFlag = false;
      }
    }
    return src;
  }

  #genUnique() {
    return "u" + (this.#counter.unique++).toString(36);
  }

  #escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
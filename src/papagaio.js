function processContext(papagaio, src) {
  const ctxRe = new RegExp(`\\b${papagaio.keywords.context}\\s*\\${papagaio.open}`, "g");
  let m, matches = [];
  while ((m = ctxRe.exec(src)) !== null)
    matches.push({ idx: m.index, pos: m.index + m[0].length - 1 });
  for (let j = matches.length - 1; j >= 0; j--) {
    const x = matches[j], [content, posAfter] = extractBlock(papagaio, src, x.pos);
    if (!content.trim()) {
      src = src.slice(0, x.idx) + src.slice(posAfter);
      continue;
    }
    const proc = papagaio.process(content);
    let left = src.substring(0, x.idx), right = src.substring(posAfter);
    let prefix = left.endsWith("\n") ? "\n" : "";
    if (prefix) left = left.slice(0, -1);
    src = left + prefix + proc + right;
  }
  return src;
}

function extractBlock(papagaio, src, openPos, openDelim = papagaio.open, closeDelim = papagaio.close) {
  let i = openPos;
  if (openDelim.length > 1 || closeDelim.length > 1) {
    if (src.substring(i, i + openDelim.length) === openDelim) {
      i += openDelim.length;
      const innerStart = i;
      let d = 0;
      while (i < src.length) {
        if (src.substring(i, i + openDelim.length) === openDelim) {
          d++;
          i += openDelim.length;
        } else if (src.substring(i, i + closeDelim.length) === closeDelim) {
          if (d === 0) return [src.substring(innerStart, i), i + closeDelim.length];
          d--;
          i += closeDelim.length;
        } else i++;
      }
      return [src.substring(innerStart), src.length];
    }
  }
  if (src[i] === openDelim) {
    i++;
    const innerStart = i;
    if (openDelim === closeDelim) {
      while (i < src.length && src[i] !== closeDelim) i++;
      return [src.substring(innerStart, i), i + 1];
    } else {
      let depth = 1;
      while (i < src.length && depth > 0) {
        if (src[i] === openDelim) depth++;
        else if (src[i] === closeDelim) depth--;
        if (depth > 0) i++;
      }
      return [src.substring(innerStart, i), i + 1];
    }
  }
  return ['', i];
}

function parsePattern(papagaio, pattern) {
  const tokens = [];
  let i = 0;
  const S = papagaio.sigil, S2 = S + S;
  while (i < pattern.length) {
    if (pattern.startsWith(S2, i)) {
      tokens.push({ type: 'whitespace-optional' });
      i += S2.length;
      continue;
    }
    if (pattern.startsWith(S + 'block', i)) {
      let j = i + S.length + 'block'.length;
      while (j < pattern.length && /\s/.test(pattern[j])) j++;
      let varName = '';
      while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) varName += pattern[j++];
      if (varName) {
        while (j < pattern.length && /\s/.test(pattern[j])) j++;
        let openDelim = papagaio.open;
        if (j < pattern.length && pattern[j] === papagaio.open) {
          const [c, e] = extractBlock(papagaio, pattern, j);
          openDelim = unescapeDelimiter(c.trim()) || papagaio.open;
          j = e;
          while (j < pattern.length && /\s/.test(pattern[j])) j++;
        }
        let closeDelim = papagaio.close;
        if (j < pattern.length && pattern[j] === papagaio.open) {
          const [c, e] = extractBlock(papagaio, pattern, j);
          closeDelim = unescapeDelimiter(c.trim()) || papagaio.close;
          j = e;
        }
        tokens.push({ type: 'block', varName, openDelim, closeDelim });
        i = j;
        continue;
      }
    }
    if (pattern[i] === S) {
      let j = i + S.length, varName = '';
      while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) varName += pattern[j++];
      if (varName) {
        tokens.push({ type: 'var', varName });
        i = j;
        continue;
      }
      tokens.push({ type: 'literal', value: S });
      i += S.length;
      continue;
    }
    if (/\s/.test(pattern[i])) {
      let ws = '';
      while (i < pattern.length && /\s/.test(pattern[i])) ws += pattern[i++];
      tokens.push({ type: 'whitespace', value: ws });
      continue;
    }
    let literal = '';
    while (i < pattern.length && !pattern.startsWith(S, i) && !/\s/.test(pattern[i])) literal += pattern[i++];
    if (literal) tokens.push({ type: 'literal', value: literal });
  }
  return tokens;
}

function matchPattern(papagaio, src, tokens, startPos = 0) {
  let pos = startPos;
  const captures = {};
  for (let ti = 0; ti < tokens.length; ti++) {
    const token = tokens[ti];
    if (token.type === 'whitespace-optional') {
      while (pos < src.length && /\s/.test(src[pos])) pos++;
      continue;
    }
    if (token.type === 'whitespace') {
      if (pos >= src.length || !/\s/.test(src[pos])) return null;
      while (pos < src.length && /\s/.test(src[pos])) pos++;
      continue;
    }
    if (token.type === 'literal') {
      if (!src.startsWith(token.value, pos)) return null;
      pos += token.value.length;
      continue;
    }
    if (token.type === 'var') {
      const nextToken = ti + 1 < tokens.length ? tokens[ti + 1] : null;
      let varValue = '';
      if (nextToken) {
        if (nextToken.type === 'whitespace' || nextToken.type === 'whitespace-optional') {
          while (pos < src.length && !/\s/.test(src[pos])) varValue += src[pos++];
        } else if (nextToken.type === 'literal') {
          const stopChar = nextToken.value[0];
          while (pos < src.length && src[pos] !== stopChar && !/\s/.test(src[pos])) varValue += src[pos++];
        } else if (nextToken.type === 'block') {
          while (pos < src.length && !src.startsWith(nextToken.openDelim, pos) && !/\s/.test(src[pos])) varValue += src[pos++];
        } else {
          while (pos < src.length && !/\s/.test(src[pos])) varValue += src[pos++];
        }
      } else {
        while (pos < src.length && !/\s/.test(src[pos])) varValue += src[pos++];
      }
      if (!varValue) return null;
      captures[papagaio.sigil + token.varName] = varValue;
      continue;
    }
    if (token.type === 'block') {
      const { varName, openDelim, closeDelim } = token;
      if (!src.startsWith(openDelim, pos)) return null;
      const [blockContent, endPos] = extractBlock(papagaio, src, pos, openDelim, closeDelim);
      captures[papagaio.sigil + varName] = blockContent;
      pos = endPos;
      continue;
    }
  }
  return { captures, endPos: pos };
}

function collectPatterns(papagaio, src) {
  const patterns = [];
  const patRe = new RegExp(`\\b${papagaio.keywords.pattern}\\s*\\${papagaio.open}`, "g");
  let result = src;
  while (true) {
    patRe.lastIndex = 0;
    const m = patRe.exec(result);
    if (!m) break;
    const start = m.index;
    const openPos = m.index + m[0].length - 1;
    const [matchPat, posAfterMatch] = extractBlock(papagaio, result, openPos);
    let k = posAfterMatch;
    while (k < result.length && /\s/.test(result[k])) k++;
    if (k < result.length && result[k] === papagaio.open) {
      const [replacePat, posAfterReplace] = extractBlock(papagaio, result, k);
      patterns.push({ match: matchPat.trim(), replace: replacePat.trim() });
      result = result.slice(0, start) + result.slice(posAfterReplace);
      continue;
    }
    result = result.slice(0, start) + result.slice(posAfterMatch);
  }
  return [patterns, result];
}

function applyPatterns(papagaio, src, patterns) {
  let clearFlag = false, lastResult = "", S = papagaio.sigil;
  for (const pat of patterns) {
    const tokens = parsePattern(papagaio, pat.match);
    let newSrc = '';
    let pos = 0, matched = false;
    while (pos < src.length) {
      const matchResult = matchPattern(papagaio, src, tokens, pos);
      if (matchResult) {
        matched = true;
        const { captures, endPos } = matchResult;
        let result = pat.replace;
        for (const [k, v] of Object.entries(captures)) {
          const keyEsc = escapeRegex(k);
          result = result.replace(new RegExp(keyEsc + '(?![A-Za-z0-9_])', 'g'), v);
        }
        result = result.replace(new RegExp(`${escapeRegex(S)}unique\\b`, 'g'), () => genUnique(papagaio));
        result = result.replace(/\$eval\{([^}]*)\}/g, (_, code) => {
          try {
            const wrapped = `"use strict"; return (function() { ${code} })();`;
            return String(Function("papagaio", "ctx", wrapped)(papagaio, {}));
          } catch {
            return "";
          }
        });
        const S2 = S + S;
        result = result.replace(new RegExp(escapeRegex(S2), 'g'), '');
        if (new RegExp(`${escapeRegex(S)}clear\\b`, 'g').test(result)) {
          result = result.replace(new RegExp(`${escapeRegex(S)}clear\\b`, 'g'), '');
          clearFlag = true;
        }
        const matchStart = pos, matchEnd = endPos;
        result = result
          .replace(new RegExp(`${escapeRegex(S)}prefix\\b`, 'g'), src.slice(0, matchStart))
          .replace(new RegExp(`${escapeRegex(S)}suffix\\b`, 'g'), src.slice(matchEnd))
          .replace(new RegExp(`${escapeRegex(S)}match\\b`, 'g'), src.slice(matchStart, matchEnd));
        newSrc += result;
        lastResult = result;
        pos = endPos;
      } else {
        newSrc += src[pos];
        pos++;
      }
    }
    if (matched) {
      src = clearFlag ? lastResult : newSrc;
      clearFlag = false;
    }
  }
  return src;
}

function genUnique(papagaio) {
  return "u" + (papagaio.counter.unique++).toString(36);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\""']/g, '\\$&');
}

function unescapeDelimiter(str) {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const next = str[i + 1];
      if (next === '"' || next === "'" || next === '\\') {
        result += next;
        i++;
      } else {
        result += str[i];
      }
    } else {
      result += str[i];
    }
  }
  return result;
}

export class Papagaio {
  constructor() {
    this.maxRecursion = 512;
    this.counter = { value: 0, unique: 0 };
    this.open = "{";
    this.close = "}";
    this.sigil = "$";
    this.keywords = { pattern: "pattern", context: "context" };
    this.content = "";
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
      src = processContext(this, src);
      const [patterns, s2] = collectPatterns(this, src);
      src = applyPatterns(this, s2, patterns);
      if (!pending()) break;
    }
    return this.content = src, src;
  }
}
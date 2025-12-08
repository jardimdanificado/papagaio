// https://github.com/jardimdanificado/papagaio
  
function parsePattern(papagaio, pattern) {
  const tokens = [], S = papagaio.symbols.sigil, S2 = S + S;
  let i = 0;
  const isWhitespaceChar = c => /\s/.test(c);
  const getWhitespaceType = c => c === ' ' ? 'space' : c === '\t' ? 'tab' : c === '\n' ? 'newline' : c === '\r' ? 'carriage-return' : 'other';
  while (i < pattern.length) {
    if (pattern.startsWith(S + S + S, i) && i + 3 < pattern.length && isWhitespaceChar(pattern[i + 3])) {
      tokens.push({ type: 'any-ws-required', wsChar: pattern[i + 3] });
      i += 4;
      continue;
    }
    if (pattern.startsWith(S + S + S + S, i) && i + 4 < pattern.length && isWhitespaceChar(pattern[i + 4])) {
      tokens.push({ type: 'any-ws-optional', wsChar: pattern[i + 4] });
      i += 5;
      continue;
    }
    if (pattern.startsWith(S2, i)) {
      let j = i + S2.length, varName = '';
      while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) varName += pattern[j++];
      if (varName) {
        if (j < pattern.length && isWhitespaceChar(pattern[j])) {
          tokens.push({ type: 'var-ws', varName, wsTrailing: getWhitespaceType(pattern[j]), wsChar: pattern[j] });
          i = j + 1;
          continue;
        } else if (j < pattern.length && pattern[j] === S) {
          tokens.push({ type: 'var-ws', varName, wsTrailing: 'optional', wsChar: null });
          i = j + 1;
          continue;
        } else {
          tokens.push({ type: 'var-ws', varName });
          i = j;
          continue;
        }
      }
    }
    if (pattern.startsWith(S2, i) && i + 2 < pattern.length && isWhitespaceChar(pattern[i + 2])) {
      tokens.push({ type: 'ws-optional', wsType: getWhitespaceType(pattern[i + 2]), wsChar: pattern[i + 2] });
      i += 3;
      continue;
    }
    if (pattern.startsWith(S2, i)) {
      tokens.push({ type: 'whitespace-optional' });
      i += S2.length;
      continue;
    }
    if (pattern[i] === S && i + 1 < pattern.length && isWhitespaceChar(pattern[i + 1])) {
      tokens.push({ type: 'ws-required', wsType: getWhitespaceType(pattern[i + 1]), wsChar: pattern[i + 1] });
      i += 2;
      continue;
    }
    if (pattern.startsWith(S + 'block', i)) {
      let j = i + S.length + 5;
      while (j < pattern.length && /\s/.test(pattern[j])) j++;
      let varName = '';
      while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) varName += pattern[j++];
      if (varName) {
        while (j < pattern.length && /\s/.test(pattern[j])) j++;
        let openDelim = papagaio.symbols.open, closeDelim = papagaio.symbols.close;
        let openDelimIsWs = false, closeDelimIsWs = false;
        if (j < pattern.length && pattern[j] === papagaio.symbols.open) {
          const [c, e] = extractBlock(papagaio, pattern, j);
          const trimmed = c.trim();
          if (trimmed === '') {
            openDelimIsWs = true;
            let wsStart = j + papagaio.symbols.open.length, wsEnd = wsStart;
            while (wsEnd < pattern.length && pattern[wsEnd] !== papagaio.symbols.close) wsEnd++;
            openDelim = pattern.substring(wsStart, wsEnd);
          } else openDelim = unescapeDelimiter(trimmed) || papagaio.symbols.open;
          j = e;
          while (j < pattern.length && /\s/.test(pattern[j])) j++;
        }
        if (j < pattern.length && pattern[j] === papagaio.symbols.open) {
          const [c, e] = extractBlock(papagaio, pattern, j);
          const trimmed = c.trim();
          if (trimmed === '') {
            closeDelimIsWs = true;
            let wsStart = j + papagaio.symbols.open.length, wsEnd = wsStart;
            while (wsEnd < pattern.length && pattern[wsEnd] !== papagaio.symbols.close) wsEnd++;
            closeDelim = pattern.substring(wsStart, wsEnd);
          } else closeDelim = unescapeDelimiter(trimmed) || papagaio.symbols.close;
          j = e;
        }
        tokens.push({ type: 'block', varName, openDelim, closeDelim, openDelimIsWs, closeDelimIsWs });
        i = j;
        continue;
      }
    }
    if (pattern[i] === S) {
      let j = i + S.length, varName = '';
      while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) varName += pattern[j++];
      if (varName) {
        if (j < pattern.length && isWhitespaceChar(pattern[j])) {
          tokens.push({ type: 'var', varName, wsTrailing: getWhitespaceType(pattern[j]), wsChar: pattern[j] });
          i = j + 1;
          continue;
        } else if (j < pattern.length && pattern[j] === S) {
          tokens.push({ type: 'var', varName, wsTrailing: 'optional', wsChar: null });
          i = j + 1;
          continue;
        } else {
          tokens.push({ type: 'var', varName });
          i = j;
          continue;
        }
      }
    }
    if (isWhitespaceChar(pattern[i])) {
      let ws = '';
      while (i < pattern.length && isWhitespaceChar(pattern[i])) ws += pattern[i++];
      tokens.push({ type: 'literal-ws', value: ws });
      continue;
    }
    let literal = '';
    while (i < pattern.length && !pattern.startsWith(S, i) && !isWhitespaceChar(pattern[i])) literal += pattern[i++];
    if (literal) tokens.push({ type: 'literal', value: literal });
  }
  return tokens;
}

function matchPattern(papagaio, src, tokens, startPos = 0) {
  let pos = startPos, captures = {};
  const matchWhitespaceType = (str, idx, wsType) => {
    if (idx >= str.length) return { matched: '', newPos: idx };
    if (wsType === 'space' && str[idx] === ' ') {
      let j = idx;
      while (j < str.length && str[j] === ' ') j++;
      return { matched: str.slice(idx, j), newPos: j };
    }
    if (wsType === 'tab' && str[idx] === '\t') {
      let j = idx;
      while (j < str.length && str[j] === '\t') j++;
      return { matched: str.slice(idx, j), newPos: j };
    }
    if (wsType === 'newline' && str[idx] === '\n') {
      let j = idx;
      while (j < str.length && str[j] === '\n') j++;
      return { matched: str.slice(idx, j), newPos: j };
    }
    return { matched: '', newPos: idx };
  };
  for (let ti = 0; ti < tokens.length; ti++) {
    const token = tokens[ti];
    if (token.type === 'literal-ws') {
      if (!src.startsWith(token.value, pos)) return null;
      pos += token.value.length;
      continue;
    }
    if (token.type === 'ws-required') {
      const { matched, newPos } = matchWhitespaceType(src, pos, token.wsType);
      if (!matched) return null;
      pos = newPos;
      continue;
    }
    if (token.type === 'ws-optional') {
      const { newPos } = matchWhitespaceType(src, pos, token.wsType);
      pos = newPos;
      continue;
    }
    if (token.type === 'any-ws-required') {
      if (pos >= src.length || !/\s/.test(src[pos])) return null;
      while (pos < src.length && /\s/.test(src[pos])) pos++;
      continue;
    }
    if (token.type === 'any-ws-optional') {
      while (pos < src.length && /\s/.test(src[pos])) pos++;
      continue;
    }
    if (token.type === 'whitespace-optional') {
      while (pos < src.length && /\s/.test(src[pos])) pos++;
      continue;
    }
    if (token.type === 'literal') {
      if (!src.startsWith(token.value, pos)) return null;
      pos += token.value.length;
      continue;
    }
    if (token.type === 'var') {
      let v = '';
      const nextToken = findNextSignificantToken(tokens, ti);
      
      // Se o próximo token é um block, captura até o delimitador de abertura
      if (nextToken && nextToken.type === 'block') {
        while (pos < src.length && !src.startsWith(nextToken.openDelim, pos) && !/\s/.test(src[pos])) {
          v += src[pos++];
        }
      } else if (nextToken && nextToken.type === 'literal') {
        while (pos < src.length && !src.startsWith(nextToken.value, pos) && !/\s/.test(src[pos])) {
          v += src[pos++];
        }
      } else {
        while (pos < src.length && !/\s/.test(src[pos])) {
          v += src[pos++];
        }
      }
      
      if (token.wsTrailing && token.wsTrailing !== 'optional') {
        const { newPos } = matchWhitespaceType(src, pos, token.wsTrailing);
        pos = newPos;
      } else if (token.wsTrailing === 'optional') {
        const { newPos } = matchWhitespaceType(src, pos, 'space');
        pos = newPos;
      }
      if (!v) return null;
      captures[papagaio.symbols.sigil + token.varName] = v;
      continue;
    }
    if (token.type === 'var-ws') {
      while (pos < src.length && /\s/.test(src[pos])) pos++;
      const n = findNextSignificantToken(tokens, ti);
      let v = '';
      
      // Se o próximo token é um block, captura até o delimitador de abertura
      if (n && n.type === 'block') {
        while (pos < src.length && !src.startsWith(n.openDelim, pos) && src[pos] !== '\n') {
          v += src[pos++];
        }
        v = v.trimEnd();
      } else if (!n || ['var', 'var-ws'].includes(n.type)) {
        while (pos < src.length && !/\s/.test(src[pos])) {
          v += src[pos++];
        }
      } else if (n.type === 'literal') {
        while (pos < src.length && !src.startsWith(n.value, pos) && src[pos] !== '\n') {
          v += src[pos++];
        }
        v = v.trimEnd();
      }
      
      if (token.wsTrailing && token.wsTrailing !== 'optional') {
        const { newPos } = matchWhitespaceType(src, pos, token.wsTrailing);
        pos = newPos;
      } else if (token.wsTrailing === 'optional') {
        const { newPos } = matchWhitespaceType(src, pos, 'space');
        pos = newPos;
      }
      if (!v) return null;
      captures[papagaio.symbols.sigil + token.varName] = v;
      continue;
    }
    if (token.type === 'block') {
      const { varName, openDelim, closeDelim, openDelimIsWs, closeDelimIsWs } = token;
      if (!src.startsWith(openDelim, pos)) return null;
      const [c, e] = extractBlockWithWsDelimiter(papagaio, src, pos, openDelim, closeDelim, openDelimIsWs, closeDelimIsWs);
      captures[papagaio.symbols.sigil + varName] = c;
      pos = e;
      continue;
    }
  }
  return { captures, endPos: pos };
}

function findNextSignificantToken(t, i) {
  for (let k = i + 1; k < t.length; k++) {
    if (!['whitespace-optional', 'ws-optional', 'ws-required', 'any-ws-optional', 'any-ws-required'].includes(t[k].type)) return t[k];
  }
  return null;
}

function extractBlockWithWsDelimiter(p, src, openPos, openDelim, closeDelim, openDelimIsWs, closeDelimIsWs) {
  let i = openPos;
  if (openDelimIsWs || closeDelimIsWs) {
    if (src.substring(i, i + openDelim.length) === openDelim) {
      i += openDelim.length;
      const s = i;
      let d = 0;
      while (i < src.length) {
        if (src.substring(i, i + openDelim.length) === openDelim) {
          d++;
          i += openDelim.length;
        } else if (src.substring(i, i + closeDelim.length) === closeDelim) {
          if (!d) return [src.substring(s, i), i + closeDelim.length];
          d--;
          i += closeDelim.length;
        } else i++;
      }
      return [src.substring(s), src.length];
    }
    return ['', i];
  }
  if (openDelim.length > 1 || closeDelim.length > 1) {
    if (src.substring(i, i + openDelim.length) === openDelim) {
      i += openDelim.length;
      const s = i;
      let d = 0;
      while (i < src.length) {
        if (src.substring(i, i + openDelim.length) === openDelim) {
          d++;
          i += openDelim.length;
        } else if (src.substring(i, i + closeDelim.length) === closeDelim) {
          if (!d) return [src.substring(s, i), i + closeDelim.length];
          d--;
          i += closeDelim.length;
        } else i++;
      }
      return [src.substring(s), src.length];
    }
  }
  if (src[i] === openDelim) {
    i++;
    const s = i;
    if (openDelim === closeDelim) {
      while (i < src.length && src[i] !== closeDelim) i++;
      return [src.substring(s, i), i + 1];
    }
    let d = 1;
    while (i < src.length && d > 0) {
      if (src[i] === openDelim) d++;
      else if (src[i] === closeDelim) d--;
      if (d > 0) i++;
    }
    return [src.substring(s, i), i + 1];
  }
  return ['', i];
}

function extractBlock(p, src, openPos, openDelim = p.symbols.open, closeDelim = p.symbols.close) {
  let i = openPos;
  if (openDelim.length > 1 || closeDelim.length > 1) {
    if (src.substring(i, i + openDelim.length) === openDelim) {
      i += openDelim.length;
      const s = i;
      let d = 0;
      while (i < src.length) {
        if (src.substring(i, i + openDelim.length) === openDelim) {
          d++;
          i += openDelim.length;
        } else if (src.substring(i, i + closeDelim.length) === closeDelim) {
          if (!d) return [src.substring(s, i), i + closeDelim.length];
          d--;
          i += closeDelim.length;
        } else i++;
      }
      return [src.substring(s), src.length];
    }
  }
  if (src[i] === openDelim) {
    i++;
    const s = i;
    if (openDelim === closeDelim) {
      while (i < src.length && src[i] !== closeDelim) i++;
      return [src.substring(s, i), i + 1];
    }
    let d = 1;
    while (i < src.length && d > 0) {
      if (src[i] === openDelim) d++;
      else if (src[i] === closeDelim) d--;
      if (d > 0) i++;
    }
    return [src.substring(s, i), i + 1];
  }
  return ['', i];
}

function collectPatterns(p, src) {
  const A = [], r = new RegExp(`\\b${p.symbols.pattern}\\s*\\${p.symbols.open}`, "g");
  let out = src;
  while (1) {
    r.lastIndex = 0;
    const m = r.exec(out);
    if (!m) break;
    const s = m.index, o = m.index + m[0].length - 1;
    const [mp, em] = extractBlock(p, out, o);
    let k = em;
    while (k < out.length && /\s/.test(out[k])) k++;
    if (k < out.length && out[k] === p.symbols.open) {
      const [rp, er] = extractBlock(p, out, k);
      A.push({ match: mp.trim(), replace: rp.trim() });
      out = out.slice(0, s) + out.slice(er);
      continue;
    }
    out = out.slice(0, s) + out.slice(em);
  }
  return [A, out];
}

function extractNestedPatterns(p, replaceText) {
  const nested = [];
  const r = new RegExp(`\\${p.symbols.sigil}${escapeRegex(p.symbols.pattern)}\\s*\\${p.symbols.open}`, "g");
  let out = replaceText;
  
  while (1) {
    r.lastIndex = 0;
    const m = r.exec(out);
    if (!m) break;
    
    const s = m.index, o = m.index + m[0].length - 1;
    const [mp, em] = extractBlock(p, out, o);
    let k = em;
    
    while (k < out.length && /\s/.test(out[k])) k++;
    
    if (k < out.length && out[k] === p.symbols.open) {
      const [rp, er] = extractBlock(p, out, k);
      nested.push({ match: mp.trim(), replace: rp.trim() });
      out = out.slice(0, s) + out.slice(er);
      continue;
    }
    out = out.slice(0, s) + out.slice(em);
  }
  
  return [nested, out];
}

function applyPatterns(p, src, pats) {
  let clear = false, last = "", S = p.symbols.sigil;
  for (const pat of pats) {
    const t = parsePattern(p, pat.match);
    let n = '', pos = 0, ok = false;
    while (pos < src.length) {
      const m = matchPattern(p, src, t, pos);
      if (m) {
        ok = true;
        const { captures, endPos } = m;
        let r = pat.replace;
        
        // Extrai e processa padrões aninhados ($pattern)
        const [nestedPats, cleanReplace] = extractNestedPatterns(p, r);
        r = cleanReplace;
        
        for (const [k, v] of Object.entries(captures)) {
          const e = escapeRegex(k);
          r = r.replace(new RegExp(e + '(?![A-Za-z0-9_])', 'g'), v);
        }
        
        // Aplica padrões aninhados ao resultado
        if (nestedPats.length > 0) {
          r = applyPatterns(p, r, nestedPats);
        }
        
        const uid = p.unique_id++;
        r = r.replace(new RegExp(`${escapeRegex(S)}unique\\b`, 'g'), () => String(uid));
        r = r.replace(/\$eval\{([^}]*)\}/g, (_, c) => {
          try {
            return String(Function("papagaio", "ctx", `"use strict";return(function(){${c}})();`)(p, {}));
          } catch {
            return "";
          }
        });
        r = r.replace(new RegExp(escapeRegex(S + S), 'g'), '');
        if (new RegExp(`${escapeRegex(S)}clear\\b`, 'g').test(r)) {
          r = r.replace(new RegExp(`${escapeRegex(S)}clear\\b\\s?`, 'g'), '');
          clear = true;
        }
        const ms = pos, me = endPos;
        r = r.replace(new RegExp(`${escapeRegex(S)}prefix\\b`, 'g'), src.slice(0, ms))
          .replace(new RegExp(`${escapeRegex(S)}suffix\\b`, 'g'), src.slice(me))
          .replace(new RegExp(`${escapeRegex(S)}match\\b`, 'g'), src.slice(ms, me));
        n += r;
        last = r;
        pos = endPos;
      } else {
        n += src[pos];
        pos++;
      }
    }
    if (ok) {
      src = clear ? last : n;
      clear = false;
    }
  }
  return src;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\""']/g, '\\$&');
}

function unescapeDelimiter(s) {
  let r = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === '"' || n === "'" || n === '\\') {
        r += n;
        i++;
      } else r += s[i];
    } else r += s[i];
  }
  return r;
}

export class Papagaio {
  constructor(sigil = "$", open = "{", close = "}", pattern = "pattern") {
    this.recursion_limit = 512;
    this.unique_id = 0;
    this.symbols = { sigil: sigil, open: open, close: close, pattern: pattern};
    this.content = "";
  }
  process(input) {
    this.content = input;
    let src = input, last = null, it = 0;
    const pend = () => {
      const r2 = new RegExp(`\\b${this.symbols.pattern}\\s*\\${this.symbols.open}`, "g");
      return r2.test(src);
    };
    while (src !== last && it < this.recursion_limit) {
      it++;
      last = src;
      const [p, s2] = collectPatterns(this, src);
      src = applyPatterns(this, s2, p);
      if (!pend()) break;
    }
    return this.content = src, src;
  }
}
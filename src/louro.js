function parsePattern(papagaio, pattern) {
  const tokens = []; let i = 0;
  const S = papagaio.symbols.sigil, S2 = S + S;
  while (i < pattern.length) {
    if (pattern.startsWith(S2 + S, i)) {
      let j = i + S2.length + S.length, varName = '';
      while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) varName += pattern[j++];
      if (varName) { tokens.push({ type: 'var-ws-optional', varName }); i = j; continue; }
    }
    if (pattern.startsWith(S2, i)) {
      let j = i + S2.length, varName = '';
      while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) varName += pattern[j++];
      if (varName) { tokens.push({ type: 'var-ws', varName }); i = j; continue; }
      tokens.push({ type: 'whitespace-optional' }); i += S2.length; continue;
    }
    if (pattern.startsWith(S + 'block', i)) {
      let j = i + S.length + 'block'.length;
      while (j < pattern.length && /\s/.test(pattern[j])) j++;
      let varName = '';
      while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) varName += pattern[j++];
      if (varName) {
        while (j < pattern.length && /\s/.test(pattern[j])) j++;
        let openDelim = papagaio.symbols.open;
        if (j < pattern.length && pattern[j] === papagaio.symbols.open) {
          const [c, e] = extractBlock(papagaio, pattern, j);
          openDelim = unescapeDelimiter(c.trim()) || papagaio.symbols.open;
          j = e; while (j < pattern.length && /\s/.test(pattern[j])) j++;
        }
        let closeDelim = papagaio.symbols.close;
        if (j < pattern.length && pattern[j] === papagaio.symbols.open) {
          const [c, e] = extractBlock(papagaio, pattern, j);
          closeDelim = unescapeDelimiter(c.trim()) || papagaio.symbols.close;
          j = e;
        }
        tokens.push({ type: 'block', varName, openDelim, closeDelim }); i = j; continue;
      }
    }
    if (pattern[i] === S) {
      let j = i + S.length, varName = '';
      while (j < pattern.length && /[A-Za-z0-9_]/.test(pattern[j])) varName += pattern[j++];
      if (varName) { tokens.push({ type: 'var', varName }); i = j; continue; }
      tokens.push({ type: 'literal', value: S }); i += S.length; continue;
    }
    if (/\s/.test(pattern[i])) {
      while (i < pattern.length && /\s/.test(pattern[i])) i++;
      tokens.push({ type: 'whitespace-optional' }); continue;
    }
    let literal = '';
    while (i < pattern.length && !pattern.startsWith(S, i) && !/\s/.test(pattern[i])) literal += pattern[i++];
    if (literal) tokens.push({ type: 'literal', value: literal });
  }
  return tokens;
}

function matchPattern(papagaio, src, tokens, startPos = 0) {
  let pos = startPos, captures = {};
  for (let ti = 0; ti < tokens.length; ti++) {
    const token = tokens[ti];
    if (token.type === 'whitespace-optional') { while (pos < src.length && /\s/.test(src[pos])) pos++; continue; }
    if (token.type === 'literal') { if (!src.startsWith(token.value, pos)) return null; pos += token.value.length; continue; }
    if (token.type === 'var') {
      const nextToken = findNextSignificantToken(tokens, ti);
      let v = '';
      
      // Se o próximo token é um block, captura até o delimitador de abertura
      if (nextToken && nextToken.type === 'block') {
        while (pos < src.length && !src.startsWith(nextToken.openDelim, pos) && !/\s/.test(src[pos])) {
          v += src[pos++];
        }
      } else {
        while (pos < src.length && !/\s/.test(src[pos])) v += src[pos++];
      }
      
      if (!v) return null;
      captures[papagaio.symbols.sigil + token.varName] = v;
      continue;
    }
    if (token.type === 'var-ws' || token.type === 'var-ws-optional') {
      while (pos < src.length && /\s/.test(src[pos])) pos++;
      const n = findNextSignificantToken(tokens, ti);
      let v = '';
      
      // Se o próximo token é um block, captura até o delimitador de abertura
      if (n && n.type === 'block') {
        while (pos < src.length && !src.startsWith(n.openDelim, pos) && src[pos] !== '\n') {
          v += src[pos++];
        }
        v = v.trimEnd();
      } else if (!n || ['var','var-ws','var-ws-optional'].includes(n.type)) {
        while (pos < src.length && !/\s/.test(src[pos])) v += src[pos++];
      } else if (n.type === 'literal') {
        while (pos < src.length && !src.startsWith(n.value, pos) && src[pos] !== '\n') v += src[pos++];
        v = v.trimEnd();
      }
      
      if (token.type === 'var-ws' && !v) return null;
      captures[papagaio.symbols.sigil + token.varName] = v;
      continue;
    }
    if (token.type === 'block') {
      const { varName, openDelim, closeDelim } = token;
      if (!src.startsWith(openDelim, pos)) return null;
      const [c, e] = extractBlock(papagaio, src, pos, openDelim, closeDelim);
      captures[papagaio.symbols.sigil + varName] = c; pos = e; continue;
    }
  }
  return { captures, endPos: pos };
}

function findNextSignificantToken(t, i) { for (let k = i + 1; k < t.length; k++) if (t[k].type !== 'whitespace-optional') return t[k]; return null; }

function extractBlock(p, src, openPos, openDelim = p.symbols.open, closeDelim = p.symbols.close) {
  let i = openPos;
  if (openDelim.length > 1 || closeDelim.length > 1) {
    if (src.substring(i, i + openDelim.length) === openDelim) {
      i += openDelim.length; const s = i; let d = 0;
      while (i < src.length) {
        if (src.substring(i, i + openDelim.length) === openDelim) { d++; i += openDelim.length; }
        else if (src.substring(i, i + closeDelim.length) === closeDelim) {
          if (!d) return [src.substring(s, i), i + closeDelim.length];
          d--; i += closeDelim.length;
        } else i++;
      }
      return [src.substring(s), src.length];
    }
  }
  if (src[i] === openDelim) {
    i++; const s = i;
    if (openDelim === closeDelim) { while (i < src.length && src[i] !== closeDelim) i++; return [src.substring(s, i), i + 1]; }
    let d = 1;
    while (i < src.length && d > 0) { if (src[i] === openDelim) d++; else if (src[i] === closeDelim) d--; if (d > 0) i++; }
    return [src.substring(s, i), i + 1];
  }
  return ['', i];
}

function collectPatterns(p, src) {
  const A = [], r = new RegExp(`(?:^|\\b)${p.symbols.pattern}\\s*\\${p.symbols.open}`, "g"); let out = src;
  while (1) {
    r.lastIndex = 0; const m = r.exec(out); if (!m) break;
    const s = m.index, o = m.index + m[0].length - 1;
    const [mp, em] = extractBlock(p, out, o); let k = em;
    while (k < out.length && /\s/.test(out[k])) k++;
    if (k < out.length && out[k] === p.symbols.open) {
      const [rp, er] = extractBlock(p, out, k);
      A.push({ match: mp.trim(), replace: rp.trim() });
      out = out.slice(0, s) + out.slice(er); continue;
    }
    out = out.slice(0, s) + out.slice(em);
  }
  return [A, out];
}

function extractNestedPatterns(p, replaceText) {
  const nested = [];
  const r = new RegExp(`\\${p.symbols.sigil}${p.symbols.pattern}\\s*\\${p.symbols.open}`, "g");
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
    const t = parsePattern(p, pat.match); let n = '', pos = 0, ok = false;
    while (pos < src.length) {
      const m = matchPattern(p, src, t, pos);
      if (m) {
        ok = true; const { captures, endPos } = m;
        let r = pat.replace;
        
        // Extrai e processa padrões aninhados ($pattern)
        const [nestedPats, cleanReplace] = extractNestedPatterns(p, r);
        r = cleanReplace;
        
        for (const [k, v] of Object.entries(captures)) {
          const e = escapeRegex(k); r = r.replace(new RegExp(e + '(?![A-Za-z0-9_])', 'g'), v);
        }
        
        // Aplica padrões aninhados ao resultado
        if (nestedPats.length > 0) {
          r = applyPatterns(p, r, nestedPats);
        }
        
        const uid = p.unique_id++; r = r.replace(new RegExp(`${escapeRegex(S)}unique\\b`, 'g'), () => String(uid));
        r = r.replace(/\$eval\{([^}]*)\}/g, (_, c) => { try {
          return String(Function("papagaio", "ctx", `"use strict";return(function(){${c}})();`)(p, {}));
        } catch { return ""; } });
        r = r.replace(new RegExp(escapeRegex(S + S), 'g'), '');
        if (new RegExp(`${escapeRegex(S)}clear\\b`, 'g').test(r)) {
          r = r.replace(new RegExp(`${escapeRegex(S)}clear\\b\\s?`, 'g'), ''); clear = true;
        }
        const ms = pos, me = endPos;
        r = r
          .replace(new RegExp(`${escapeRegex(S)}prefix\\b`, 'g'), src.slice(0, ms))
          .replace(new RegExp(`${escapeRegex(S)}suffix\\b`, 'g'), src.slice(me))
          .replace(new RegExp(`${escapeRegex(S)}match\\b`, 'g'), src.slice(ms, me));
        n += r; last = r; pos = endPos;
      } else { n += src[pos]; pos++; }
    }
    if (ok) { src = clear ? last : n; clear = false; }
  }
  return src;
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\""']/g, '\\$&'); }

function unescapeDelimiter(s) {
  let r = ''; for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === '"' || n === "'" || n === '\\') { r += n; i++; }
      else r += s[i];
    } else r += s[i];
  }
  return r;
}

export class Papagaio {
  constructor(sigil = '$', open = '{', close = '}', pattern = 'pattern') {
    this.recursion_limit = 512;
    this.unique_id = 0;
    this.symbols = { pattern: pattern, open: open, close: close, sigil: sigil };
    this.content = "";
  }
  process(input) {
    this.content = input; let src = input, last = null, it = 0;
    const pend = () => {
      const r2 = new RegExp(`(?:^|\\b)${this.symbols.pattern}\\s*\\${this.symbols.open}`, "g");
      return r2.test(src);
    };
    while (src !== last && it < this.recursion_limit) {
      it++; last = src;
      const [p, s2] = collectPatterns(this, src); src = applyPatterns(this, s2, p);
      if (!pend()) break;
    }
    return this.content = src, src;
  }
}
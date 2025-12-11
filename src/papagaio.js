function parsePattern(p, pat) {
    const t = [], S = p.symbols.sigil, O = p.symbols.open;
    let i = 0;
    
    while (i < pat.length) {
        if (pat.startsWith(S + p.symbols.regex, i)) {
            let j = i + S.length + p.symbols.regex.length;
            while (j < pat.length && /\s/.test(pat[j])) j++;
            let v = '';
            while (j < pat.length && /[A-Za-z0-9_]/.test(pat[j])) v += pat[j++];
            if (v) {
                while (j < pat.length && /\s/.test(pat[j])) j++;
                if (pat[j] === O) {
                    const [rx, e] = extractBlock(p, pat, j);
                    t.push({ type: 'regex', varName: v, regex: rx.trim() });
                    i = e; continue;
                }
            }
        }
        if (pat.startsWith(S + p.symbols.block, i)) {
            let j = i + S.length + p.symbols.block.length;
            while (j < pat.length && /\s/.test(pat[j])) j++;
            let v = '';
            while (j < pat.length && /[A-Za-z0-9_]/.test(pat[j])) v += pat[j++];
            if (v) {
                while (j < pat.length && /\s/.test(pat[j])) j++;
                let od = O, cd = p.symbols.close;
                if (pat[j] === O) {
                    const [c, e] = extractBlock(p, pat, j);
                    od = unescapeDelim(c.trim()) || O;
                    j = e; while (j < pat.length && /\s/.test(pat[j])) j++;
                }
                if (pat[j] === O) {
                    const [c, e] = extractBlock(p, pat, j);
                    cd = unescapeDelim(c.trim()) || cd;
                    j = e;
                }
                t.push({ type: 'block', varName: v, open: od, close: cd }); 
                i = j; continue;
            }
        }
        if (pat[i] === S) {
            let j = i + S.length, v = '';
            while (j < pat.length && /[A-Za-z0-9_]/.test(pat[j])) v += pat[j++];
            if (v) { 
                const optional = pat[j] === '?';
                if (optional) j++;
                t.push({ type: 'var', varName: v, optional }); 
                i = j; 
                continue; 
            }
            t.push({ type: 'lit', value: S }); i += S.length; continue;
        }
        if (/\s/.test(pat[i])) {
            while (i < pat.length && /\s/.test(pat[i])) i++;
            t.push({ type: 'ws' }); continue;
        }
        let lit = '';
        while (i < pat.length && pat[i] !== S && !/\s/.test(pat[i])) lit += pat[i++];
        if (lit) t.push({ type: 'lit', value: lit });
    }
    return t;
}

function matchPattern(p, src, tokens, pos = 0) {
    let cap = {};
    for (let ti = 0; ti < tokens.length; ti++) {
        const tok = tokens[ti];
        if (tok.type === 'ws') { while (pos < src.length && /\s/.test(src[pos])) pos++; continue; }
        if (tok.type === 'lit') { if (!src.startsWith(tok.value, pos)) return null; pos += tok.value.length; continue; }
        if (tok.type === 'regex') {
            try {
                let regex = p._regexCache.get(tok.regex);
                if (!regex) {
                    regex = new RegExp(tok.regex);
                    p._regexCache.set(tok.regex, regex);
                }
                const m = src.slice(pos).match(regex);
                if (!m || m.index !== 0) return null;
                cap[p.symbols.sigil + tok.varName] = m[0];
                pos += m[0].length;
            } catch { return null; }
            continue;
        }
        if (tok.type === 'var') {
            while (pos < src.length && /\s/.test(src[pos])) pos++;
            const nx = findNext(tokens, ti);
            let v = '';
            if (nx?.type === 'block') {
                while (pos < src.length && !src.startsWith(nx.open, pos) && src[pos] !== '\n') v += src[pos++];
                v = v.trimEnd();
            } else if (nx?.type === 'lit') {
                while (pos < src.length && !src.startsWith(nx.value, pos) && src[pos] !== '\n') v += src[pos++];
                v = v.trimEnd();
            } else {
                while (pos < src.length && !/\s/.test(src[pos])) v += src[pos++];
            }
            if (!v && !tok.optional) return null;
            cap[p.symbols.sigil + tok.varName] = v;
            continue;
        }
        if (tok.type === 'block') {
            if (!src.startsWith(tok.open, pos)) return null;
            const [c, e] = extractBlock(p, src, pos, tok.open, tok.close);
            cap[p.symbols.sigil + tok.varName] = c; pos = e; continue;
        }
    }
    return { captures: cap, endPos: pos };
}

function findNext(t, i) { for (let k = i + 1; k < t.length; k++) if (t[k].type !== 'ws') return t[k]; return null; }

function extractBlock(p, src, i, od = p.symbols.open, cd = p.symbols.close) {
    if (od.length > 1 || cd.length > 1) {
        if (src.substring(i, i + od.length) === od) {
            i += od.length; const s = i; let d = 0;
            while (i < src.length) {
                if (src.substring(i, i + od.length) === od) { d++; i += od.length; }
                else if (src.substring(i, i + cd.length) === cd) {
                    if (!d) return [src.substring(s, i), i + cd.length];
                    d--; i += cd.length;
                } else i++;
            }
            return [src.substring(s), src.length];
        }
    }
    if (src[i] === od) {
        i++; const s = i;
        if (od === cd) { while (i < src.length && src[i] !== cd) i++; return [src.substring(s, i), i + 1]; }
        let d = 1;
        while (i < src.length && d > 0) { if (src[i] === od) d++; else if (src[i] === cd) d--; if (d > 0) i++; }
        return [src.substring(s, i), i + 1];
    }
    return ['', i];
}

function collectPats(p, src) {
    const arr = [];
    const rx = new RegExp(`(?:^|\\b)${esc(p.symbols.pattern)}\\s*${esc(p.symbols.open)}`, "g");
    let out = src;
    while (1) {
        rx.lastIndex = 0; const m = rx.exec(out); if (!m) break;
        const s = m.index, o = m.index + m[0].length - p.symbols.open.length;
        const [mp, em] = extractBlock(p, out, o); let k = em;
        while (k < out.length && /\s/.test(out[k])) k++;
        if (k < out.length && out.substring(k, k + p.symbols.open.length) === p.symbols.open) {
            const [rp, er] = extractBlock(p, out, k);
            arr.push({ m: mp.trim(), r: rp.trim() });
            out = out.slice(0, s) + out.slice(er); continue;
        }
        out = out.slice(0, s) + out.slice(em);
    }
    return [arr, out];
}

function extractNested(p, txt) {
    const n = [];
    const rx = new RegExp(`${esc(p.symbols.sigil)}${esc(p.symbols.pattern)}\\s*${esc(p.symbols.open)}`, "g");
    let out = txt;
    while (1) {
        rx.lastIndex = 0; const m = rx.exec(out); if (!m) break;
        const s = m.index, o = m.index + m[0].length - p.symbols.open.length;
        const [mp, em] = extractBlock(p, out, o); let k = em;
        while (k < out.length && /\s/.test(out[k])) k++;
        if (k < out.length && out.substring(k, k + p.symbols.open.length) === p.symbols.open) {
            const [rp, er] = extractBlock(p, out, k);
            n.push({ m: mp.trim(), r: rp.trim() });
            out = out.slice(0, s) + out.slice(er); continue;
        }
        out = out.slice(0, s) + out.slice(em);
    }
    return [n, out];
}

function extractEvals(p, txt) {
    const ev = [], S = p.symbols.sigil, O = p.symbols.open;
    let i = 0, out = txt, off = 0;
    while (i < txt.length) {
        if (txt.substring(i, i + S.length) === S && txt.substring(i + S.length, i + S.length + p.symbols.eval.length) === p.symbols.eval) {
            let j = i + S.length + p.symbols.eval.length;
            while (j < txt.length && /\s/.test(txt[j])) j++;
            if (j < txt.length && txt.substring(j, j + O.length) === O) {
                const sp = i, bp = j;
                const [c, ep] = extractBlock(p, txt, bp);
                ev.push({ code: c, sp: sp - off, ep: ep - off });
                const ph = `__E${ev.length - 1}__`;
                out = out.substring(0, sp - off) + ph + out.substring(ep - off);
                off += (ep - sp) - ph.length; i = ep; continue;
            }
        }
        i++;
    }
    return [ev, out];
}

function applyEvals(p, txt, ev) {
    let r = txt;
    for (let i = ev.length - 1; i >= 0; i--) {
        const ph = `__E${i}__`;
        let res;
        try { res = String(Function("papagaio", "ctx", `"use strict";return(function(){${ev[i].code}})();`)(p, {})); }
        catch (e) { res = "error: " + e.message; }
        r = r.replace(ph, res);
    }
    return r;
}

function applyPats(p, src, pats) {
    let last = "", S = p.symbols.sigil;
    for (const pat of pats) {
        const tok = parsePattern(p, pat.m); 
        let n = '', pos = 0, ok = false;
        while (pos < src.length) {
            const m = matchPattern(p, src, tok, pos);
            if (m) {
                ok = true; 
                let r = pat.r;
                const [nested, clean] = extractNested(p, r);
                r = clean;
                for (const [k, v] of Object.entries(m.captures)) {
                    r = r.replace(new RegExp(esc(k) + '(?![A-Za-z0-9_])', 'g'), v);
                }
                if (nested.length) r = applyPats(p, r, nested);
                p.match = src.slice(pos, m.endPos);
                const [ev, ct] = extractEvals(p, r);
                if (ev.length) r = applyEvals(p, ct, ev);
                n += r; last = r; pos = m.endPos;
            } else { n += src[pos]; pos++; }
        }
        if (ok) src = n;
    }
    return src;
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\""']/g, '\\$&'); }
function unescapeDelim(s) {
    let r = ''; 
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '\\' && i + 1 < s.length && (s[i+1] === '"' || s[i+1] === "'" || s[i+1] === '\\')) { r += s[i+1]; i++; }
        else r += s[i];
    }
    return r;
}

export class Papagaio {
    constructor(sigil = '$', open = '{', close = '}', pattern = 'pattern', evalKeyword = 'eval', blockKeyword = 'block', regexKeyword = 'regex') {
        this.recursion_limit = 512;
        this.symbols = { pattern, open, close, sigil, eval: evalKeyword, block: blockKeyword, regex: regexKeyword };
        this.content = "";
        this.match = "";
        this._regexCache = new Map();
    }
    process(input) {
        this.content = input; 
        let src = input, last = null, it = 0;
        const pending = () => new RegExp(`(?:^|\\b)${esc(this.symbols.pattern)}\\s*${esc(this.symbols.open)}`, "g").test(src);
        while (src !== last && it < this.recursion_limit) {
            it++; last = src;
            const [p, s2] = collectPats(this, src); 
            src = applyPats(this, s2, p);
            if (!pending()) break;
        }
        return this.content = src, src;
    }
}
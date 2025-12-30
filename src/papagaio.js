// papagaio - https://github.com/jardimdanificado/papagaio
import { capture } from './louro.js';

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

function extractNested(p, txt) {
    const loc = [], S = p.symbols.sigil, O = p.symbols.open;
    let out = txt;
    const rx = new RegExp(`${esc(S)}${esc(p.symbols.pattern)}\\s*${esc(O)}`, "g");
    while (1) {
        rx.lastIndex = 0; const m = rx.exec(out); if (!m) break;
        const s = m.index, o = m.index + m[0].length - O.length;
        const [mp, em] = extractBlock(p, out, o); let k = em;
        while (k < out.length && /\s/.test(out[k])) k++;
        if (k < out.length && out.substring(k, k + O.length) === O) {
            const [rp, er] = extractBlock(p, out, k);
            loc.push({ m: mp.trim(), r: rp.trim() });
            out = out.slice(0, s) + out.slice(er); continue;
        }
        out = out.slice(0, s) + out.slice(em);
    }
    return [loc, out];
}

function extractEvals(p, txt) {
    const ev = [], S = p.symbols.sigil, O = p.symbols.open;
    let i = 0, out = txt, off = 0;
    while (i < txt.length) {
        if (txt.substring(i, i + S.length) === S && txt.substring(i + S.length).startsWith(p.symbols.eval)) {
            let j = i + S.length + p.symbols.eval.length;
            while (j < txt.length && /\s/.test(txt[j])) j++;
            if (j < txt.length && txt.substring(j, j + O.length) === O) {
                const sp = i, bp = j, [c, ep] = extractBlock(p, txt, bp);
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
        try { 
            r = r.replace(ph, String(
                Function("ctx", `"use strict";${ev[i].code}`).call(p, {})
            )); 
        }
        catch (e) { r = r.replace(ph, "error: " + e.message); }
    }
    return r;
}

function processRegexPatterns(p, src, pattern) {
    // Processa padrões regex que o louro não suporta nativamente
    const S = p.symbols.sigil, O = p.symbols.open;
    const regexMatch = pattern.match(new RegExp(`${esc(S)}${esc(p.symbols.regex)}\\s+([A-Za-z0-9_]+)\\s*${esc(O)}([^${esc(p.symbols.close)}]*)${esc(p.symbols.close)}`));
    
    if (!regexMatch) return null;
    
    const varName = regexMatch[1];
    const regexStr = regexMatch[2].trim();
    
    try {
        const rx = new RegExp(regexStr);
        const matches = [];
        let pos = 0;
        
        while (pos < src.length) {
            const m = src.slice(pos).match(rx);
            if (m && m.index === 0) {
                matches.push({
                    matched: m[0],
                    captures: { [varName]: m[0] },
                    start: pos,
                    end: pos + m[0].length
                });
                pos += m[0].length;
            } else {
                pos++;
            }
        }
        
        return matches;
    } catch (e) {
        return null;
    }
}

function applyPats(p, src, pats) {
    for (const pat of pats) {
        // Verifica se é um padrão regex
        const regexMatches = processRegexPatterns(p, src, pat.m);
        
        if (regexMatches) {
            // Processa como padrão regex
            let n = '', lastPos = 0;
            
            for (const match of regexMatches) {
                n += src.slice(lastPos, match.start);
                
                let r = pat.r;
                const [loc, cln] = extractNested(p, r);
                r = cln;
                
                Object.keys(match.captures).forEach(k => {
                    r = r.replace(new RegExp(esc(p.symbols.sigil + k) + '(?![A-Za-z0-9_])', 'g'), match.captures[k]);
                });
                
                if (loc.length) r = applyPats(p, r, loc);
                p.match = match.matched;
                const [ev, ct] = extractEvals(p, r);
                if (ev.length) r = applyEvals(p, ct, ev);
                
                n += r;
                lastPos = match.end;
            }
            
            n += src.slice(lastPos);
            if (regexMatches.length > 0) src = n;
        } else {
            // Usa louro para padrões normais
            const result = capture(src, pat.m, p.symbols);
            
            if (result.count > 0) {
                src = result.replace((match) => {
                    let r = pat.r;
                    const [loc, cln] = extractNested(p, r);
                    r = cln;
                    
                    Object.keys(match.captures).forEach(k => {
                        r = r.replace(new RegExp(esc(p.symbols.sigil + k) + '(?![A-Za-z0-9_])', 'g'), match.captures[k]);
                    });
                    
                    if (loc.length) r = applyPats(p, r, loc);
                    p.match = match.matched;
                    const [ev, ct] = extractEvals(p, r);
                    if (ev.length) r = applyEvals(p, ct, ev);
                    
                    return r;
                });
            }
        }
    }
    return src;
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\""']/g, '\\$&'); }

export class Papagaio {
    constructor(sigil = '$', open = '{', close = '}', pattern = 'pattern', evalKw = 'eval', blockKw = 'recursive', regexKw = 'regex', blockseqKw = 'sequential') {
        this.symbols = { pattern, open, close, sigil, eval: evalKw, block: blockKw, regex: regexKw, blockseq: blockseqKw };
        this.content = "";
        this.match = "";
    }
    process(input) {
        const [loc, cln] = extractNested(this, input);
        const [evals, ph] = extractEvals(this, cln);
        let proc = applyEvals(this, ph, evals);
        if (loc.length === 0) {
            this.content = proc;
            return proc;
        }
        let src = proc, last = null;
        while (src !== last) {
            last = src;
            src = applyPats(this, src, loc);
            const [nested] = extractNested(this, src);
            if (nested.length === 0) break;
        }
        this.content = src;
        if (typeof this.exit == "function") this.exit();
        return this.content;
    }
}
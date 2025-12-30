// louro - https://github.com/jardimdanificado/papagaio
function parsePattern(symbols, pat) {
    const t = [], S = symbols.sigil, O = symbols.open, C = symbols.close;
    let i = 0;
    while (i < pat.length) {
        if (pat[i] === S) {
            let j = i + S.length;
            const isDouble = pat[j] === S;
            if (isDouble) j++;
            if (pat[j] === O) {
                const [od, e1] = extractBlock(symbols, pat, j);
                if (pat[e1] === O) {
                    const [cd, e2] = extractBlock(symbols, pat, e1);
                    let v = '', k = e2;
                    while (k < pat.length && /[A-Za-z0-9_]/.test(pat[k])) v += pat[k++];
                    if (v) {
                        let optional = pat[k] === '?';
                        if (optional) k++;

                        t.push({
                            type: isDouble ? 'blockseq' : 'block',
                            varName: v,
                            open: unescapeDelim(od.trim()) || O,
                            close: unescapeDelim(cd.trim()) || C,
                            optional
                        });
                        i = k; continue;
                    }
                }
            }
            j = i + S.length;
            let v = '';
            while (j < pat.length && /[A-Za-z0-9_]/.test(pat[j])) v += pat[j++];
            if (v) {
                const optional = pat[j] === '?';
                if (optional) j++;
                t.push({ type: 'var', varName: v, optional });
                i = j; continue;
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

function matchPattern(symbols, src, tok, pos = 0) {
    let cap = {};
    const startPos = pos;

    for (let ti = 0; ti < tok.length; ti++) {
        const t = tok[ti];
        if (t.type === 'ws') { while (pos < src.length && /\s/.test(src[pos])) pos++; continue; }
        if (t.type === 'lit') { if (!src.startsWith(t.value, pos)) return null; pos += t.value.length; continue; }
        if (t.type === 'var') {
            while (pos < src.length && /\s/.test(src[pos])) pos++;
            const nx = findNext(tok, ti);
            let v = '';
            if (nx && (nx.type === 'block' || nx.type === 'lit')) {
                const stop = nx.type === 'block' ? nx.open : nx.value;
                while (pos < src.length && !src.startsWith(stop, pos) && src[pos] !== '\n') v += src[pos++];
                v = v.trimEnd();
            } else {
                while (pos < src.length && !/\s/.test(src[pos])) v += src[pos++];
            }
            if (!v && !t.optional) return null;
            cap[t.varName] = v;
            continue;
        }
        if (t.type === 'blockseq') {
            let blocks = [];
            while (pos < src.length && src.startsWith(t.open, pos)) {
                const [c, e] = extractBlock(symbols, src, pos, t.open, t.close);
                blocks.push(c);
                pos = e;
                while (pos < src.length && /\s/.test(src[pos])) pos++;
            }
            if (!blocks.length && !t.optional) return null;
            cap[t.varName] = blocks;
            continue;
        }
        if (t.type === 'block') {
            if (!src.startsWith(t.open, pos)) {
                if (t.optional) {
                    cap[t.varName] = '';
                    continue;
                }
                return null;
            }

            const [c, e] = extractBlock(symbols, src, pos, t.open, t.close);
            cap[t.varName] = c; pos = e; continue;
        }
    }
    return { captures: cap, startPos, endPos: pos, matched: src.slice(startPos, pos) };
}

function findNext(t, i) {
    for (let k = i + 1; k < t.length; k++)
        if (t[k].type !== 'ws') return t[k];
    return null;
}

function extractBlock(symbols, src, i, od = symbols.open, cd = symbols.close) {
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

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\""']/g, '\\$&'); }
function unescapeDelim(s) {
    let r = '';
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '\\' && i + 1 < s.length && (s[i + 1] === '"' || s[i + 1] === "'" || s[i + 1] === '\\')) { r += s[i + 1]; i++; }
        else r += s[i];
    }
    return r;
}

export function capture(content, pattern, symbols = { sigil: '$', open: '{', close: '}' }) {
    const tokens = parsePattern(symbols, pattern);
    const matches = [];

    let pos = 0;
    while (pos < content.length) {
        const m = matchPattern(symbols, content, tokens, pos);
        if (m) {
            matches.push({
                matched: m.matched,
                captures: m.captures,
                start: m.startPos,
                end: m.endPos,
                index: matches.length
            });
            pos = m.endPos;
        } else {
            pos++;
        }
    }

    return {
        content,
        pattern,
        matches,
        count: matches.length,

        replace(replacement) {
            if (matches.length === 0) return { content, matches: [], count: 0 };

            let result = '';
            let lastPos = 0;

            for (const match of matches) {
                result += content.slice(lastPos, match.start);

                let rep = typeof replacement === 'function'
                    ? replacement(match)
                    : replacement;

                for (const [key, value] of Object.entries(match.captures)) {
                    const varPattern = new RegExp(esc(symbols.sigil + key) + '(?![A-Za-z0-9_])', 'g');
                    rep = rep.replace(varPattern, value);
                }

                result += rep;
                lastPos = match.end;
            }

            result += content.slice(lastPos);

            return result;
        },

        filter(predicate) {
            const filtered = matches.filter(predicate);
            return {
                content,
                pattern,
                matches: filtered,
                count: filtered.length,
                replace: this.replace.bind({ ...this, matches: filtered }),
                filter: this.filter,
                only: this.only
            };
        },

        only(n) {
            const len = this.matches.length;
            let idx = n >= 0 ? n : len + n;
            if (idx < 0 || idx >= len) {
                return {
                    ...this,
                    matches: []
                };
            }
            return {
                ...this,
                matches: [this.matches[idx]]
            };
        }
    };
}

Object.defineProperty(String.prototype, "capture", {
    value: function (pattern, symbols) {
        return capture(this.toString(), pattern, symbols);
    },
    writable: true,
    configurable: true,
    enumerable: false
});

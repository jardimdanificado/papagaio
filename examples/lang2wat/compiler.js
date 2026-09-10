// examples/lang2wat/compiler.js
// Compilador Completo de Sintaxe C Moderna para WebAssembly Text (WAT - WASM 1.0)
// usando Papagaio para pattern matching estrutural, sistema de macros, verbos de memória e geração de S-Expressions.

import { papagaio } from "../../src/index.js";

/**
 * Mapeamento de tipos C para tipos WebAssembly (WASM 1.0)
 */
const C_TO_WASM_TYPES = {
  int: "i32",
  i32: "i32",
  bool: "i32",
  char: "i32",
  short: "i32",
  long: "i64",
  i64: "i64",
  float: "f32",
  f32: "f32",
  double: "f64",
  f64: "f64",
  void: "void"
};

/**
 * Mapeamento de operadores binários para instruções WAT de acordo com o tipo
 */
const BIN_OPS = {
  i32: {
    "+": "i32.add",
    "-": "i32.sub",
    "*": "i32.mul",
    "/": "i32.div_s",
    "/u": "i32.div_u",
    "%": "i32.rem_s",
    "%u": "i32.rem_u",
    "&": "i32.and",
    "|": "i32.or",
    "^": "i32.xor",
    "<<": "i32.shl",
    ">>": "i32.shr_s",
    ">>u": "i32.shr_u",
    "==": "i32.eq",
    "!=": "i32.ne",
    "<": "i32.lt_s",
    "<=": "i32.le_s",
    ">": "i32.gt_s",
    ">=": "i32.ge_s",
  },
  f32: {
    "+": "f32.add",
    "-": "f32.sub",
    "*": "f32.mul",
    "/": "f32.div",
    "==": "f32.eq",
    "!=": "f32.ne",
    "<": "f32.lt",
    "<=": "f32.le",
    ">": "f32.gt",
    ">=": "f32.ge",
  }
};

/**
 * Remove comentários de linha (//) e em bloco (/* ... *\/)
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

/**
 * Encontra o operador ternário ? : fora de parênteses no nível superior
 */
function findTernary(expr) {
  let depth = 0;
  let qIdx = -1;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (depth === 0) {
      if (ch === "?" && qIdx === -1) {
        qIdx = i;
      } else if (ch === ":" && qIdx !== -1) {
        return {
          cond: expr.slice(0, qIdx).trim(),
          thenVal: expr.slice(qIdx + 1, i).trim(),
          elseVal: expr.slice(i + 1).trim()
        };
      }
    }
  }
  return null;
}

/**
 * Encontra um operador binário no nível superior (fora de parênteses/colchetes)
 */
function findTopLevelOp(expr, operators) {
  let depth = 0;
  for (let i = expr.length - 1; i >= 0; i--) {
    const ch = expr[i];
    if (ch === ")" || ch === "]") depth++;
    else if (ch === "(" || ch === "[") depth--;
    else if (depth === 0) {
      for (const op of operators) {
        if (expr.slice(i, i + op.length) === op) {
          const before = i > 0 ? expr[i - 1] : " ";
          const after = i + op.length < expr.length ? expr[i + op.length] : " ";
          if (op.length > 1 || (!/[a-zA-Z0-9_]/.test(before) && !/[a-zA-Z0-9_]/.test(after))) {
            return {
              op,
              left: expr.slice(0, i).trim(),
              right: expr.slice(i + op.length).trim()
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Divide argumentos separados por vírgula respeitando parênteses aninhados
 */
function splitArgs(argsStr) {
  const args = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < argsStr.length; i++) {
    if (argsStr[i] === "(") depth++;
    else if (argsStr[i] === ")") depth--;
    else if (argsStr[i] === "," && depth === 0) {
      args.push(argsStr.slice(start, i));
      start = i + 1;
    }
  }
  if (start < argsStr.length) {
    args.push(argsStr.slice(start));
  }
  return args;
}

/**
 * Compila expressões para S-Expressions WAT
 */
export function compileExpression(exprStr, ctx) {
  let expr = exprStr.trim();
  if (!expr) return "";

  // Remove parênteses externos redundantes em expressões C: (expr)
  if (expr.startsWith("(") && expr.endsWith(")")) {
    if (/^\((i32|i64|f32|f64|v128|local|global|call|block|loop|if|select|return|unreachable|memory|data|table|ref)[\s.]/.test(expr)) {
      return expr;
    }
    let depth = 0;
    let wrapped = true;
    for (let k = 0; k < expr.length - 1; k++) {
      if (expr[k] === "(") depth++;
      else if (expr[k] === ")") depth--;
      if (depth === 0) {
        wrapped = false;
        break;
      }
    }
    if (wrapped) {
      return compileExpression(expr.slice(1, -1), ctx);
    }
  }

  // 1. Operador Ternário C com instrução nativa 'select' do WASM: cond ? a : b
  const tern = findTernary(expr);
  if (tern) {
    const condWat = compileExpression(tern.cond, ctx);
    const thenWat = compileExpression(tern.thenVal, ctx);
    const elseWat = compileExpression(tern.elseVal, ctx);
    return `(select ${thenWat} ${elseWat} ${condWat})`;
  }

  // 2. Operadores de Comparação e Igualdade
  const rel = findTopLevelOp(expr, ["<=", ">=", "==", "!=", "<", ">"]);
  if (rel) {
    const leftWat = compileExpression(rel.left, ctx);
    const rightWat = compileExpression(rel.right, ctx);
    const wasmOp = BIN_OPS.i32[rel.op] || "i32.eq";
    return `(${wasmOp} ${leftWat} ${rightWat})`;
  }

  // 3. Operadores Bitwise (&, |, ^, <<, >>)
  const bitwise = findTopLevelOp(expr, ["<<", ">>", "&", "|", "^"]);
  if (bitwise) {
    const leftWat = compileExpression(bitwise.left, ctx);
    const rightWat = compileExpression(bitwise.right, ctx);
    const wasmOp = BIN_OPS.i32[bitwise.op];
    return `(${wasmOp} ${leftWat} ${rightWat})`;
  }

  // 4. Adição e Subtração (+, -)
  const addSub = findTopLevelOp(expr, ["+", "-"]);
  if (addSub && addSub.left.length > 0) {
    const leftWat = compileExpression(addSub.left, ctx);
    const rightWat = compileExpression(addSub.right, ctx);
    const wasmOp = BIN_OPS.i32[addSub.op];
    return `(${wasmOp} ${leftWat} ${rightWat})`;
  }

  // 5. Desreferência de Ponteiro C unário: *ptr
  const derefMatch = "*$ptr$identifier".papagaio.match(expr);
  if (derefMatch && !expr.includes(" ")) {
    return `(i32.load (local.get $${derefMatch.ptr}))`;
  }

  // 6. Multiplicação, Divisão e Módulo (*, /, %)
  const mulDiv = findTopLevelOp(expr, ["*", "/", "%"]);
  if (mulDiv) {
    const leftWat = compileExpression(mulDiv.left, ctx);
    const rightWat = compileExpression(mulDiv.right, ctx);
    const wasmOp = BIN_OPS.i32[mulDiv.op];
    return `(${wasmOp} ${leftWat} ${rightWat})`;
  }

  // 7. Indexação de Array/Ponteiro C: ptr[i] -> (i32.load (ptr + i * 4))
  const arrayIdxMatch = "$ptr$identifier[$idx]".papagaio.match(expr);
  if (arrayIdxMatch) {
    const idxWat = compileExpression(arrayIdxMatch.idx, ctx);
    return `(i32.load (i32.add (local.get $${arrayIdxMatch.ptr}) (i32.mul ${idxWat} (i32.const 4))))`;
  }

  // 8. String Literal C: "texto" -> aloca no pool de dados e retorna ponteiro
  if (expr.startsWith("\"") && expr.endsWith("\"")) {
    const rawContent = expr.slice(1, -1);
    const strPtr = ctx.moduleCtx.internString(rawContent);
    return `(i32.const ${strPtr})`;
  }

  // 9. Chamada de função ou Verbos de Memória / Built-ins Wasm 1.0
  const fnMatch = "$fn$identifier($args)".papagaio.match(expr);
  if (fnMatch) {
    const fnName = fnMatch.fn;
    const rawArgs = fnMatch.args.trim() ? splitArgs(fnMatch.args).map(a => compileExpression(a.trim(), ctx)) : [];
    
    // Verbos Diretos de Memória Linear
    if (fnName === "load" || fnName === "load32" || fnName === "i32_load") return `(i32.load ${rawArgs[0]})`;
    if (fnName === "store" || fnName === "store32" || fnName === "i32_store") return `(i32.store ${rawArgs[0]} ${rawArgs[1]})`;
    if (fnName === "load8" || fnName === "load8_u" || fnName === "i32_load8_u") return `(i32.load8_u ${rawArgs[0]})`;
    if (fnName === "load8_s" || fnName === "i32_load8_s") return `(i32.load8_s ${rawArgs[0]})`;
    if (fnName === "store8" || fnName === "i32_store8") return `(i32.store8 ${rawArgs[0]} ${rawArgs[1]})`;
    if (fnName === "load16" || fnName === "load16_u" || fnName === "i32_load16_u") return `(i32.load16_u ${rawArgs[0]})`;
    if (fnName === "load16_s" || fnName === "i32_load16_s") return `(i32.load16_s ${rawArgs[0]})`;
    if (fnName === "store16" || fnName === "i32_store16") return `(i32.store16 ${rawArgs[0]} ${rawArgs[1]})`;
    if (fnName === "load64" || fnName === "load_i64" || fnName === "i64_load") return `(i64.load ${rawArgs[0]})`;
    if (fnName === "store64" || fnName === "store_i64" || fnName === "i64_store") return `(i64.store ${rawArgs[0]} ${rawArgs[1]})`;
    if (fnName === "load_f32" || fnName === "load_float" || fnName === "f32_load") return `(f32.load ${rawArgs[0]})`;
    if (fnName === "store_f32" || fnName === "store_float" || fnName === "f32_store") return `(f32.store ${rawArgs[0]} ${rawArgs[1]})`;
    if (fnName === "load_f64" || fnName === "load_double" || fnName === "f64_load") return `(f64.load ${rawArgs[0]})`;
    if (fnName === "store_f64" || fnName === "store_double" || fnName === "f64_store") return `(f64.store ${rawArgs[0]} ${rawArgs[1]})`;
    if (fnName === "memory_size") return `(memory.size)`;
    if (fnName === "memory_grow") return `(memory.grow ${rawArgs[0]})`;

    // Built-ins Numéricos e Bitwise Wasm 1.0
    if (fnName === "clz") return `(i32.clz ${rawArgs[0]})`;
    if (fnName === "ctz") return `(i32.ctz ${rawArgs[0]})`;
    if (fnName === "popcnt") return `(i32.popcnt ${rawArgs[0]})`;
    if (fnName === "sqrt" || fnName === "f32_sqrt") return `(f32.sqrt ${rawArgs[0]})`;
    if (fnName === "abs" || fnName === "f32_abs") return `(f32.abs ${rawArgs[0]})`;
    if (fnName === "min" || fnName === "f32_min") return `(f32.min ${rawArgs[0]} ${rawArgs[1]})`;
    if (fnName === "max" || fnName === "f32_max") return `(f32.max ${rawArgs[0]} ${rawArgs[1]})`;

    return `(call $${fnName} ${rawArgs.join(" ")})`;
  }

  // 10. Literais numéricos
  if (/^-?\d+$/.test(expr)) {
    return `(i32.const ${expr})`;
  }
  if (/^-?\d+\.\d+$/.test(expr)) {
    return `(f32.const ${expr})`;
  }

  // 11. Booleanos C
  if (expr === "true") return "(i32.const 1)";
  if (expr === "false") return "(i32.const 0)";

  // 12. Identificadores / variáveis (locais ou globais)
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expr)) {
    if (ctx.moduleCtx.globals.has(expr)) {
      return `(global.get $${expr})`;
    }
    return `(local.get $${expr})`;
  }

  return expr;
}

/**
 * Desaçucara laços `for (init; cond; step) { body }` do C para `while`
 */
function desugarForLoops(code) {
  let res = code;
  const forPattern = "for ($init; $cond; $step) $body$block";
  let m;
  while ((m = forPattern.papagaio.match(res)) !== null) {
    const desugared = `${m.init}; while (${m.cond}) { ${m.body}; ${m.step}; }`;
    res = forPattern.papagaio.replace(res, desugared);
  }
  return res;
}

/**
 * Compila instruções e blocos da função C
 */
export function compileStatements(bodyStr, ctx) {
  let clean = desugarForLoops(bodyStr).trim();
  if (!clean) return "";

  const watStatements = [];
  let i = 0;
  const len = clean.length;

  while (i < len) {
    while (i < len && /\s/.test(clean[i])) i++;
    if (i >= len) break;

    const remaining = clean.slice(i);

    // 1. Cadeia de if / else if / else
    if (remaining.startsWith("if")) {
      const ifMatch = "if ($cond) $then$block".papagaio.match(remaining);
      if (ifMatch) {
        let condWat = compileExpression(ifMatch.cond, ctx);
        let thenWat = compileStatements(ifMatch.then, ctx);
        let resWat = `(if\n      ${condWat}\n      (then\n        ${thenWat}\n      )`;
        
        let cursor = remaining.indexOf("}") + 1;
        let rest = remaining.slice(cursor).trim();
        let elseStack = 0;

        // Processa cadeias de else if
        while (rest.startsWith("else if")) {
          const eifMatch = "else if ($cond) $then$block".papagaio.match(rest);
          if (!eifMatch) break;
          const eCondWat = compileExpression(eifMatch.cond, ctx);
          const eThenWat = compileStatements(eifMatch.then, ctx);
          resWat += `\n      (else\n        (if\n          ${eCondWat}\n          (then\n            ${eThenWat}\n          )`;
          elseStack++;
          const eClose = rest.indexOf("}") + 1;
          cursor += (remaining.slice(cursor).indexOf("else if") + eClose);
          rest = remaining.slice(cursor).trim();
        }

        // Processa o else final
        if (rest.startsWith("else")) {
          const elseMatch = "else $els$block".papagaio.match(rest);
          if (elseMatch) {
            const elseWat = compileStatements(elseMatch.els, ctx);
            resWat += `\n          (else\n            ${elseWat}\n          )`;
            const elClose = rest.indexOf("}") + 1;
            cursor += (remaining.slice(cursor).indexOf("else") + elClose);
          }
        }

        // Fecha os blocos else if aninhados
        for (let k = 0; k < elseStack; k++) {
          resWat += `\n        )\n      )`;
        }
        resWat += `\n    )`;

        watStatements.push(resWat);
        i += cursor;
        continue;
      }
    }

    // 2. while loop do C: while ($cond) $body$block
    const whileMatch = "while ($cond) $body$block".papagaio.match(remaining);
    if (whileMatch && remaining.trimStart().startsWith("while")) {
      ctx.loopDepth = (ctx.loopDepth || 0) + 1;
      const loopId = ctx.loopDepth;
      const condWat = compileExpression(whileMatch.cond, ctx);
      const loopBodyWat = compileStatements(whileMatch.body, ctx);

      watStatements.push(`(block $break_${loopId}
      (loop $continue_${loopId}
        (br_if $break_${loopId} (i32.eqz ${condWat}))
        ${loopBodyWat}
        (br $continue_${loopId})
      )
    )`);

      ctx.loopDepth--;
      i += remaining.indexOf("}") + 1;
      continue;
    }

    // 3. Statements normais delimitados por ';'
    let semiIdx = clean.indexOf(";", i);
    let stmt;
    if (semiIdx === -1) {
      stmt = clean.slice(i).trim();
      i = len;
    } else {
      stmt = clean.slice(i, semiIdx).trim();
      i = semiIdx + 1;
    }

    if (!stmt) continue;

    // Declaração de variável C: int x = val; ou float x = val;
    const cVarDeclMatch = "$type$identifier $name$identifier = $val".papagaio.match(stmt);
    if (cVarDeclMatch && C_TO_WASM_TYPES[cVarDeclMatch.type]) {
      const wasmType = C_TO_WASM_TYPES[cVarDeclMatch.type];
      ctx.locals.set(cVarDeclMatch.name, wasmType);
      const valWat = compileExpression(cVarDeclMatch.val, ctx);
      watStatements.push(`(local.set $${cVarDeclMatch.name} ${valWat})`);
      continue;
    }

    // Declaração de variável ponteiro C: int* ptr = val; ou char* str = val;
    const cPtrDeclMatch = "$type$identifier* $name$identifier = $val".papagaio.match(stmt);
    if (cPtrDeclMatch && C_TO_WASM_TYPES[cPtrDeclMatch.type]) {
      ctx.locals.set(cPtrDeclMatch.name, "i32");
      const valWat = compileExpression(cPtrDeclMatch.val, ctx);
      watStatements.push(`(local.set $${cPtrDeclMatch.name} ${valWat})`);
      continue;
    }

    // Operadores de incremento e decremento: i++ / ++i / i-- / --i
    if (stmt.endsWith("++")) {
      const v = stmt.slice(0, -2).trim();
      watStatements.push(`(local.set $${v} (i32.add (local.get $${v}) (i32.const 1)))`);
      continue;
    }
    if (stmt.startsWith("++")) {
      const v = stmt.slice(2).trim();
      watStatements.push(`(local.set $${v} (i32.add (local.get $${v}) (i32.const 1)))`);
      continue;
    }
    if (stmt.endsWith("--")) {
      const v = stmt.slice(0, -2).trim();
      watStatements.push(`(local.set $${v} (i32.sub (local.get $${v}) (i32.const 1)))`);
      continue;
    }
    if (stmt.startsWith("--")) {
      const v = stmt.slice(2).trim();
      watStatements.push(`(local.set $${v} (i32.sub (local.get $${v}) (i32.const 1)))`);
      continue;
    }

    // Atribuições compostas: x += val, x -= val, x *= val, x /= val
    const compAssignOps = ["+=", "-=", "*=", "/="];
    let matchedComp = false;
    for (const cop of compAssignOps) {
      const cpat = `$name$identifier ${cop} $val`;
      const cm = cpat.papagaio.match(stmt);
      if (cm) {
        const opChar = cop[0];
        const valWat = compileExpression(cm.val, ctx);
        const wasmOp = BIN_OPS.i32[opChar];
        if (ctx.moduleCtx.globals.has(cm.name)) {
          watStatements.push(`(global.set $${cm.name} (${wasmOp} (global.get $${cm.name}) ${valWat}))`);
        } else {
          watStatements.push(`(local.set $${cm.name} (${wasmOp} (local.get $${cm.name}) ${valWat}))`);
        }
        matchedComp = true;
        break;
      }
    }
    if (matchedComp) continue;

    // Escrita em array/ponteiro C: ptr[i] = val;
    const arrayStoreMatch = "$ptr$identifier[$idx] = $val".papagaio.match(stmt);
    if (arrayStoreMatch) {
      const idxWat = compileExpression(arrayStoreMatch.idx, ctx);
      const valWat = compileExpression(arrayStoreMatch.val, ctx);
      watStatements.push(`(i32.store (i32.add (local.get $${arrayStoreMatch.ptr}) (i32.mul ${idxWat} (i32.const 4))) ${valWat})`);
      continue;
    }

    // Escrita em ponteiro C: *ptr = val;
    const ptrStoreMatch = "*$ptr$identifier = $val".papagaio.match(stmt);
    if (ptrStoreMatch) {
      const valWat = compileExpression(ptrStoreMatch.val, ctx);
      watStatements.push(`(i32.store (local.get $${ptrStoreMatch.ptr}) ${valWat})`);
      continue;
    }

    // Atribuição normal (local ou global): x = val;
    const assignMatch = "$name$identifier = $val".papagaio.match(stmt);
    if (assignMatch) {
      const valWat = compileExpression(assignMatch.val, ctx);
      if (ctx.moduleCtx.globals.has(assignMatch.name)) {
        watStatements.push(`(global.set $${assignMatch.name} ${valWat})`);
      } else {
        watStatements.push(`(local.set $${assignMatch.name} ${valWat})`);
      }
      continue;
    }

    // Return: return val; ou return;
    const returnMatch = "return $val".papagaio.match(stmt);
    if (returnMatch) {
      const valWat = compileExpression(returnMatch.val, ctx);
      watStatements.push(`(return ${valWat})`);
      continue;
    }
    if (stmt === "return") {
      watStatements.push("(return)");
      continue;
    }

    // Expressão isolada (ex: chamadas de função void como store(addr, val))
    const exprWat = compileExpression(stmt, ctx);
    if (exprWat) {
      watStatements.push(exprWat);
    }
  }

  return watStatements.join("\n    ");
}

/**
 * Extrai e expande macros no código fonte usando Papagaio
 */
export function expandMacros(sourceCode) {
  let clean = sourceCode;
  const macroRules = [];

  // 1. Extrai macros com bloco: macro $pattern => $template$block
  const blockMacroPattern = "macro $pattern => $template$block";
  let m;
  while ((m = blockMacroPattern.papagaio.match(clean)) !== null) {
    macroRules.push({
      pattern: m.pattern.trim(),
      template: m.template.trim()
    });

    const startIdx = clean.indexOf("macro " + m.pattern);
    const afterArrow = clean.indexOf("=>", startIdx) + 2;
    const blockOpen = clean.indexOf("{", afterArrow);
    let depth = 0;
    let blockEnd = -1;
    for (let k = blockOpen; k < clean.length; k++) {
      if (clean[k] === "{") depth++;
      else if (clean[k] === "}") {
        depth--;
        if (depth === 0) {
          blockEnd = k + 1;
          break;
        }
      }
    }
    let semiEnd = blockEnd;
    while (semiEnd < clean.length && (clean[semiEnd] === ";" || /\s/.test(clean[semiEnd]))) {
      if (clean[semiEnd] === ";") { semiEnd++; break; }
      semiEnd++;
    }
    clean = clean.slice(0, startIdx) + clean.slice(semiEnd);
  }

  // 2. Extrai macros inline de expressão: macro $pattern => $expr;
  const inlineMacroRegex = /macro\s+([a-zA-Z0-9_$(),\s]+)\s*=>\s*([^;]+);/g;
  let im;
  while ((im = inlineMacroRegex.exec(clean)) !== null) {
    macroRules.push({
      pattern: im[1].trim(),
      template: im[2].trim()
    });
  }
  clean = clean.replace(inlineMacroRegex, "");

  // 3. Aplica expansão de macros em cascata (até 10 passadas para macros aninhadas)
  let expanded = clean;
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    for (const rule of macroRules) {
      const next = rule.pattern.papagaio.replace(expanded, (captures) => {
        let rep = rule.template;
        for (const [k, v] of Object.entries(captures)) {
          rep = rep.replaceAll(`$${k}`, v);
        }
        return rep;
      });
      if (next !== expanded) {
        expanded = next;
        changed = true;
      }
    }
    if (!changed) break;
  }

  return expanded;
}

/**
 * Compila o código fonte completo de uma linguagem estilo C para WAT
 */
export function compileLangToWat(sourceCode) {
  const expandedSource = expandMacros(sourceCode);
  const cleanSource = stripComments(expandedSource);
  const functionsWat = [];
  const importsWat = [];
  const globalsWat = [];
  let memoryWat = "";

  // Contexto compartilhado do módulo (String Pool, Globals, Imports)
  const moduleCtx = {
    globals: new Map(),
    stringPool: new Map(),
    memoryOffset: 1024,
    internString(str) {
      if (this.stringPool.has(str)) {
        return this.stringPool.get(str).offset;
      }
      const offset = this.memoryOffset;
      const byteLen = Buffer.byteLength(str, "utf8") + 1;
      this.stringPool.set(str, { offset, byteLen });
      this.memoryOffset += byteLen;
      return offset;
    }
  };

  // 1. Declaração de memória: memory 1; ou memory $pages;
  const memoryMatch = "memory $pages$int;?".papagaio.match(cleanSource);
  if (memoryMatch) {
    memoryWat = `  (memory (export "memory") ${memoryMatch.pages})\n`;
  }

  // 2. Imports externos: import "module" type name(params);
  const importRegex = /import\s+"([^"]+)"\s+([a-zA-Z_][a-zA-Z0-9_]*\*?)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*;/g;
  let imp;
  while ((imp = importRegex.exec(cleanSource)) !== null) {
    const modName = imp[1];
    const rawRetType = imp[2].replace(/\*/g, "");
    const fnName = imp[3];
    const rawParams = imp[4].trim();

    const retType = C_TO_WASM_TYPES[rawRetType] || "void";
    const paramsList = [];
    if (rawParams && rawParams !== "void") {
      const pItems = rawParams.split(",").map(p => p.trim());
      for (const p of pItems) {
        const parts = p.split(/\s+/);
        if (parts.length >= 1) {
          const pTypeRaw = parts[0].replace(/\*/g, "");
          const wasmType = C_TO_WASM_TYPES[pTypeRaw] || "i32";
          paramsList.push(wasmType);
        }
      }
    }

    const paramsStr = paramsList.length ? ` (param ${paramsList.join(" ")})` : "";
    const resultStr = retType !== "void" ? ` (result ${retType})` : "";

    importsWat.push(`  (import "${modName}" "${fnName}" (func $${fnName}${paramsStr}${resultStr}))`);
  }

  // 3. Globais: global int nome = val;
  const globalRegex = /global\s+([a-zA-Z_][a-zA-Z0-9_]*\*?)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^;]+);/g;
  let g;
  while ((g = globalRegex.exec(cleanSource)) !== null) {
    const rawType = g[1].replace(/\*/g, "");
    const gName = g[2];
    const initVal = g[3].trim();
    const wasmType = C_TO_WASM_TYPES[rawType] || "i32";

    moduleCtx.globals.set(gName, wasmType);
    globalsWat.push(`  (global $${gName} (mut ${wasmType}) (${wasmType}.const ${initVal}))`);
  }

  // 4. Funções em estilo C: [export] type name(params) { body }
  const fnRegex = /(export\s+)?([a-zA-Z_][a-zA-Z0-9_]*\*?)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{/g;
  let match;

  while ((match = fnRegex.exec(cleanSource)) !== null) {
    const isExport = Boolean(match[1]);
    const rawReturnType = match[2].replace(/\*/g, "");
    const fnName = match[3];
    const rawParams = match[4].trim();

    const returnType = C_TO_WASM_TYPES[rawReturnType] || "i32";

    const bodyStartIndex = fnRegex.lastIndex - 1;
    let depth = 0;
    let bodyEndIndex = -1;

    for (let k = bodyStartIndex; k < cleanSource.length; k++) {
      if (cleanSource[k] === "{") depth++;
      else if (cleanSource[k] === "}") {
        depth--;
        if (depth === 0) {
          bodyEndIndex = k;
          break;
        }
      }
    }

    const rawBody = cleanSource.slice(bodyStartIndex + 1, bodyEndIndex);
    fnRegex.lastIndex = bodyEndIndex + 1;

    const ctx = {
      moduleCtx,
      locals: new Map(),
      returnType: returnType,
      loopDepth: 0
    };

    // Parâmetros no estilo C: int a, int b, int* ptr
    const paramsList = [];
    if (rawParams && rawParams !== "void") {
      const pItems = rawParams.split(",").map(p => p.trim());
      for (const p of pItems) {
        const cleanP = p.replace(/\s*\*\s*/g, " *");
        const parts = cleanP.split(/\s+/);
        if (parts.length >= 2) {
          const pTypeRaw = parts[0].replace(/\*/g, "");
          const pName = parts[1].replace(/\*/g, "");
          const wasmType = C_TO_WASM_TYPES[pTypeRaw] || "i32";
          paramsList.push(`(param $${pName} ${wasmType})`);
        }
      }
    }

    // Compila o corpo da função
    const compiledBody = compileStatements(rawBody, ctx);

    // Declarações de variáveis locais coletadas
    const localsList = [];
    for (const [varName, varType] of ctx.locals.entries()) {
      localsList.push(`(local $${varName} ${varType})`);
    }

    const exportAttr = isExport ? ` (export "${fnName}")` : "";
    const paramsStr = paramsList.length ? " " + paramsList.join(" ") : "";
    const resultStr = returnType !== "void" ? ` (result ${returnType})` : "";
    const localsStr = localsList.length ? `\n    ${localsList.join("\n    ")}` : "";
    const trailingUnreachable = returnType !== "void" ? "\n    (unreachable)" : "";

    const funcDef = `  (func $${fnName}${exportAttr}${paramsStr}${resultStr}${localsStr}
    ${compiledBody}${trailingUnreachable}
  )`;

    functionsWat.push(funcDef);
  }

  // 5. Gera os segmentos de dados (Data Segments) das strings internadas
  const dataSegmentsWat = [];
  for (const [str, meta] of moduleCtx.stringPool.entries()) {
    dataSegmentsWat.push(`  (data (i32.const ${meta.offset}) "${str}\\00")`);
  }

  const sections = [
    importsWat.length ? importsWat.join("\n") : "",
    memoryWat.trimEnd(),
    globalsWat.length ? globalsWat.join("\n") : "",
    dataSegmentsWat.length ? dataSegmentsWat.join("\n") : "",
    functionsWat.join("\n\n")
  ].filter(Boolean);

  return `(module
${sections.join("\n\n")}
)`;
}

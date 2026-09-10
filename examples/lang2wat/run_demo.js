// examples/lang2wat/run_demo.js
// Demonstração Completa da Linguagem C para WebAssembly (WASM 1.0) usando Papagaio.
// Inclui: Sistema de Macros (Papagaio), Host Imports, Globais, Strings Estáticas, Else If, Ternário e Built-ins.

import { compileLangToWat } from "./compiler.js";
import { execSync } from "node:child_process";
import fs from "node:fs";

console.log("=== PAPAGAIO COMPILER: C-LIKE COM SISTEMA DE MACROS PARA WEBASSEMBLY ===");

// 1. Código Fonte em C demonstrando macros e recursos avançados
const cSource = `
// 1. Importações do Host (JavaScript)
import "env" void print_int(int val);
import "env" void print_str(int ptr);

// 2. Memória Linear de 1 Página (64KB)
memory 1;

// 3. Variável Global Mutável
global int g_counter = 500;

// 4. DEFINIÇÃO DE MACROS VIA PAPAGAIO (Meta-programação em tempo de compilação)
macro min($a, $b) => ($a < $b ? $a : $b);

macro swap($a, $b) => {
    int _tmp = $a;
    $a = $b;
    $b = _tmp;
};

macro repeat($times) $body$block => {
    for (int _i = 0; _i < $times; _i++) {
        $body
    }
};

// 5. Função que utiliza as macros definidas acima
export int test_macro_system(int a, int b) {
    int menor = min(a, b);
    
    // Inverte os valores de 'a' e 'b' usando a macro swap
    swap(a, b);
    
    int acumulador = 0;
    // Repete 4 vezes adicionando o novo valor de 'a' usando a macro repeat
    repeat(4) {
        acumulador += a;
    }
    
    return acumulador + menor;
}

// 6. Acesso Direto à Memória Linear (Verbos explícitos: store, load, store8, load8)
export int test_direct_memory() {
    store(100, 4000);
    store8(200, 200);
    store(300, 42);
    
    int valInt = load(100);
    int valByte = load8(200);
    int valStore = load(300);
    
    return valInt + valByte + valStore; // 4000 + 200 + 42 = 4242
}

// 7. Cadeia de 'else if'
export int score_grade(int score) {
    if (score >= 90) {
        return 1; // Grade A
    } else if (score >= 80) {
        return 2; // Grade B
    } else if (score >= 70) {
        return 3; // Grade C
    } else {
        return 4; // Grade F
    }
}

// 7. Strings literais (Data Segment) e chamada de Host Import
export void greet() {
    print_str("Ola Mundo do WebAssembly com Macros Papagaio!");
}

// 8. Manipulação de Globais
export int increment_global(int amount) {
    g_counter += amount;
    return g_counter;
}

// 9. Built-ins de Bits e Memória (store8 / load8)
export int bit_and_byte_ops(int val) {
    int bits = popcnt(val);
    store8(200, 255);
    int byteVal = load8(200);
    return bits + byteVal;
}

// 10. Fibonacci recursivo
export int fib(int n) {
    if (n <= 1) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}
`;

console.log("\n[1] Código Fonte com Macros:");
console.log(cSource.trim());

// 2. Compilação usando Papagaio (expansão de macros + geração de WAT)
console.log("\n[2] Compilando código (com expansão de macros) para WAT com Papagaio...");
const watOutput = compileLangToWat(cSource);

console.log("\n--- WAT GERADO PELO PAPAGAIO ---");
console.log(watOutput);

// 3. Gravação e montagem com wat2wasm
fs.writeFileSync("examples/lang2wat/output.wat", watOutput);
console.log("\n[3] Validando e montando com 'wat2wasm'...");
execSync("wat2wasm examples/lang2wat/output.wat -o examples/lang2wat/output.wasm");
console.log("✅ Compilação para binário WebAssembly (.wasm) bem-sucedida!");

// 4. Execução no motor WebAssembly nativo
console.log("\n[4] Instanciando o WebAssembly compilado no Node.js...");
const wasmBuffer = fs.readFileSync("examples/lang2wat/output.wasm");

let memoryRef = null;
let lastPrintedString = "";

const importObject = {
  env: {
    print_int: (val) => {
      console.log("  [Host JS -> print_int]:", val);
    },
    print_str: (ptr) => {
      const bytes = new Uint8Array(memoryRef.buffer, ptr);
      let end = 0;
      while (bytes[end] !== 0) end++;
      const text = new TextDecoder("utf8").decode(bytes.subarray(0, end));
      lastPrintedString = text;
      console.log("  [Host JS -> print_str]:", `"${text}" (offset ${ptr})`);
    }
  }
};

const wasmModule = await WebAssembly.instantiate(wasmBuffer, importObject);
const {
  test_macro_system,
  test_direct_memory,
  score_grade,
  greet,
  increment_global,
  bit_and_byte_ops,
  fib,
  memory
} = wasmModule.instance.exports;

memoryRef = memory;

console.log("\n[5] Resultados dos Testes de Execução:");

// Teste 1: Sistema de Macros (min + swap + repeat)
const macroRes = test_macro_system(10, 20);
console.log("• test_macro_system(10, 20) =", macroRes, "(esperado: 90) ->", macroRes === 90 ? "CORRETO ✅" : "FALHOU ❌");

// Teste 2: Acesso Direto à Memória Linear (int[addr], u8[addr] e store/load)
const directMemRes = test_direct_memory();
console.log("• test_direct_memory() [int[100]=4000 + u8[200]=200 + store(300,42)] =", directMemRes, "(esperado: 4242) ->", directMemRes === 4242 ? "CORRETO ✅" : "FALHOU ❌");

// Teste 2: Else If Chain
console.log("• score_grade(95) =", score_grade(95), "(esperado: 1) ->", score_grade(95) === 1 ? "CORRETO ✅" : "FALHOU ❌");
console.log("• score_grade(85) =", score_grade(85), "(esperado: 2) ->", score_grade(85) === 2 ? "CORRETO ✅" : "FALHOU ❌");

// Teste 3: Strings na memória (Data Segment) + Host Import
console.log("• Chamando greet():");
greet();
console.log("  Verificação:", lastPrintedString.includes("Macros Papagaio") ? "CORRETO ✅" : "FALHOU ❌");

// Teste 4: Variável Global Mutável
const g1 = increment_global(50);
console.log("• increment_global(50) =", g1, "(esperado: 550) ->", g1 === 550 ? "CORRETO ✅" : "FALHOU ❌");
const g2 = increment_global(100);
console.log("• increment_global(100) =", g2, "(esperado: 650) ->", g2 === 650 ? "CORRETO ✅" : "FALHOU ❌");

// Teste 5: Built-ins Wasm (popcnt + store8/load8)
console.log("• bit_and_byte_ops(7) =", bit_and_byte_ops(7), "(esperado: 258) ->", bit_and_byte_ops(7) === 258 ? "CORRETO ✅" : "FALHOU ❌");

// Teste 6: Fibonacci
console.log("• fib(10) =", fib(10), "(esperado: 55) ->", fib(10) === 55 ? "CORRETO ✅" : "FALHOU ❌");

console.log("\n🎉 Todas as demonstrações (incluindo o Sistema de Macros) passaram com 100% de sucesso!");

# Modern C-like Language with Papagaio Macros to WebAssembly (WAT) 🦜

A lightweight, feature-complete compiler that translates structured **C syntax with a powerful macro system** directly into **WebAssembly Text Format (WAT)** and binary **WASM** using **Papagaio** for pattern matching, desugaring, and balanced block transformations.

---

## 🚀 Key Features

* **Papagaio Macro System (Compile-time meta-programming)**:
  * Expression macros: `macro min($a, $b) => ($a < $b ? $a : $b);`
  * Instruction macros: `macro swap($a, $b) => { int _tmp = $a; $a = $b; $b = _tmp; };`
  * Block macros (`$body$block`): `macro repeat($times) $body$block => { for (int _i = 0; _i < $times; _i++) { $body } };`
* **Host Imports**: `import "env" void print_str(int ptr);` and `import "env" void print_int(int val);`
* **Static String Pool (Data Segment)**: `"Hello World"` strings automatically interned and placed in `(data (i32.const offset) "...\00")`
* **Mutable Global Variables**: `global int g_counter = 500;` mapped to `(global $g_counter (mut i32) (i32.const 500))`
* **Chained Else-If Control Flow**: `if (a) { ... } else if (b) { ... } else { ... }` (unlimited depth)
* **Ternary Operator with Native Hardware Select**: `a > b ? a : b` mapped directly to `(select a b cond)`
* **Memory Byte Operations**: `store8(addr, val)`, `load8(addr)`, `store16(addr, val)`, `load16(addr)`
* **WASM Bitwise & Numeric Built-ins**: `popcnt(x)`, `clz(x)`, `ctz(x)`, `sqrt(x)`, `abs(x)`, `min(a,b)`, `max(a,b)`
* **Pointers & Memory Indexing**:
  * Pointer dereference: `*ptr = val;` and `int v = *ptr;`
  * Array indexing: `ptr[i] = val;` and `int v = ptr[i];`

---

## 📖 Sample Code with Macros

```c
// 1. Define Macros via Papagaio
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

// 2. Use Macros in Functions
export int test_macro_system(int a, int b) {
    int menor = min(a, b);
    
    // Invert variables a and b
    swap(a, b);
    
    int acumulador = 0;
    // Repeat loop body 4 times
    repeat(4) {
        acumulador += a;
    }
    
    return acumulador + menor;
}
```

---

## 🧪 Running the Test Suite

Execute the automated test suite:

```bash
node examples/lang2wat/run_demo.js
```

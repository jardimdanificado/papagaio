# Papagaio
Minimal yet powerful text preprocessor with support for multi-character delimiters.

## Installation
```javascript
import { Papagaio } from './src/papagaio.js';
const p = new Papagaio();
const result = p.process(input);
```

## Configuration
```javascript
p.symbols = {
  pattern: "pattern",      // pattern keyword
  open: "{",               // opening delimiter (multi-char supported)
  close: "}",              // closing delimiter (multi-char supported)
  sigil: "$"               // variable marker
};
p.recursion_limit = 512;
```

---

## Core Concepts

### 1. Simple Variables
```
pattern {$x} {$x}
hello
```
Output: `hello`

### 2. Multiple Variables
```
pattern {$x $y $z} {$z, $y, $x}
apple banana cherry
```
Output: `cherry, banana, apple`

---

## Whitespace Operators

Papagaio provides flexible whitespace handling for variable capture.

### `$x` - Single Word Variable
Captures a single non-whitespace token.
```
pattern {$x} {[$x]}
hello world
```
Output: `[hello]`

### `$$x` - Whitespace-Sensitive Variable
Captures text including surrounding whitespace until the next significant token.
```
pattern {$$x world} {[$x]}
hello   world
```
Output: `[hello  ]`

### `$$$x` - Optional Whitespace Variable
Captures with optional whitespace (no error if empty).
```
pattern {$$$x world} {<$x>}
world
```
Output: `<>`

---

## Blocks

Capture content between delimiters with full nesting support.

### Syntax
```
$block varName {open}{close}
```

### Basic Example
```
pattern {$name $block content {(}{)}} {[$content]}
data (hello world)
```
Output: `[hello world]`

### Custom Delimiters
```
pattern {$block data {<<}{>>}} {DATA: $data}
<<json stuff>>
```
Output: `DATA: json stuff`

### Multi-Character Delimiters
```
pattern {$block code {```}{```}} {<pre>$code</pre>}
```markdown
# Title
```
Output: `<pre># Title</pre>`

### Multiple Blocks
```
pattern {$block a {(}{)}, $block b {[}{]}} {$a|$b}
(first), [second]
```
Output: `first|second`

### Nested Blocks
```
pattern {$block outer {(}{)}} {[$outer]}
(outer (inner))
```
Output: `[outer (inner)]`

---

## Patterns

### Basic Pattern
```
pattern {match} {replace}
```

### Example
```
pattern {# $title} {<h1>$title</h1>}
# Welcome
```
Output: `<h1>Welcome</h1>`

### Multiple Patterns Cascade
```
pattern {a} {b}
pattern {b} {c}
pattern {c} {d}
a
```
Output: `d`

---

## Subpatterns

Subpatterns are patterns declared *inside* replacement bodies, existing only during parent pattern execution.

### Syntax
```
$pattern {match} {replace}
```

### Example
```
pattern {eval $block code {(}{)}} {
  $eval{
    $pattern {undefined} {}
    $code;
    return "";
  }
}
eval(console.log(123))
```
Output:
```
123
```

### Key Properties
* Subpatterns exist only within the running pattern.
* They do not leak into the global pattern list.
* They can recursively modify inner content before `$eval` or other processors.
* Multiple subpatterns can coexist in the same replacement.

---

## Special Keywords

### $eval
Executes JavaScript code.
```
pattern {$x} {$eval{return parseInt($x)*2;}}
5
```
Output: `10`

Supports multi-character delimiters:
```
pattern {$x} {$eval<<parseInt($x)*2>>}
5
```
Output: `10`


## Important Rules

### Matching
* `$x` = one word (no whitespace)
* `$$x` = captures text with optional surrounding whitespace
* `$$$x` = captures text with optional surrounding whitespace, can be empty or not found
* Patterns apply globally until stable
* Blocks support arbitrary nesting depth

### Block Matching
* `$block name {open}{close}` captures delimited regions
* Supports nested delimiters of any length
* Multi-character delimiters fully supported (e.g., `{>>>}{<<<}`)

### Whitespace Handling
* Whitespace-optional tokens (`$$` alone) skip optional whitespace
* Variables automatically skip leading whitespace when needed
* Trailing whitespace is trimmed when variables appear before literals

---

## Multi-Character Delimiter Support

The updated version fully supports multi-character delimiters throughout all features.

### Examples
```javascript
const p = new Papagaio('$', '<<<', '>>>');
```

### In Blocks
```
pattern {$block data {<<}{>>}} {$data}
<<content>>
```

### In Eval
```
// const p = new Papagaio('$', '<<<', '>>>');
pattern <<<$x>>> <<<$eval<<<return $x + 1>>>>>>
5
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Variable not captured | Check spacing and use appropriate whitespace operator (`$x`, `$$x`, `$$$x`) |
| Block mismatch | Verify opening and closing delimiters match the declaration |
| Infinite recursion | Reduce `recursion_limit` or simplify pattern dependencies |
| Pattern not matching | Add whitespace operators (`$$`) for multi-word content |
| Nested blocks fail | Ensure delimiters are properly balanced |
| Multi-char delimiters broken | Check delimiters don't conflict; use escaping if needed |

---

## Syntax Reference

```
pattern {$x $y} {$y, $x}           # basic pattern with variables
pattern {$$x $y} {$y, $x}          # whitespace-sensitive capture
pattern {$$$x $y} {$y, $x}         # optional whitespace capture
pattern {$block n {o}{c}} {$n}     # block capture with custom delimiters
$pattern {a} {b}                   # subpattern (scoped to parent)
$eval{code}                        # JavaScript evaluation
```

---

## Performance Notes

* Patterns apply recursively until no changes occur (up to `recursion_limit`)
* Multi-character delimiter matching is optimized with regex escaping
* Nested blocks and subpatterns have no theoretical depth limit
* Large recursion limits can impact performance on complex inputs
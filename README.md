# Papagaio
Minimal yet powerful text preprocessor with support for multi-character delimiters.

## Installation
```javascript
import { Papagaio } from './src/papagaio.js';
const papagaio = new Papagaio();
const result = papagaio.process(input);
```

## Configuration
```javascript
papagaio.symbols = {
  pattern: "pattern",      // pattern keyword
  open: "{",               // opening delimiter (multi-char supported)
  close: "}",              // closing delimiter (multi-char supported)
  sigil: "$",              // variable marker
  eval: "eval",            // eval keyword
  block: "block",          // block keyword
  regex: "regex"           // regex keyword
};
papagaio.recursion_limit = 512;
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

## Variables

Papagaio provides flexible variable capture with automatic context-aware behavior.

### `$x` - Smart Variable
Automatically adapts based on context:
- **Before a block**: Captures everything until the block's opening delimiter
- **Before a literal**: Captures everything until that literal appears
- **Otherwise**: Captures a single word (non-whitespace token)

```
pattern {$x} {[$x]}
hello world
```
Output: `[hello]`

```
pattern {$name $block content {(}{)}} {$name: $content}
greeting (hello world)
```
Output: `greeting: hello world`

```
pattern {$prefix:$suffix} {$suffix-$prefix}
key:value
```
Output: `value-key`

### `$x?` - Optional Variable
Same behavior as `$x`, but won't fail if empty or not found.

```
pattern {$x? world} {<$x>}
world
```
Output: `<>`

```
pattern {$greeting? $name} {Hello $name$greeting}
Hi John
```
Output: `Hello JohnHi`

---

## Regex Matching

Capture content using JavaScript regular expressions.

### Syntax
```
$regex varName {pattern}
```

### Basic Example
```
pattern {$regex num {[0-9]+}} {Number: $num}
The answer is 42
```
Output: `Number: 42`

### Complex Patterns
```
pattern {$regex email {\w+@\w+\.\w+}} {Email found: $email}
Contact: user@example.com
```
Output: `Email found: user@example.com`

### Multiple Regex Variables
```
pattern {$regex year {[0-9]{4}}-$regex month {[0-9]{2}}} {Month $month in $year}
2024-03
```
Output: `Month 03 in 2024`

### Notes
- Regex patterns are cached for performance
- Matches are anchored at the current position (no searching ahead)
- Invalid regex patterns will cause the match to fail gracefully

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

---

## Important Rules

### Variable Matching
* `$x` = smart capture (context-aware: word, until literal, or until block)
* `$x?` = optional version of `$x` (won't fail if empty)
* `$regex name {pattern}` = regex-based capture
* Patterns apply globally until stable
* Blocks support arbitrary nesting depth

### Block Matching
* `$block name {open}{close}` captures delimited regions
* Supports nested delimiters of any length
* Multi-character delimiters fully supported (e.g., `{>>>}{<<<}`)

### Whitespace Handling
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
| Variable not captured | Check context: use `$x?` for optional, or verify literals/blocks exist |
| Block mismatch | Verify opening and closing delimiters match the declaration |
| Infinite recursion | Reduce `recursion_limit` or simplify pattern dependencies |
| Pattern not matching | Verify whitespace between tokens, check if variable should be optional |
| Nested blocks fail | Ensure delimiters are properly balanced |
| Multi-char delimiters broken | Check delimiters don't conflict; use escaping if needed |
| Regex not matching | Test regex pattern separately; ensure it matches at the exact position |

---

## Syntax Reference

```
pattern {$x $y} {$y, $x}           # basic pattern with variables
pattern {$x? $y} {$y, $x}          # optional variable
pattern {$regex n {[0-9]+}} {$n}   # regex capture
pattern {$block n {o}{c}} {$n}     # block capture with custom delimiters
$pattern {a} {b}                   # subpattern (scoped to parent)
$eval{code}                        # JavaScript evaluation
```

---

## Performance Notes

* Patterns apply recursively until no changes occur (up to `recursion_limit`)
* Multi-character delimiter matching is optimized with regex escaping
* Regex patterns are automatically cached to improve performance
* Nested blocks and subpatterns have no theoretical depth limit
* Large recursion limits can impact performance on complex inputs
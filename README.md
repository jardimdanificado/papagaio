# Papagaio

Minimal yet powerful text preprocessor.

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
  open: "{",               // opening delimiter
  close: "}",              // closing delimiter
  sigil: "$"               // variable marker
};

p.recursion_limit = 512;
p.unique_id = 0;
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

## Blocks

Capture content between delimiters.

### Syntax

```
$block name {open}{close}
```

### Example

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

### Multiple Blocks

```
pattern {$block a {(}{)}, $block b {[}{]}} {$a|$b}
(first), [second]
```

Output: `first|second`

---

## Patterns

### Basic

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

# Subpatterns

Subpatterns allow patterns to be declared *inside* other patterns, existing only during the execution of that parent pattern.

### Syntax

```
$pattern {match} {replace}
```

A subpattern behaves like a normal pattern but is **scoped only to the replacement body where it appears**.

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
* They can recursively modify inner content before `$eval` or other processors handle it.
* Multiple subpatterns can coexist inside the same replacement.

---

## Special Keywords

### $unique

Generates unique incremental IDs.

```
pattern {item} {[$unique]item_$unique}
item
item
```

Outputs:

```
[0]item_0
[1]item_1
```

### $match

Full matched text.

```
pattern {[$x]} {FOUND: $match}
[data]
```

Output: `FOUND: [data]`

### $prefix / $suffix

Text before and after match.

```
pattern {world} {$prefix$suffix}hello world test
```

Output: `hello hello  test test`

### $clear

Removes everything before match.

```
pattern {SKIP $x} {$clear KEEP: $x}
IGNORE SKIP keep
```

Output: `KEEP: keep`

### $eval

Executes JS.

```
pattern {$x} {$eval{return parseInt($x)*2;}}
5
```

Output: `10`

---

## Important Rules

### Matching

* `$x` = one word
* `$$x` = multiword (captures whitespace too)
* `$`, `$$`, `$$$`, `$$$$` = whitespace operators
* Patterns apply globally until stable
* Blocks can be nested

### Block Matching

* `$block name {open}{close}` captures delimited regions
* Supports nested delimiters

---

## Troubleshooting

| Problem               | Solution                   |
| --------------------- | -------------------------- |
| Variable not captured | Check spacing              |
| Block wrong           | Verify delimiters          |
| Infinite recursion    | Reduce recursion limit     |
| Pattern not matching  | Add whitespace operators   |
| Multiword var issues  | Beware whitespace consumed |

---

## Known Bugs

* Multi-character delimiters containing `"` break nested parsing.

---

## Syntax Reference

```
pattern {$x $y} {$y, $x}
pattern {$block n {o}{c}} {$n}
$pattern {a} {b}       # subpattern
$unique
$match
$prefix / $suffix
$clear
$eval{code}
```

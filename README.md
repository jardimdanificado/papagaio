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
p.open = "{";           // opening delimiter
p.close = "}";          // closing delimiter
p.sigil = "$";          // variable marker
p.maxRecursion = 512;   // iteration limit
```

---

## Core Concepts

### 1. Simple Variables

```
pattern {$x} {$x}
hello
```
Output: `hello`

Variables capture words (non-whitespace sequences).

### 2. Multiple Variables

```
pattern {$x $y $z} {$z, $y, $x}
apple banana cherry
```
Output: `cherry, banana, apple`

### 3. Flexible Whitespace (`$$`)

```
pattern {$x$$and$$$y} {$x & $y}
hello   and   world
hello and world
```
Output: `hello & world` (both)

`$$` = zero or more spaces/tabs/newlines.

## Blocks

Capture content between delimiters.

### Syntax

```
$block name {open}{close}
```

### Example

```
pattern {$block content {(}{)}} {[$content]}
data ( hello world )
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

### Real Example

```
pattern {# $title} {<h1>$title</h1>}
# Welcome
```
Output: `<h1>Welcome</h1>`

### Multiple Patterns

```
pattern {a} {b}
pattern {b} {c}
pattern {c} {d}
a
```
Output: `d` (automatic cascade)

---

## Contexts

Recursive processing scope.

```
context {
  pattern {$x} {<$x>}
  
  apple
  banana
}
```
Output:
```
<apple>
<banana>
```

**Empty contexts are automatically removed.**

---

## Special Keywords

### $unique
Generate unique incremental IDs for each pattern call.

```
pattern {item} {item_$unique}
item
item
item
```
Output: `item_u0`, `item_u1`, `item_u2`

### $match
Return the full match.

```
pattern {[$x]} {FOUND: $match}
[data]
```
Output: `FOUND: [data]`

### $prefix / $suffix
Text before and after the match.

```
pattern {$x} {BEFORE:$prefix | AFTER:$suffix}
hello world test
```
Output: `BEFORE: | AFTER: world test`

### $clear
Remove everything before the match.

```
pattern {SKIP $x} {$clear KEEP: $x}
IGNORE_THIS SKIP keep_this
```
Output: `KEEP: keep_this`

### $eval
Execute JavaScript code.

```
pattern {$x} {$eval{return parseInt($x) * 2;}}
5
```
Output: `10`

---

## Practical Examples

### Markdown → HTML

```
context {
  pattern {# $t} {<h1>$t</h1>}
  pattern {## $t} {<h2>$t</h2>}
  pattern {**$t**} {<strong>$t</strong>}
  pattern {*$t*} {<em>$t</em>}
  pattern {- $i} {<li>$i</li>}
  
  # Title
  **bold** and *italic*
  - item1
  - item2
}
```

### CSV → JSON

```
pattern {$a,$b,$c} {{ id: '$a', name: '$b', role: '$c' }}
1,Alice,Engineer
2,Bob,Designer
```

Output:
```
{ id: '1', name: 'Alice', role: 'Engineer' }
{ id: '2', name: 'Bob', role: 'Designer' }
```

### Config Parser

```
pattern {$key = $value} {const $key = '$value';}
host = localhost
port = 3000
```

Output:
```
const host = 'localhost';
const port = '3000';
```

### HTML Generator

```
pattern {$tag $content} {<$tag>$content</$tag>}
div HelloWorld
span Test
```

Output:
```
<div>HelloWorld</div>
<span>Test</span>
```

---

## Important Rules

### Matching
- Variables (`$x`) capture **one word** (no spaces)
- `$$` = flexible whitespace (0+ spaces/tabs/newlines)
- Patterns apply **globally** each iteration
- Auto-recursion until: max 512 iterations OR no changes

### Block Matching
- `$block name {open}{close}` captures between delimiters
- Supports nested delimiters automatically
- Multiple blocks in one pattern work

### Variables
- Names: `[A-Za-z0-9_]`
- Reuse: `$x` appears multiple times in replace
- Undefined: becomes empty string

### Sigil
- You cannot match words containing the sigil character.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Pattern doesn't match | Use `$$` between elements for flexible whitespace |
| Variable not captured | Check space between variables |
| Block not working | Verify balanced delimiters `{` `}` |
| Infinite recursion | Use `$clear` or reduce `maxRecursion` |
| $eval not working | Errors return empty string, use try-catch |

## Known Bugs

- Multi-character block delimiters that contains double quotes doesnt match properly.

---

## Syntax Reference

```
pattern {$x $y} {$y, $x}               # basic pattern
pattern {$x$$y} {$x-$y}                # flexible whitespace
pattern {$block n {o}{c}} {$n}         # block
context { ... }                        # recursive scope
$unique                                # unique ID
$match                                 # full match
$prefix / $suffix                      # before/after
$clear                                 # clear before
$eval{code}                            # execute JS
```

---

## Complete Example

```
context {
  # Markdown headers
  pattern {# $title} {<h1>$title</h1>}
  
  # Lists
  pattern {- $item} {<li>$item</li>}
  
  # Inline formatting
  pattern {**$text**} {<strong>$text</strong>}
  pattern {*$text*} {<em>$text</em>}
  
  # Process content
  # Welcome
  # Getting Started
  This is **important** and *italic*
  - First item
  - Second item
}
```

Output:
```html
<h1>Welcome</h1>
<h2>Getting Started</h2>
This is <strong>important</strong> and <em>italic</em>
<li>First item</li>
<li>Second item</li>
```

---
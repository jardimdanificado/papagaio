# Papagaio
Minimal yet powerful text preprocessor.

- **It's portable!** papagaio requires only ES6 and nothing else.
- **It's small!** papagaio is around ~250 lines and ~10kb.
- **It's easy!** papagaio doesnt have any complicated stuff, 1 class and 1 method for doing everything!
- **It's flexible!** do papagaio sigil and delimiters conflict with whatever you want to process? then simply change it! papagaio allow us to modify ANY of its keywords and symbols.
- **It's powerful!!** aside been inspired by the m4 preprocessor and meant to be a preprocessor, papagaio still a fully-featured programming language because it can evaluate any valid javascript code using $eval;

## Installation
```javascript
import { Papagaio } from './papagaio.js';
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
  block: "recursive",      // block keyword (recursive nesting)
  regex: "regex",          // regex keyword
  blockseq: "sequential"   // blockseq keyword (sequential blocks)
};
```

---

## Core Concepts

### 1. Simple Variables
```
$pattern {$x} {$x}
hello
```
Output: `hello`

### 2. Multiple Variables
```
$pattern {$x $y $z} {$z, $y, $x}
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
$pattern {$x} {[$x]}
hello world
```
Output: `[hello] [world]`

```
$pattern {$name ${(}{)}content} {$name: $content}
greeting (hello world)
```
Output: `greeting: hello world`

```
$pattern {$prefix:$suffix} {$suffix-$prefix}
key:value
```
Output: `value-key`

### `$x?` - Optional Variable
Same behavior as `$x`, but won't fail if empty or not found.

```
$pattern {$x? world} {<$x>}
world
```
Output: `<>`

```
$pattern {$greeting? $name} {Hello $name$greeting}
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
$pattern {$regex num {[0-9]+}} {Number: $num}
The answer is 42
```
Output: `Number: 42`

### Complex Patterns
```
$pattern {$regex email {\w+@\w+\.\w+}} {Email found: $email}
Contact: user@example.com
```
Output: `Email found: user@example.com`

### Multiple Regex Variables
```
$pattern {$regex year {[0-9]{4}}-$regex month {[0-9]{2}}} {Month $month in $year}
2024-03
```
Output: `Month 03 in 2024`

---

## Blocks

Papagaio supports two types of block capture: **nested** and **adjacent**.

### Nested Blocks - `${open}{close}varName`

Captures content between delimiters with full nesting support. Nested delimiters are handled recursively.

#### Basic Syntax
```
${opening_delimiter}{closing_delimiter}varName
```

#### Examples

**Basic Recursive Block:**
```
$pattern {$name ${(}{)}content} {[$content]}
data (hello world)
```
Output: `[hello world]`

**Custom Delimiters:**
```
$pattern {${<<}{>>}data} {DATA: $data}
<<json stuff>>
```
Output: `DATA: json stuff`

**Multi-Character Delimiters:**
```
$pattern {${```}{```}code} {<pre>$code</pre>}
```markdown
# Title
```
Output: `<pre># Title</pre>`

**Default Delimiters (empty blocks):**
```
$pattern {${}{}data} {[$data]}
{hello world}
```
Output: `[hello world]`
*(Uses default `{` and `}` when delimiters are empty)*

**Nested Blocks:**
```
$pattern {${(}{)}outer} {[$outer]}
(outer (inner (deep)))
```
Output: `[outer (inner (deep))]`

### Adjancent Blocks - `$${open}{close}varName`

Captures multiple adjacent blocks with the same delimiters and concatenates their content (separated by spaces).

#### Basic Syntax
```
$${opening_delimiter}{closing_delimiter}varName
```

#### Examples

**Basic Adjacent Block:**
```
$pattern {$${[}{]}items} {Items: $items}
[first][second][third]
```
Output: `Items: first second third`

**Adjacent with Custom Delimiters:**
```
$pattern {$${<}{>}tags} {Tags: $tags}
<html><body><div>
```
Output: `Tags: html body div`

**Default Delimiters:**
```
$pattern {$${}{}data} {Result: $data}
{a}{b}{c}
```
Output: `Result: a b c`

**Mixed Usage:**
```
$pattern {${(}{)}nested, $${[}{]}seq} {Nested: $nested | Seq: $seq}
(a (b c)), [x][y][z]
```
Output: `Nested: a (b c) | Seq: x y z`

### Block Comparison

| Feature | Nested `${}{}var` | Adjacent `$${}{}var` |
|---------|---------------------|------------------------|
| Purpose | Capture nested content | Capture adjacent blocks |
| Input | `[a [b [c]]]` | `[a][b][c]` |
| Output | `a [b [c]]` | `a b c` |
| Nesting | Handled recursively | Not nested, sequential |
| Spacing | Preserves internal structure | Joins with spaces |

---

## Pattern Scopes

Patterns defined within a replacement body create nested scopes with hierarchical inheritance.

### Basic Pattern
```
$pattern {hello} {world}
hello
```
Output: `world`

**Key Properties:**
* Patterns are scoped to their context
* Child patterns inherit parent patterns
* Patterns do not persist between `process()` calls
* Perfect for hierarchical transformations

### Nested Patterns with Inheritance
```
$pattern {outer $x} {
  $pattern {inner $y} {[$y from $x]}
  inner $x
}
outer hello
```
Output: `[hello from hello]`

The inner pattern has access to `$x` from the outer pattern's capture.

### Deep Nesting
```
$pattern {level1 $a} {
  $pattern {level2 $b} {
    $pattern {level3 $c} {$a > $b > $c}
    level3 $b
  }
  level2 $a
}
level1 ROOT
```
Output: `ROOT > ROOT > ROOT`

Each nested level inherits all patterns from parent scopes.

### Sibling Scopes Don't Share
```
$pattern {branch1} {
  $pattern {x} {A}
  x
}
$pattern {branch2} {
  x
}
branch1
branch2
```
Output:
```
A
x
```

Patterns in `branch1` are not available in `branch2` (they are siblings, not parent-child).

---

## Special Keywords

### $eval
Executes JavaScript code with access to the Papagaio instance.

```
$pattern {$x} {$eval{return parseInt($x)*2;}}
5
```
Output: `10`

**Accessing Papagaio Instance:**
```
$pattern {info} {$eval{
  return `Content length: ${papagaio.content.length}`;
}}
info
```

**Multi-character delimiters:**
```
$pattern {$x} {$eval<<parseInt($x)*2>>}
5
```
Output: `10`

---

## Important Rules

### Variable Matching
* `$x` = smart capture (context-aware: word, until literal, or until block)
* `$x?` = optional version of `$x` (won't fail if empty)
* `$regex name {pattern}` = regex-based capture
* Variables automatically skip leading whitespace
* Trailing whitespace is trimmed when variables appear before literals

### Block Matching
* `${open}{close}name` = nested block capture
* `$${open}{close}name` = adjacent block capture (captures adjacent blocks)
* Supports multi-character delimiters of any length
* Empty delimiters `${}{}name` or `$${}{}name` use defaults from `symbols.open` and `symbols.close`
* Sequential blocks are joined with spaces in the captured variable

### Pattern Matching
* `$pattern {match} {replace}` = pattern scoped to current context
* Patterns inherit from parent scopes hierarchically
* Each `process()` call starts with a clean slate (no persistence)

---

## Multi-Character Delimiter Support

Papagaio fully supports multi-character delimiters throughout all features.

### Configuration
```javascript
const p = new Papagaio('$', '<<<', '>>>');
```

### In Patterns
```
$pattern<<<$x>>> <<<[$x]>>>
hello
```
Output: `[hello]`

### In Blocks
```
$pattern<<<${<<}{>>}data>>> <<<$data>>>
<<content>>
```
Output: `content`

### In Eval
```
$pattern<<<$x>>> <<<$eval<<<return $x + 1>>>>>>
5
```
Output: `6`

---

## Advanced Examples

### Markdown-like Processor
```javascript
const p = new Papagaio();
const template = `
$pattern {# $title} {<h1>$title</h1>}
$pattern {## $title} {<h2>$title</h2>}
$pattern {**$text**} {<strong>$text</strong>}

# Hello World
## Subtitle
**bold text**
`;

p.process(template);
// Output:
// <h1>Hello World</h1>
// <h2>Subtitle</h2>
// <strong>bold text</strong>
```

### Array/List Processor
```javascript
const p = new Papagaio();
const template = `
$pattern {$${[}{]}items} {
  $eval{
    const arr = '$items'.split(' ');
    return arr.map((x, i) => \`\${i + 1}. \${x}\`).join('\\n');
  }
}

[apple][banana][cherry]
`;

p.process(template);
// Output:
// 1. apple
// 2. banana
// 3. cherry
```

### Template System with State
```javascript
const p = new Papagaio();
p.vars = {}; // Custom property for storing variables

const template = `
$pattern {var $name = $value} {$eval{
  papagaio.vars['$name'] = '$value';
  return '';
}}
$pattern {get $name} {$eval{
  return papagaio.vars['$name'] || 'undefined';
}}

var title = My Page
var author = John Doe
Title: get title
Author: get author
`;

p.process(template);
// Output:
// Title: My Page
// Author: John Doe
```

### Conditional Processing
```javascript
const p = new Papagaio();
const template = `
$pattern {if ${(}{)}cond then ${[}{]}yes else ${<}{>}no} {
  $eval{
    const condition = ($cond).trim();
    return condition === 'true' ? '$yes' : '$no';
  }
}

if (true) then [yes branch] else <no branch>
if (false) then [yes branch] else <no branch>
`;

p.process(template);
// Output:
// yes branch
// no branch
```

### Function-like Patterns
```javascript
const p = new Papagaio();
const template = `
$pattern {double $x} {$eval{return parseInt('$x') * 2}}
$pattern {add $x $y} {$eval{return parseInt('$x') + parseInt('$y')}}

double 5
add 3 7
add (double 4) 10
`;

p.process(template);
// Output:
// 10
// 10
// 18
```

### Sequential Block Processing
```javascript
const p = new Papagaio();
const template = `
$pattern {sum $${[}{]}nums} {
  $eval{
    const numbers = '$nums'.split(' ').map(x => parseInt(x));
    return numbers.reduce((a, b) => a + b, 0);
  }
}

sum [10][20][30][40]
`;

p.process(template);
// Output: 100
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Variable not captured | Check context: use `$x?` for optional, or verify literals/blocks exist |
| Block mismatch | Verify opening and closing delimiters match the declaration |
| Infinite recursion | Pattern creates circular transformation; redesign pattern logic |
| Pattern not matching | Verify whitespace between tokens, check if variable should be optional |
| Pattern not available | Check scope hierarchy; patterns only inherit from parents, not siblings |
| Nested blocks fail | Ensure delimiters are properly balanced |
| Multi-char delimiters broken | Check delimiters don't conflict; use escaping if needed |
| Regex not matching | Test regex pattern separately; ensure it matches at the exact position |
| Empty delimiter behavior | `${}{}x` uses defaults; explicitly set if you need different behavior |

---

## Syntax Reference

```
$pattern {$x $y} {$y, $x}            # pattern with variables
$pattern {$x? $y} {$y, $x}           # optional variable
$pattern {$regex n {[0-9]+}} {$n}    # regex capture
$pattern {${o}{c}n} {$n}             # recursive block (nested)
$pattern {$${o}{c}n} {$n}            # sequential block (adjacent)
$pattern {${}{}n} {$n}               # block with default delimiters
$eval{code}                          # JavaScript evaluation
```

---

## API Reference

### Constructor
```javascript
new Papagaio(sigil, open, close, pattern, evalKw, blockKw, regexKw, blockseqKw)
```

**Parameters:**
- `sigil` (default: `'$'`) - Variable prefix
- `open` (default: `'{'`) - Opening delimiter
- `close` (default: `'}'`) - Closing delimiter
- `pattern` (default: `'pattern'`) - Pattern keyword
- `evalKw` (default: `'eval'`) - Eval keyword
- `regexKw` (default: `'regex'`) - Regex keyword

### Properties
- `papagaio.content` - Last processed output
- `papagaio.match` - Last matched substring (available in replacements)
- `papagaio.symbols` - Configuration object
- `papagaio.exit` - Optional hook function called after processing

### Methods
- `papagaio.process(input)` - Process input text and return transformed output

### Exit Hook
```javascript
const p = new Papagaio();
p.exit = function() {
  console.log('Processing complete:', this.content);
};
p.process('$pattern {x} {y}\nx');
```

---

## Performance Notes

* Multi-character delimiter matching is optimized with substring operations
* Sequential blocks scan for adjacent matches without recursion overhead
* Nested patterns inherit parent patterns through recursive application
* Nested blocks and patterns have no theoretical depth limit
* Large recursion limits can impact performance on complex inputs
* Each `process()` call is independent with no persistent state between calls

---

***PAPAGAIO IS CURRENTLY IN HEAVY DEVELOPMENT AND EXPERIMENTATION PHASE***
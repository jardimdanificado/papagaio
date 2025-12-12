# Papagaio
Minimal yet powerful text preprocessor with support for multi-character delimiters and scoped patterns.

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
Output: `[hello]`

```
$pattern {$name $block content {(}{)}} {$name: $content}
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
$pattern {$name $block content {(}{)}} {[$content]}
data (hello world)
```
Output: `[hello world]`

### Custom Delimiters
```
$pattern {$block data {<<}{>>}} {DATA: $data}
<<json stuff>>
```
Output: `DATA: json stuff`

### Multi-Character Delimiters
```
$pattern {$block code {```}{```}} {<pre>$code</pre>}
```markdown
# Title
```
Output: `<pre># Title</pre>`

### Multiple Blocks
```
$pattern {$block a {(}{)}, $block b {[}{]}} {$a|$b}
(first), [second]
```
Output: `first|second`

### Nested Blocks
```
$pattern {$block outer {(}{)}} {[$outer]}
(outer (inner))
```
Output: `[outer (inner)]`

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

### Pattern Matching
* `$pattern {match} {replace}` = pattern scoped to current context
* Patterns inherit from parent scopes hierarchically
* Each `process()` call starts with a clean slate (no persistence)

### Block Matching
* `$block name {open}{close}` captures delimited regions
* Supports nested delimiters of any length
* Multi-character delimiters fully supported (e.g., `{>>>}{<<<}`)
* Blocks support arbitrary nesting depth

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
$pattern<<<$block data {<<}{>>}>>> <<<$data>>>
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
$pattern {if $block cond {(}{)} then $block yes {[}{]} else $block no {<}{>}} {
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

---

## Syntax Reference

```
$pattern {$x $y} {$y, $x}            # pattern with variables
$pattern {$x? $y} {$y, $x}           # optional variable
$pattern {$regex n {[0-9]+}} {$n}    # regex capture
$pattern {$block n {o}{c}} {$n}      # block capture with custom delimiters
$eval{code}                          # JavaScript evaluation
```

---

## API Reference

### Constructor
```javascript
new Papagaio(sigil, open, close, pattern, evalKw, blockKw, regexKw)
```

**Parameters:**
- `sigil` (default: `'$'`) - Variable prefix
- `open` (default: `'{'`) - Opening delimiter
- `close` (default: `'}'`) - Closing delimiter
- `pattern` (default: `'pattern'`) - Pattern keyword
- `evalKw` (default: `'eval'`) - Eval keyword
- `blockKw` (default: `'block'`) - Block keyword
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
* Nested patterns inherit parent patterns through recursive application
* Nested blocks and patterns have no theoretical depth limit
* Large recursion limits can impact performance on complex inputs
* Each `process()` call is independent with no persistent state between calls

---

## Key Differences from Other Preprocessors

1. **Hierarchical Scoping**: Patterns automatically inherit from parent contexts
2. **No Global State**: Each `process()` call is independent (unless you use custom properties)
3. **Smart Variable Capture**: Variables adapt their behavior based on what comes next
4. **Multi-Character Everything**: All delimiters support multiple characters
5. **Eval Integration**: Direct JavaScript execution with full access to the processor instance

***PAPAGAIO IS CURRENTLY IN HEAVY DEVELOPMENT AND EXPERIMENTATION PHASE***
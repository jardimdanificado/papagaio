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
  local: "local",          // local pattern keyword
  global: "global",        // global pattern keyword
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
$local {$x} {$x}
hello
```
Output: `hello`

### 2. Multiple Variables
```
$local {$x $y $z} {$z, $y, $x}
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
$local {$x} {[$x]}
hello world
```
Output: `[hello]`

```
$local {$name $block content {(}{)}} {$name: $content}
greeting (hello world)
```
Output: `greeting: hello world`

```
$local {$prefix:$suffix} {$suffix-$prefix}
key:value
```
Output: `value-key`

### `$x?` - Optional Variable
Same behavior as `$x`, but won't fail if empty or not found.

```
$local {$x? world} {<$x>}
world
```
Output: `<>`

```
$local {$greeting? $name} {Hello $name$greeting}
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
$local {$regex num {[0-9]+}} {Number: $num}
The answer is 42
```
Output: `Number: 42`

### Complex Patterns
```
$local {$regex email {\w+@\w+\.\w+}} {Email found: $email}
Contact: user@example.com
```
Output: `Email found: user@example.com`

### Multiple Regex Variables
```
$local {$regex year {[0-9]{4}}-$regex month {[0-9]{2}}} {Month $month in $year}
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
$local {$name $block content {(}{)}} {[$content]}
data (hello world)
```
Output: `[hello world]`

### Custom Delimiters
```
$local {$block data {<<}{>>}} {DATA: $data}
<<json stuff>>
```
Output: `DATA: json stuff`

### Multi-Character Delimiters
```
$local {$block code {```}{```}} {<pre>$code</pre>}
```markdown
# Title
```
Output: `<pre># Title</pre>`

### Multiple Blocks
```
$local {$block a {(}{)}, $block b {[}{]}} {$a|$b}
(first), [second]
```
Output: `first|second`

### Nested Blocks
```
$local {$block outer {(}{)}} {[$outer]}
(outer (inner))
```
Output: `[outer (inner)]`

---

## Pattern Scopes

Papagaio supports two types of pattern scopes: **local** and **global**.

### `$local` - Local Patterns
Patterns that exist only within the current processing context. They are discarded after the parent pattern completes.

```
$local {hello} {world}
hello
```
Output: `world`

**Key Properties:**
* Exists only during the current `process()` call
* Does not persist between calls
* Perfect for temporary transformations
* Does not pollute the global pattern namespace

### `$global` - Global Patterns
Patterns that persist across multiple `process()` calls and are available everywhere.

```
$global {hello} {world}
```

Once defined, this pattern remains active:
```javascript
const p = new Papagaio();
p.process('$global{hello}{world}');
p.process('hello'); // Output: "world"
p.process('Say hello'); // Output: "Say world"
```

**Key Properties:**
* Persists across `process()` calls
* Available to all subsequent transformations
* Stored in `papagaio.globalPatterns`
* Can be redefined or extended at any time

### Combining Local and Global

```
$global {greeting} {Hello}

$local {$name} {greeting $name!}
World
```

First call output: `Hello World!`

```
User
```

Second call output: `Hello User!` (global pattern still active)

---

## Nested Patterns

Patterns declared inside replacement bodies can be either local or global.

### Local Nested Pattern
```
$local {transform $x} {
  $local {$x} {[$x]}
  $x $x $x
}
transform hello
```
Output: `[hello] [hello] [hello]`

### Global Nested Pattern
```
$local {setup} {
  $global {x} {expanded_x}
  Setup complete
}
setup
x
```
Output: 
```
Setup complete
expanded_x
```

### Mixed Scopes
```
$local {init} {
  $local {temp} {temporary}
  $global {perm} {permanent}
  temp perm
}
init
temp perm
```
Output:
```
temporary permanent
permanent perm
```
(Note: `temp` is not available in the second line)

---

## Special Keywords

### $eval
Executes JavaScript code with access to the Papagaio instance.

```
$local {$x} {$eval{return parseInt($x)*2;}}
5
```
Output: `10`

**Accessing Papagaio Instance:**
```
$local {info} {$eval{
  return `Globals: ${papagaio.globalPatterns.length}`;
}}
info
```

**Multi-character delimiters:**
```
$local {$x} {$eval<<parseInt($x)*2>>}
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
* `$local {match} {replace}` = pattern scoped to current context
* `$global {match} {replace}` = pattern that persists across calls
* Patterns apply recursively until stable (up to `recursion_limit`)
* Global patterns are always applied after local patterns

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
$local<<<$x>>> <<<[$x]>>>
hello
```
Output: `[hello]`

### In Blocks
```
$local<<<$block data {<<}{>>}>>> <<<$data>>>
<<content>>
```
Output: `content`

### In Eval
```
$local<<<$x>>> <<<$eval<<<return $x + 1>>>>>>
5
```
Output: `6`

---

## Advanced Examples

### Markdown-like Processor
```javascript
const p = new Papagaio();
p.process(`
$global {# $title} {<h1>$title</h1>}
$global {## $title} {<h2>$title</h2>}
$global {**$text**} {<strong>$text</strong>}
`);

p.process('# Hello World');      // <h1>Hello World</h1>
p.process('## Subtitle');         // <h2>Subtitle</h2>
p.process('**bold text**');       // <strong>bold text</strong>
```

### Template System
```javascript
const p = new Papagaio();
p.process(`
$global {var $name = $value} {$eval{
  papagaio.vars = papagaio.vars || {};
  papagaio.vars['$name'] = '$value';
  return '';
}}
$global {get $name} {$eval{
  return papagaio.vars?.['$name'] || 'undefined';
}}
`);

p.process('var title = My Page');
p.process('get title');  // Output: "My Page"
```

### Conditional Processing
```javascript
const p = new Papagaio();
p.process(`
$global {if $block cond {(}{)} then $block yes {[}{]} else $block no {<}{>}} {
  $eval{
    const condition = ($cond).trim();
    return condition === 'true' ? '$yes' : '$no';
  }
}
`);

p.process('if (true) then [yes branch] else <no branch>');
// Output: "yes branch"
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Variable not captured | Check context: use `$x?` for optional, or verify literals/blocks exist |
| Block mismatch | Verify opening and closing delimiters match the declaration |
| Infinite recursion | Reduce `recursion_limit` or simplify pattern dependencies |
| Pattern not matching | Verify whitespace between tokens, check if variable should be optional |
| Global pattern not persisting | Ensure using `$global` not `$local` |
| Pattern conflicts | Check order of global patterns; newer patterns apply after older ones |
| Nested blocks fail | Ensure delimiters are properly balanced |
| Multi-char delimiters broken | Check delimiters don't conflict; use escaping if needed |
| Regex not matching | Test regex pattern separately; ensure it matches at the exact position |

---

## Syntax Reference

```
$local {$x $y} {$y, $x}            # local pattern with variables
$global {$x $y} {$y, $x}           # global pattern with variables
$local {$x? $y} {$y, $x}           # optional variable
$local {$regex n {[0-9]+}} {$n}    # regex capture
$local {$block n {o}{c}} {$n}      # block capture with custom delimiters
$eval{code}                        # JavaScript evaluation
```

---

## API Reference

### Constructor
```javascript
new Papagaio(sigil, open, close, local, global, evalKw, blockKw, regexKw)
```

**Parameters:**
- `sigil` (default: `'$'`) - Variable prefix
- `open` (default: `'{'`) - Opening delimiter
- `close` (default: `'}'`) - Closing delimiter
- `local` (default: `'local'`) - Local pattern keyword
- `global` (default: `'global'`) - Global pattern keyword
- `evalKw` (default: `'eval'`) - Eval keyword
- `blockKw` (default: `'block'`) - Block keyword
- `regexKw` (default: `'regex'`) - Regex keyword

### Properties
- `papagaio.content` - Last processed output
- `papagaio.match` - Last matched substring
- `papagaio.globalPatterns` - Array of global patterns
- `papagaio.recursion_limit` - Maximum recursion depth (default: 512)
- `papagaio.symbols` - Configuration object

### Methods
- `papagaio.process(input)` - Process input text and return transformed output

---

## Performance Notes

* Patterns apply recursively until no changes occur (up to `recursion_limit`)
* Multi-character delimiter matching is optimized with regex escaping
* Global patterns are stored and reused across calls
* Nested blocks and patterns have no theoretical depth limit
* Large recursion limits can impact performance on complex inputs
* Each `process()` call evaluates local patterns first, then global patterns

***PAPAGAIO IS CURRENTLY IN HEAVY DEVELOPMENT AND EXPERIMENTATION PHASE***

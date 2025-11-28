# Papagaio

Papagaio is a flexible text preprocessor. It allows defining patterns, context blocks, dynamic variable capture, and runtime transformations directly within text. It is ideal for templates, macros, DSLs, or any structured text manipulation.

The JavaScript API is minimal: just instantiate and call `process(input)`. Everything else happens in the text itself.

---

# Core Concepts

Papagaio operates with four central mechanisms:

1. **pattern{match}{replace}**  
   Defines transformation rules. Can capture arbitrary content from the input.

2. **context{...}**  
   Processes its content recursively before reinserting it into the output.

3. **Sigils (default `$`)**  
   Introduce variables, special operations, optional spaces, and greedy captures.

4. **Configurable delimiters**  
   Define which pairs of characters are recognized as block boundaries (`{}`, `[]`, `()`, etc.).

The engine processes text in layers: it detects patterns and contexts, applies transformations, and repeats until the text stabilizes.

---

# 1. Patterns

```

pattern{MATCH}{REPLACE}

```

- **MATCH**: the string or structure to detect.
- **REPLACE**: the replacement string, which may include captured variables.

---

## 1.1 Simple variables

```

pattern{Hello $name}{Hi $name}
Hello John

```

Output:

```

Hi John

```

`$name` captures a single token (non-whitespace).

---

## 1.2 Greedy variables: `$var...TOKEN`

Captures everything until it encounters `TOKEN`.

```

pattern{start $x...end}{X=$x}
start abc def end

```

Output:

```

X=abc def

```

`TOKEN` can include spaces, and you can use `$$` for zero or more optional spaces.

```

pattern{A $y...B$$C}{Y=$y}
A hello world B   C

```

Also matches:

```

A hello world BC

```

---

## 1.3 Balanced variables: `<$var>`

Captures content inside delimiters, respecting nested structures.

```

pattern{<$c>}{C=$c}
<one {two} three>

```

Output:

```

C=one {two} three

```

---

## 1.4 Multiple captures

```

pattern{$a + $b}{sum($a,$b)}
2 + 3

```

Output:

```

sum(2,3)

```

---

## 1.5 Special substitutions in REPLACE

- `$pre` — text before the match
- `$post` — text after the match
- `$match` — the raw matched content
- `$unique` — generates unique identifiers
- `$eval{JS}` — executes JavaScript and substitutes the return value

Example:

```

pattern{calc $num}{value=$eval{return $num*2;} }
calc 21

```

Output:

```

value=42

```

---

## 1.6 Clearing the content with `$clear`

If `$clear` appears in REPLACE, the entire current text is replaced with the latest result.

```

pattern{reset}{RESULT$clear}
x y z reset aaa

```

Output:

```

RESULT

```

---

## 1.7 Recursive patterns

Papagaio applies patterns until text stabilizes:

```

pattern{a}{b}
pattern{b}{c}
pattern{c}{stop}
a

```

Output:

```

stop

```

---

# 2. Context

Blocks `context{}` process their content recursively.

```

context{
pattern{Hi $x}{Hello $x}
Hi Alice
}

```

Output:

```

Hello Alice

```

---

## 2.1 Empty context

```

before context{} after

```

Output:

```

before  after

```

---

## 2.2 Nested contexts

```

context{
pattern{X}{$unique}
context{
X
X
}
}

```

Generates two different unique IDs.

---

## 2.3 Sandbox behavior

Patterns defined inside a context do not affect outer text.

```

context{
pattern{A}{1}
A
}
A

```

Output:

```

1
A

```

---

# 3. Custom delimiters

`delimiters` define block boundaries. Defaults: `{}`, `[]`, `()`.

You can change them at runtime:

```

papagaio.delimiters = [["<", ">"], ["{", "}"]];

```

### Example: XML-style parsing

```

papagaio.delimiters = [["<", ">"]];

pattern{<tag $x>}{TAG=$x} <tag content>

```

Output:

```

TAG=content

```

---

# 4. Custom sigil

Default: `$`. Can be changed:

```

papagaio.sigil = "@";
pattern{hello @x}{H=@x}
hello world

```

Output:

```

H=world

```

---

# 5. Custom keywords

`pattern` and `context` words can be redefined:

```

papagaio.keywords.pattern = "macro";
papagaio.keywords.context = "scope";

```
```

macro{Hello $x}{Hi $x}
Hello World

```

Output:

```

Hi World

```

---

# 6. Advanced hacks

## 6.1 Dynamic delimiter changes mid-process

```

pattern{setdelim}{$eval{ papagaio.delimiters=[["<",">"]]; return "";} }
setdelim <hello>

```

---

## 6.2 Custom syntax macros

```

papagaio.keywords.pattern = "::";
papagaio.sigil = "%";

::{hello %x}{HELLO %x}
hello world

```

Output:

```

HELLO world

```

---

## 6.3 Mini DSL creation

```

pattern{IF $cond THEN $body}{if ($cond) { $body }}
pattern{PRINT $x}{console.log($x)}

IF x > 10 THEN PRINT x

```

---

## 6.4 Template engine

```

pattern{{{$var}}}{$var}
Hello {{{$user}}}

```

---

## 6.5 Multiline captures

```

pattern{BEGIN $x...END}{[$x]}
BEGIN
multi
line
text
END

```

---

## 6.6 $pre and $post example

```

pattern{<$x>}{($pre|$x|$post)}
A <mid> B

```

Output:

```

A (A | mid |  B) B

```

---

## 6.7 Full rewrite via $clear

```

pattern{main}{program initialized$clear}
xxx main yyy

```

---

# 7. Depth-isolated patterns

Inner patterns are ignored until outer patterns resolve:

```

pattern{A}{1}
pattern{
B
}{
context{
pattern{C}{2}
C
}
}
B

```

---

# 8. Complete Examples

### Example 1: Components DSL

```

pattern{component $name { $body...} }
{
function $name(){return `$body`;}
}

component Button { <button>click</button>
}

Button

```

---

### Example 2: Sequential expansion with $unique

```

pattern{ID}{id_$unique}
X: ID, Y: ID, Z: ID

```

---

### Example 3: Markdown preprocessor

```

pattern{# $t}{<h1>$t</h1>}
pattern{## $t}{<h2>$t</h2>}

# Title

## Subtitle

```

---

### Example 4: Embedded interpreter

```

pattern{calc $x + $y}{ $eval{return Number($x)+Number($y);} }
calc 2 + 5

```

---

### Example 5: Selective removal with context

```

context{
pattern{debug $x}{}
debug remove this
}
debug keep

```

Output:

```

debug keep

```

---

# 9. Public properties

- `maxRecursion`
- `delimiters`
- `sigil`
- `keywords.pattern`
- `keywords.context`
- `content`

All mutable at runtime.

---


# 11. Self-Modifying Patterns

Papagaio patterns can modify themselves or other patterns at runtime using `$eval` and `$unique`. This allows dynamic generation of rules inside the same preprocessing pass.

### Example: generating numbered variables

```

pattern{define $x}{pattern{$x}{$x_$unique}}
define foo
foo
foo

```

Output:

```

foo_u0
foo_u1

```

The first line defines a new pattern dynamically; subsequent uses expand into unique identifiers.

---

# 12. Hybrid Parsing Pipelines

You can combine multiple processing passes with different delimiters, sigils, and keywords.

### Example: XML and Markdown pipeline

```

papagaio.delimiters = [["<", ">"], ["{", "}"]];
papagaio.sigil = "$";

pattern{<bold $x>}{**$x**}
pattern{# $t}{<h1>$t</h1>}

```

Text:

```

# Title

<bold text>
```

Output:

```
<h1>Title</h1>
**text**
```

This allows building multi-layer pre-processing pipelines where each pass targets different syntax conventions.

---

# 13. Self-Referential Patterns

Patterns can reference themselves or other patterns recursively.

### Example: expanding repeated lists

```
pattern{LIST $x}{ITEM $x LIST $x}
pattern{LIST $x}{ITEM $x}
LIST A
```

Output:

```
ITEM A
```

Patterns resolve recursively until the text stabilizes. Use `maxRecursion` to prevent infinite loops.

---

# 14. Lisp-Style Macro Systems

Papagaio can emulate a Lisp-like macro expansion engine using contexts and dynamic patterns.

### Example: defining macros inside contexts

```
context{
  pattern{defmacro $name { $body... }}{pattern{$name}{$body}}
  defmacro greet {Hello $1}
  greet John
}
```

Output:

```
Hello John
```

Inside a `context`, macro definitions are local and can create arbitrary code expansions dynamically.

---

# 15. Advanced Transpiler Flows

Papagaio can be used to build mini-transpilers by chaining pattern expansions and contexts.

### Example: pseudo-language to JavaScript

```
context{
  pattern{PRINT $x}{console.log($x);}
  pattern{IF $cond THEN $body}{if ($cond) { $body }}
  PRINT 42
  IF x > 10 THEN PRINT x
}
```

Output:

```
console.log(42);
if (x > 10) { console.log(x); }
```

You can extend this by defining multiple layers of contexts, dynamically switching delimiters, or even generating patterns on the fly.

---

# 16. Dynamic Runtime Hacks

### 16.1 Change delimiters mid-process

```
pattern{switch}{ $eval{ papagaio.delimiters=[["<",">"]]; return ""; } }
switch
<hello>
```

Output:

```
hello
```

### 16.2 Dynamic sigil change

```
pattern{sigil}{ $eval{ papagaio.sigil="@"; return ""; } }
sigil
@var
```

Output:

```
var
```

### 16.3 Keywords swapping

```
pattern{switch_keywords}{ $eval{ papagaio.keywords.pattern="macro"; papagaio.keywords.context="scope"; return ""; } }
switch_keywords
macro{X}{Y}
```

Output:

```
Y
```

---

# 17. Meta-Programming Examples

* **Dynamic template engines**: generate arbitrary nested templates inside contexts.
* **Self-expanding DSLs**: macros that define other macros.
* **Text-based code generation**: precompile repetitive boilerplate using `$unique` and `$eval`.
* **Hybrid syntaxes**: combine HTML, Markdown, custom DSL, and other syntaxes in a single pipeline.
* **Sandboxed rule execution**: define rules inside a context that never leak to the global scope.

---

# 18. Practical Guidelines

* Use `$eval` carefully; errors will produce empty output.
* `$unique` is essential for safe auto-generated identifiers.
* `maxRecursion` prevents infinite loops with recursive or self-referential patterns.
* Contexts act like local scopes for patterns; define macros or temporary rules inside them.
* Delimiters and sigils can be swapped mid-processing for DSL adaptation.
* Always trim input to avoid unintended whitespace captures with `...` patterns.


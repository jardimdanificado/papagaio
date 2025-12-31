# Louro

A powerful and flexible JavaScript pattern matching and extraction library with a simple, intuitive syntax.

## Features

- Parse and capture patterns from strings using customizable delimiters.
- Chainable methods to manipulate matches:
  - `replace()` – replace matched segments.
  - `first(n)` – get the first `n` matches.
  - `last(n)` – get the last `n` matches.
  - `pop(n)` – remove the last `n` matches.
  - `shift(n)` – remove the first `n` matches.
  - `remove(index, n)` – remove matches at a specific index.
  - `where(key, value)` – filter matches by a key or key-value pair.
- Extend the native `String` prototype for inline captures with `String.prototype.capture`.

## Installation

```bash
npm install louro
```

## Quick Start

```javascript
// the default experience, 
// adds the String.prototype.capture method
import './louro.js';

const text = "Hello, my name is John and I'm 25 years old.";
const result = text.capture("my name is $name and I'm $age");

console.log(result.matches[0].captures);
// { name: "John", age: "25 years old." }
```

## Pattern Syntax

### Variables

Use `$varname` to capture content:

```javascript
const text = "Price: $50";
const result = text.capture("Price: $amount");
// captures: { amount: "$50" }
```

### Optional Variables

Add `?` to make a variable optional:

```javascript
const pattern = "$title? $name";
"Mr. Smith".capture(pattern);        // { title: "Mr.", name: "Smith" }
"Jane".capture(pattern);             // { title: "", name: "Jane" }
```

### Blocks

Capture content between delimiters using `${delimiter1}{delimiter2}varname`:

```javascript
const text = "Code: {hello world}";
const result = text.capture("Code: ${{}code");
// captures: { code: "hello world" }
```

#### Custom Block Delimiters

```javascript
const text = "HTML: <div>content</div>";
const result = text.capture("HTML: ${<}{>}tag ${<}{>}content ${<}{>}end");
// captures: { tag: "div", content: "content", end: "/div" }
```

#### Optional Blocks

```javascript
const pattern = "${()comment? function $name";
"(helper) function test".capture(pattern);  // { comment: "helper", name: "test" }
"function main".capture(pattern);            // { comment: "", name: "main" }
```

### Block Sequences

Use `$$` for repeating blocks:

```javascript
const text = "[1] [2] [3]";
const result = text.capture("$${ [ }{ ] }items");
// captures: { items: ["1", "2", "3"] }
```

### Whitespace

Whitespace in patterns matches any amount of whitespace in the source:

```javascript
const pattern = "$cmd   $arg";  // Matches multiple spaces/tabs/newlines
"run    test".capture(pattern);  // { cmd: "run", arg: "test" }
```

## API Reference

### `String.prototype.capture(pattern, symbols?)`

Main method to capture patterns from content.

**Parameters:**

- `pattern` (string): The pattern to match
- `symbols` (object, optional): Custom symbols configuration
  - `sigil` (string): Variable prefix (default: `'$'`)
  - `open` (string): Default open delimiter (default: `'{'`)
  - `close` (string): Default close delimiter (default: `'}'`)

**Returns:** Result object with methods and properties

### Result Object

#### Properties

- `content` - Original content string
- `pattern` - Pattern used
- `matches` - Array of match objects
- `count` - Number of matches found

#### Match Object Structure

```javascript
{
  matched: "the full matched text",
  captures: { varName: "captured value" },
  start: 0,        // Start position in content
  end: 10,         // End position in content
  index: 0         // Match index
}
```

#### Methods

##### `.replace(replacement)`

Replace all matches with new content.

```javascript
const text = "Hello John, Hello Jane";
const result = text.capture("Hello $name");

// String replacement
result.replace("Hi $name");  // "Hi John, Hi Jane"

// Function replacement
result.replace(match => {
  return `Greetings, ${match.captures.name}!`;
});
```

##### `.filter(predicate)`

Filter matches based on a condition.

```javascript
const text = "age: 15, age: 25, age: 35";
const result = text.capture("age: $age");

result.filter(m => parseInt(m.captures.age) >= 18)
      .replace("adult: $age");
// "age: 15, adult: 25, adult: 35"
```

##### `.only(index)`

Get only a specific match (supports negative indexing).

```javascript
const result = "a b c d".capture("$letter");

result.only(0).replace("first");   // "first b c d"
result.only(-1).replace("last");   // "a b c last"
```

## Usage Examples

### Extract Function Definitions

```javascript
const code = `
function add(a, b) { return a + b; }
function subtract(x, y) { return x - y; }
`;

const result = code.capture("function $name${(}{)}params ${{}body");

result.matches.forEach(m => {
  console.log(`Function: ${m.captures.name}`);
  console.log(`Params: ${m.captures.params}`);
  console.log(`Body: ${m.captures.body}`);
});
```

### Parse Configuration

```javascript
const config = `
setting1=value1
setting2=value2
`;

const result = config.capture("$key=$value");

const settings = {};
result.matches.forEach(m => {
  settings[m.captures.key] = m.captures.value;
});
```

### Extract JSON-like Data

```javascript
const data = `
user: { name: "John", age: 30 }
user: { name: "Jane", age: 25 }
`;

const result = data.capture("user: ${{}}userData");

result.matches.forEach(m => {
  console.log(m.captures.userData);
  // " name: "John", age: 30 "
  // " name: "Jane", age: 25 "
});
```

### Extract Array Elements

```javascript
const list = "[apple] [banana] [cherry]";
const result = list.capture("$${[}{]}fruits");

console.log(result.matches[0].captures.fruits);
// ["apple", "banana", "cherry"]
```

### Transform Markdown Links

```javascript
const markdown = "Check [Google](https://google.com) and [GitHub](https://github.com)";

const result = markdown.capture("[${{}}text](${{}}url)");

const html = result.replace(match => {
  return `<a href="${match.captures.url}">${match.captures.text}</a>`;
});

console.log(html);
// Check <a href="https://google.com">Google</a> and <a href="https://github.com">GitHub</a>
```

### Parse Log Files

```javascript
const logs = `
[2024-01-01] ERROR: Database connection failed
[2024-01-02] INFO: Server started
[2024-01-03] ERROR: Out of memory
`;

const result = logs.capture("[${{}}date] $level: $message");

const errors = result.filter(m => m.captures.level === 'ERROR');

errors.matches.forEach(m => {
  console.log(`${m.captures.date}: ${m.captures.message}`);
});
```

### String Prototype Extension

```javascript
const text = "Hello $name, welcome!";
const result = text.capture("Hello $name");

console.log(result.matches[0].captures.name);
```

### Custom Symbols

```javascript
const text = "Price: @amount USD";
const result = text.capture("Price: @amount", {
  sigil: '@',
  open: '<',
  close: '>'
});
```

## Advanced Examples

### Nested Replacements

```javascript
const template = "User: $name (Age: $age)";
const data = [
  { name: "John", age: 25 },
  { name: "Jane", age: 30 }
];

data.forEach(user => {
  let text = template;
  for (const [key, value] of Object.entries(user)) {
    text = text.capture(`$${key}`).replace(String(value));
  }
  console.log(text);
});
```

### Conditional Transformations

```javascript
const text = "price: $10, price: $20, price: $5";
const result = text.capture("price: $amount");

const transformed = result.replace(match => {
  const price = parseInt(match.captures.amount.slice(1));
  return price > 15 ? `EXPENSIVE: ${match.captures.amount}` : match.matched;
});
```

## Syntax Reference

```
$x                          # variable capture
$x?                         # optional variable
${open}{close}name          # block with custom delimiters
$${open}{close}name         # block sequence (multiple blocks)
${}{}name                   # block with default delimiters
```

## Important Rules

### Variable Matching

- `$x` captures content based on context
- `$x?` is optional and won't fail if not found
- Variables automatically skip leading whitespace
- Trailing whitespace is trimmed when variables appear before literals

### Block Matching

- `${open}{close}name` captures content between delimiters
- `$${open}{close}name` captures multiple adjacent blocks
- Supports multi-character delimiters
- Handles nested delimiters recursively
- Block sequences are returned as arrays

### Pattern Matching

- Patterns match all occurrences in the content
- Whitespace in patterns matches any amount of whitespace
- Matches are non-overlapping and sequential

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Repository

https://github.com/jardimdanificado/louro

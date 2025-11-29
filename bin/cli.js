#!/usr/bin/env node
import { Papagaio } from "../src/papagaio.js";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pkg = require("../package.json");


// Help & Version
const args = process.argv.slice(2);
if (args.includes("-v") || args.includes("--version")) {
  console.log(pkg.version);
  process.exit(0);
}
if (args.includes("-h") || args.includes("--help")) {
  console.log(`Usage: papagaio [options] <file>

Options:
  -h, --help      Show this help message
  -v, --version   Show version number`);
  process.exit(0);
}

// File input
const file = args.find(arg => !arg.startsWith("-"));
if (!file) {
  console.error("Error: no input file specified.\nUse --help for usage.");
  process.exit(1);
}

const src = fs.readFileSync(file, "utf8");
const p = new Papagaio();
const out = p.process(src);
console.log(out);

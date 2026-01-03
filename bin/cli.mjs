#!/usr/bin/env node

import fs from "fs";
import Papagaio from "../papagaio.js";

async function main() {
    const args = process.argv.slice(2);

    const pkgPath = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const VERSION = pkg.version;

    if (args.includes("-v") || args.includes("--version")) {
        console.log(VERSION);
        process.exit(0);
    }

    if (args.includes("-h") || args.includes("--help")) {
        console.log(`Usage: papagaio [options] <file1> [file2] [...]

Options:
  -h, --help            Show this help message
  -v, --version         Show version number

Examples:
  papagaio input.txt
  papagaio file1.txt file2.txt file3.txt
  papagaio *.txt`);
        process.exit(0);
    }

    const files = args.filter(arg => !arg.startsWith("-"));

    if (files.length === 0) {
        console.error("Error: no input file specified.\nUse --help for usage.");
        process.exit(1);
    }

    let concatenatedSrc = "";
    let hasErrors = false;

    for (const file of files) {
        try {
            if (!fs.existsSync(file)) {
                throw new Error(`file not found: ${file}`);
            }
            concatenatedSrc += fs.readFileSync(file, "utf8");
        } catch (err) {
            console.error(`Error reading ${file}: ${err.message || err}`);
            hasErrors = true;
        }
    }

    if (hasErrors) {
        process.exit(1);
    }

    const p = new Papagaio();
    const out = p.process(concatenatedSrc);
    console.log(out);
}

main().catch(err => {
    console.error("Fatal error:", err.message || err);
    process.exit(1);
});

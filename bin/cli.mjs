#!/usr/bin/env node
// Detecta o runtime
const isQuickJS = typeof scriptArgs !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// ============================================================================
// MAIN FUNCTION
// ============================================================================
async function main() {
    // ============================================================================
    // IMPORTS - Branch por runtime
    // ============================================================================
    let Papagaio, std, os, fs, pkg;

    if (isQuickJS) {
        // QuickJS imports
        const stdModule = await import("std");
        const osModule = await import("os");
        std = stdModule;
        os = osModule;
        const { Papagaio: P } = await import("../papagaio.js");
        Papagaio = P;
    } else {
        // Node.js imports
        const fsModule = await import("fs");
        fs = fsModule.default;

        // Load package.json usando fs ao invés de require
        const pkgPath = new URL("../package.json", import.meta.url);
        const pkgContent = fs.readFileSync(pkgPath, "utf8");
        pkg = JSON.parse(pkgContent);

        const { Papagaio: P } = await import("../papagaio.js");
        Papagaio = P;
    }

    // ============================================================================
    // ABSTRAÇÃO DE CONSOLE/STD
    // ============================================================================
    const output = {
        log: isQuickJS ? (msg) => std.out.puts(msg + "\n") : console.log,
        error: isQuickJS ? (msg) => std.err.puts(msg + "\n") : console.error,
        exit: isQuickJS ? std.exit : process.exit
    };

    // ============================================================================
    // PARSE ARGUMENTS
    // ============================================================================
    const args = isQuickJS ? scriptArgs.slice(1) : process.argv.slice(2);
    const VERSION = isQuickJS ? "0.6.0" : pkg.version;

    // Help & Version
    if (args.includes("-v") || args.includes("--version")) {
        output.log(VERSION);
        output.exit(0);
    }

    if (args.includes("-h") || args.includes("--help")) {
        output.log(`Usage: papagaio [options] <file1> [file2] [...]

Options:
  -h, --help            Show this help message
  -v, --version         Show version number

Examples:
  papagaio input.txt
  papagaio file1.txt file2.txt file3.txt
  papagaio *.txt`);
        output.exit(0);
    }

    // Get input files
    const files = args.filter((arg, i) => {
        if (arg.startsWith("-")) return false;
        return true;
    });

    if (files.length === 0) {
        output.error("Error: no input file specified.\nUse --help for usage.");
        output.exit(1);
    }

    // ============================================================================
    // FILE READING ABSTRACTION
    // ============================================================================
    function readFile(filepath) {
        if (isQuickJS) {
            const f = std.open(filepath, "r");
            if (!f) {
                throw new Error(`cannot open file '${filepath}'`);
            }
            const content = f.readAsString();
            f.close();
            return content;
        } else {
            if (!fs.existsSync(filepath)) {
                throw new Error(`file not found: ${filepath}`);
            }
            return fs.readFileSync(filepath, "utf8");
        }
    }

    // ============================================================================
    // READ AND CONCATENATE FILES
    // ============================================================================
    let concatenatedSrc = "";
    let hasErrors = false;

    for (const file of files) {
        try {
            const src = readFile(file);
            concatenatedSrc += src;
        } catch (error) {
            output.error(`Error reading ${file}: ${error.message || error}`);
            hasErrors = true;
        }
    }

    if (hasErrors) {
        output.exit(1);
    }

    // PROCESS CONCATENATED INPUT
    const p = new Papagaio();
    const out = p.process(concatenatedSrc);
    output.log(out);
}

// main
main().catch(err => {
    const output = isQuickJS
        ? (msg) => std.err.puts(msg + "\n")
        : console.error;
    output("Fatal error: " + (err.message || err));
    const exit = isQuickJS ? std.exit : process.exit;
    exit(1);
});
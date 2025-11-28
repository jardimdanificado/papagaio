#!/usr/bin/env node
import { Papagaio } from "./papagaio.js";
import fs from "fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: papagaio <file>");
  process.exit(1);
}

const src = fs.readFileSync(file, "utf8");
const p = new Papagaio();
const out = p.process(src);
console.log(out);

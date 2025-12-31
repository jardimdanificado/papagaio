import { Papagaio } from '../papagaio.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Read tests JSON file
const testsPath = path.join(__dirname, 'tests.json');
const testsData = JSON.parse(fs.readFileSync(testsPath, 'utf-8'));
const tests = testsData.tests;

console.log(`${colors.cyan}[TEST] PAPAGAIO - TEST RUNNER${colors.reset}\n`);
console.log('='.repeat(80));

let passed = 0;
let failed = 0;
const failedTests = [];

for (const test of tests) {
  // Criar nova instância de Papagaio para cada teste
  const p = new Papagaio();
  
  try {
    const result = p.process(test.code).trim();
    const success = result === test.expected.trim();
    
    if (success) {
      console.log(`${colors.green}[PASS]${colors.reset} [${test.id}] ${test.name}`);
      passed++;
    } else {
      console.log(`${colors.red}[FAIL]${colors.reset} [${test.id}] ${test.name}`);
      console.log(`       ${colors.yellow}Expected:${colors.reset} "${test.expected}"`);
      console.log(`       ${colors.yellow}Got:${colors.reset}      "${result.substring(0, 80)}${result.length > 80 ? '...' : ''}"`);
      failed++;
      failedTests.push({
        id: test.id,
        name: test.name,
        expected: test.expected,
        got: result.substring(0, 150)
      });
    }
  } catch (e) {
    console.log(`${colors.red}[ERR!]${colors.reset} [${test.id}] ${test.name}`);
    console.log(`       ${colors.yellow}ERROR:${colors.reset} ${e.message}`);
    failed++;
    failedTests.push({
      id: test.id,
      name: test.name,
      error: e.message
    });
  }
}

console.log('\n' + '='.repeat(80));
console.log(`\n${colors.cyan}[INFO]${colors.reset} FINAL RESULT: ${passed}/${tests.length} tests passed`);
console.log(`       ${colors.green}[PASS]${colors.reset} Passed: ${passed}`);
console.log(`       ${colors.red}[FAIL]${colors.reset} Failed: ${failed}`);
console.log(`       Success rate: ${Math.round((passed / tests.length) * 100)}%\n`);

if (failedTests.length > 0) {
  console.log(`${colors.red}[FAIL]${colors.reset} FAILED TESTS:`);
  console.log('-'.repeat(80));
  for (const test of failedTests) {
    console.log(`\n[${test.id}] ${test.name}`);
    if (test.error) {
      console.log(`  ${colors.red}Error:${colors.reset} ${test.error}`);
    } else {
      console.log(`  ${colors.yellow}Expected:${colors.reset} ${test.expected}`);
      console.log(`  ${colors.yellow}Got:${colors.reset}      ${test.got}`);
    }
  }
}

// Generate test report JSON
const report = {
  timestamp: new Date().toISOString(),
  totalTests: tests.length,
  passed,
  failed,
  successRate: Math.round((passed / tests.length) * 100),
  failedTests
};

const reportPath = path.join(__dirname, 'test-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`\n${colors.cyan}[INFO]${colors.reset} Report saved at: ${reportPath}`);

process.exit(failed > 0 ? 1 : 0);
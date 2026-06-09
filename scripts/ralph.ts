#!/usr/bin/env tsx
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

interface Mutant {
  file: string;
  lineStart: number;
  lineEnd: number;
  mutatorName: string;
  replacement: string;
  contextCode: string;
}

function runOrThrow(cmd: string, cwd: string): { stdout: string; exitCode: number } {
  try {
    const out = execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' });
    return { stdout: out, exitCode: 0 };
  } catch (e: any) {
    return { stdout: e.stdout ?? '', exitCode: e.status ?? 1 };
  }
}

function getMutationScore(pkgDir: string): number | null {
  const reportPath = resolve(pkgDir, 'reports/mutation/mutation.json');
  if (!existsSync(reportPath)) return null;
  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
    let killed = 0, total = 0;
    for (const f of Object.values(report.files) as any[]) {
      for (const m of f.mutants ?? []) {
        total++;
        if (m.status === 'Killed' || m.status === 'TimedOut') killed++;
      }
    }
    return total > 0 ? (killed / total) * 100 : null;
  } catch { return null; }
}

function getSurvivingMutants(pkgDir: string): Map<string, Mutant[]> {
  const reportPath = resolve(pkgDir, 'reports/mutation/mutation.json');
  if (!existsSync(reportPath)) return new Map();
  const report = JSON.parse(readFileSync(reportPath, 'utf-8'));
  const grouped = new Map<string, Mutant[]>();

  for (const [filePath, fileData] of Object.entries(report.files)) {
    const mutants: any[] = (fileData as any).mutants ?? [];
    const survived = mutants.filter(m => m.status === 'Survived' || m.status === 'NoCoverage');
    if (survived.length === 0) continue;

    const absPath = resolve(pkgDir, filePath);
    if (!existsSync(absPath)) continue;
    const sourceLines = readFileSync(absPath, 'utf-8').split('\n');

    const list: Mutant[] = survived.map(m => ({
      file: filePath,
      lineStart: m.location.start.line,
      lineEnd: m.location.end.line,
      mutatorName: m.mutatorName,
      replacement: m.replacement,
      contextCode: sourceLines.slice(
        Math.max(0, m.location.start.line - 3),
        Math.min(sourceLines.length, m.location.end.line + 2)
      ).join('\n'),
    }));
    grouped.set(filePath, list);
  }
  return grouped;
}

function findTestFile(pkgDir: string, sourceFile: string): string | null {
  const fileName = sourceFile.split('/').pop()?.replace(/\.ts$/, '');
  if (!fileName) return null;
  const testPath = resolve(pkgDir, 'src', '__tests__', `${fileName}.test.ts`);
  return existsSync(testPath) ? testPath : null;
}

async function generateTests(sourceCode: string, testCode: string, mutants: Mutant[]): Promise<string> {
  const mutantsDesc = mutants.map((m, i) =>
    `Mutation ${i + 1}: ${m.file}:${m.lineStart}
  Mutator: ${m.mutatorName}
  Replacement: ${m.replacement}
  Context:
  \`\`\`
${m.contextCode}
  \`\`\``
  ).join('\n\n');

  const prompt = `You are improving vitest test coverage. The following mutations survived (tests didn't catch them):

${mutantsDesc}

Source file:
\`\`\`typescript
${sourceCode}
\`\`\`

Current tests:
\`\`\`typescript
${testCode}
\`\`\`

Generate ONLY vitest test code (one or more it() blocks inside a describe()) to kill these mutants.
- Use vitest globals (describe, it, expect, vi)
- Import the source via '../<file>.js' (ESM with .js extension)
- Mock external dependencies where needed
- Return ONLY valid TypeScript test code, NO markdown fences, NO explanation.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  let text = '';
  for (const block of response.content) {
    if (block.type === 'text') text += block.text;
  }
  return text;
}

async function main() {
  const pkgDir = resolve(process.argv[2] || '.');
  const maxIterations = parseInt(process.argv[3] || '10', 10);
  const targetScore = parseFloat(process.argv[4] || '85');

  console.log(`Ralph: ${pkgDir}`);
  console.log(`Target: ${targetScore}%, Max iterations: ${maxIterations}`);

  for (let iter = 1; iter <= maxIterations; iter++) {
    console.log(`\n=== Iteration ${iter}/${maxIterations} ===`);

    // Run Stryker
    const { stdout, exitCode } = runOrThrow('npx stryker run', pkgDir);
    const score = getMutationScore(pkgDir);

    if (score === null) {
      console.log('Could not read mutation score.');
      return;
    }

    console.log(`Mutation score: ${score.toFixed(2)}%`);

    if (score >= targetScore) {
      console.log(`Target reached!`);
      return;
    }

    const survivors = getSurvivingMutants(pkgDir);
    if (survivors.size === 0) {
      console.log('No surviving mutants found but score < target.');
      continue;
    }

    console.log(`${survivors.size} file(s) with surviving mutants:`);
    for (const [file, mutants] of survivors) {
      console.log(`  ${file}: ${mutants.length} mutant(s)`);

      const testFile = findTestFile(pkgDir, file);
      if (!testFile) {
        console.log(`    No test file found for ${file}, skipping.`);
        continue;
      }

      const sourceCode = readFileSync(resolve(pkgDir, file), 'utf-8');
      const existingTests = readFileSync(testFile, 'utf-8');

      console.log(`    Generating tests...`);
      const newTests = await generateTests(sourceCode, existingTests, mutants);
      const cleaned = newTests.replace(/```(?:typescript|ts)?\n?/g, '').trim();

      console.log(`    Appending ${cleaned.length} chars...`);
      appendFileSync(testFile, '\n\n' + cleaned);

      // Verify unit tests still pass
      const { exitCode: testExit } = runOrThrow('pnpm test', pkgDir);
      if (testExit !== 0) {
        console.log(`    Tests failed! Reverting...`);
        writeFileSync(testFile, existingTests);
      } else {
        console.log(`    Tests pass.`);
      }
    }
  }

  // Final score check
  runOrThrow('npx stryker run', pkgDir);
  const finalScore = getMutationScore(pkgDir);
  console.log(`\nFinal mutation score: ${finalScore?.toFixed(2) ?? 'unknown'}%`);
  if (finalScore && finalScore >= targetScore) {
    console.log('Target reached!');
  } else {
    console.log('Target not reached. Increase max iterations or improve tests manually.');
    process.exit(finalScore && finalScore < 50 ? 1 : 0);
  }
}

main().catch(console.error);

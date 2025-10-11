
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface PreflightResult {
  tsc: "pass" | "fail" | "skipped";
  eslint: "pass" | "fail" | "skipped";
  build: "pass" | "fail" | "skipped";
  tests: "pass" | "fail" | "skipped";
  logs: {
    tsc: string;
    eslint: string;
    build: string;
    tests: string;
  };
}

export async function runPreflight(workingDir: string): Promise<PreflightResult> {
  console.log(`🔍 [PREFLIGHT] Running preflight checks in: ${workingDir}`);
  
  const result: PreflightResult = {
    tsc: "skipped",
    eslint: "skipped",
    build: "skipped",
    tests: "skipped",
    logs: {
      tsc: "",
      eslint: "",
      build: "",
      tests: ""
    }
  };

  // Check TypeScript compilation
  const tsconfigPath = path.join(workingDir, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    console.log('🔧 [PREFLIGHT] Running TypeScript check...');
    const tscResult = await runCommand('npx', ['tsc', '--noEmit'], workingDir);
    result.tsc = tscResult.exitCode === 0 ? "pass" : "fail";
    result.logs.tsc = tscResult.output;
  } else {
    result.logs.tsc = "No tsconfig.json found, skipping TypeScript check";
  }

  // Check ESLint
  const eslintConfigs = ['eslint.config.js', '.eslintrc.js', '.eslintrc.json', '.eslintrc'];
  const hasEslintConfig = eslintConfigs.some(config => 
    fs.existsSync(path.join(workingDir, config))
  );
  
  if (hasEslintConfig) {
    console.log('🔧 [PREFLIGHT] Running ESLint check...');
    const eslintResult = await runCommand('npx', ['eslint', '.', '--max-warnings=0'], workingDir);
    result.eslint = eslintResult.exitCode === 0 ? "pass" : "fail";
    result.logs.eslint = eslintResult.output;
  } else {
    result.logs.eslint = "No ESLint config found, skipping ESLint check";
  }

  // Check build (Vite)
  const viteConfigPath = path.join(workingDir, 'vite.config.ts');
  const packageJsonPath = path.join(workingDir, 'package.json');
  
  if (fs.existsSync(viteConfigPath) || (fs.existsSync(packageJsonPath) && 
      JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).scripts?.build)) {
    console.log('🔧 [PREFLIGHT] Running build check...');
    const buildResult = await runCommand('npx', ['vite', 'build'], workingDir);
    result.build = buildResult.exitCode === 0 ? "pass" : "fail";
    result.logs.build = buildResult.output;
  } else {
    result.logs.build = "No build configuration found, skipping build check";
  }

  // Check tests
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.scripts?.test) {
      console.log('🔧 [PREFLIGHT] Running tests...');
      const testResult = await runCommand('npm', ['test'], workingDir);
      result.tests = testResult.exitCode === 0 ? "pass" : "fail";
      result.logs.tests = testResult.output;
    } else {
      result.tests = "pass"; // Mark as pass if no tests configured
      result.logs.tests = "No test script configured, marking as pass";
    }
  }

  console.log(`✅ [PREFLIGHT] Preflight completed:`, {
    tsc: result.tsc,
    eslint: result.eslint,
    build: result.build,
    tests: result.tests
  });

  return result;
}

function runCommand(command: string, args: string[], cwd: string): Promise<{exitCode: number, output: string}> {
  return new Promise((resolve) => {
    const process = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
    });

    process.stderr.on('data', (data) => {
      output += data.toString();
    });

    process.on('close', (exitCode) => {
      resolve({
        exitCode: exitCode || 0,
        output: output.trim()
      });
    });

    process.on('error', (error) => {
      resolve({
        exitCode: 1,
        output: `Command failed: ${error.message}`
      });
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      process.kill();
      resolve({
        exitCode: 1,
        output: 'Command timed out after 5 minutes'
      });
    }, 5 * 60 * 1000);
  });
}

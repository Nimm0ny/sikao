#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { argv, exit, platform, stdout, stderr } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const GATES = new Set(["all", "git", "multica-intake", "preflight", "review", "validation"]);
const PROFILES = new Set(["backend-first", "docs", "full"]);
const CODE_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".jsx",
  ".mjs",
  ".py",
  ".sql",
  ".ts",
  ".tsx",
]);
const SENSITIVE_PATTERNS = [
  /(^|\/)database\/migrations\//i,
  /(^|\/)(auth|csrf|jwt|permission|security|session)(\/|\.|-|_)/i,
  /(^|\/)(models|schemas)\.(py|ts)$/i,
  /(^|\/)openapi\.json$/i,
];
const UI_PATTERNS = [
  /^apps\/web\/src\/.*\.(css|tsx)$/i,
  /^packages\/design-system\/src\/.*\.css$/i,
  /^packages\/editor\/src\/.*\.tsx$/i,
  /^packages\/ui\/src\//i,
];
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..");
const SERVICES_API_DIR = resolve(REPO_ROOT, "services", "api");

function repoPath(...segments) {
  return resolve(REPO_ROOT, ...segments);
}

function writeLine(message) {
  stdout.write(`${message}\n`);
}

function writeError(message) {
  stderr.write(`${message}\n`);
}

function requireValue(flag, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

export function parseCliArgs(rawArgs) {
  const gate = rawArgs[0];
  if (!GATES.has(gate)) {
    throw new Error(`Unknown gate "${gate ?? ""}". Expected one of: ${[...GATES].join(", ")}.`);
  }

  const parsed = {
    browserSmoke: false,
    dryRun: false,
    gate,
    issue: undefined,
    profile: "full",
    reviewed: false,
    ui: false,
  };

  for (let index = 1; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--browser-smoke") {
      parsed.browserSmoke = true;
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--issue") {
      parsed.issue = requireValue(arg, rawArgs[index + 1]);
      index += 1;
    } else if (arg === "--profile") {
      parsed.profile = requireValue(arg, rawArgs[index + 1]);
      if (!PROFILES.has(parsed.profile)) {
        throw new Error(`Unknown profile "${parsed.profile}". Expected one of: ${[...PROFILES].join(", ")}.`);
      }
      index += 1;
    } else if (arg === "--reviewed") {
      parsed.reviewed = true;
    } else if (arg === "--ui") {
      parsed.ui = true;
    } else {
      throw new Error(`Unknown argument "${arg}".`);
    }
  }

  return parsed;
}

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

function isDocPath(path) {
  const normalized = normalizePath(path).toLowerCase();
  return normalized.endsWith(".md") || normalized.startsWith("docs/");
}

function isCodePath(path) {
  return CODE_EXTENSIONS.has(extname(path).toLowerCase());
}

function isSensitivePath(path) {
  const normalized = normalizePath(path);
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isUiPath(path) {
  const normalized = normalizePath(path);
  return UI_PATTERNS.some((pattern) => pattern.test(normalized));
}

function parseCount(rawValue) {
  if (rawValue === "-") {
    return undefined;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid git numstat count "${rawValue}".`);
  }
  return parsed;
}

export function collectDiffStatsFromNumstat(numstat) {
  const stats = {
    changedFiles: 0,
    codeChangedLines: 0,
    deletions: 0,
    docAddedLines: 0,
    insertions: 0,
    netAddedLines: 0,
    sensitiveFiles: [],
    totalChangedLines: 0,
    uiFiles: [],
  };

  for (const rawLine of numstat.split(/\r?\n/)) {
    if (!rawLine.trim()) {
      continue;
    }
    const [rawInsertions, rawDeletions, ...pathParts] = rawLine.split("\t");
    const path = pathParts.join("\t");
    const insertions = parseCount(rawInsertions);
    const deletions = parseCount(rawDeletions);

    stats.changedFiles += 1;
    if (isSensitivePath(path)) {
      stats.sensitiveFiles.push(path);
    }
    if (isUiPath(path)) {
      stats.uiFiles.push(path);
    }
    if (insertions === undefined || deletions === undefined) {
      continue;
    }

    stats.insertions += insertions;
    stats.deletions += deletions;
    stats.netAddedLines += insertions - deletions;
    stats.totalChangedLines += insertions + deletions;
    if (isDocPath(path)) {
      stats.docAddedLines += insertions;
    } else if (isCodePath(path)) {
      stats.codeChangedLines += insertions + deletions;
    }
  }

  return stats;
}

export function evaluateReviewGate(stats, options) {
  const messages = [];
  const needsReview =
    stats.codeChangedLines > 100 ||
    stats.docAddedLines > 50 ||
    stats.sensitiveFiles.length > 0 ||
    stats.uiFiles.length > 0 ||
    options.ui;

  if (needsReview && !options.reviewed) {
    messages.push("Independent subagent review required before completion.");
  }
  if ((options.ui || stats.uiFiles.length > 0) && !options.browserSmoke) {
    messages.push("Browser smoke required for UI changes.");
  }

  return {
    messages,
    ok: messages.length === 0,
  };
}

export function evaluateBatchGate(stats) {
  const messages = [];
  if (stats.changedFiles > 15) {
    messages.push("Commit batch must stay <=15 files.");
  }
  if (stats.netAddedLines > 400) {
    messages.push("Commit batch must stay <=400 net added lines.");
  }
  if (stats.totalChangedLines > 100) {
    messages.push("Commit batch must stay <=100 changed lines; split commits before committing.");
  }
  return {
    messages,
    ok: messages.length === 0,
  };
}

export function buildValidationCommands(profile) {
  if (profile === "docs") {
    return [{ command: "node", args: ["--test", "scripts/gates/*.test.mjs"], cwd: REPO_ROOT }];
  }
  if (profile === "backend-first") {
    return [
      { command: "python", args: ["-m", "ruff", "check", "src", "tests"], cwd: SERVICES_API_DIR },
      { command: "python", args: ["-m", "mypy", "src"], cwd: SERVICES_API_DIR },
      { command: "python", args: ["-m", "pytest"], cwd: SERVICES_API_DIR },
      { command: "node", args: ["--test", "scripts/gates/*.test.mjs"], cwd: REPO_ROOT },
    ];
  }
  if (profile === "full") {
    return [
      { command: "npm", args: ["run", "typecheck"], cwd: REPO_ROOT },
      { command: "npm", args: ["run", "lint"], cwd: REPO_ROOT },
      { command: "npm", args: ["test"], cwd: REPO_ROOT },
      { command: "node", args: ["--test", "scripts/gates/*.test.mjs"], cwd: REPO_ROOT },
    ];
  }
  throw new Error(`Unknown validation profile "${profile}".`);
}

function runCommand(command, args, options = {}) {
  const spawnSpec = buildSpawnSpec(command, args);
  const rendered = [command, ...args].join(" ");
  const display = options.cwd ? `${rendered} (cwd: ${options.cwd})` : rendered;
  if (options.dryRun) {
    writeLine(`[dry-run] ${display}`);
    return "";
  }

  const result = spawnSync(spawnSpec.command, spawnSpec.args, {
    encoding: "utf8",
    cwd: options.cwd,
    shell: false,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const suffix = result.stderr ? `\n${result.stderr.trim()}` : "";
    throw new Error(`Command failed: ${display}${suffix}`);
  }
  return result.stdout ?? "";
}

function commandExists(command, versionArgs) {
  const spawnSpec = buildSpawnSpec(command, versionArgs);
  const result = spawnSync(spawnSpec.command, spawnSpec.args, {
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return !result.error && result.status === 0;
}

export function resolveExecutable(command, currentPlatform = platform) {
  if (currentPlatform === "win32" && command === "npm") {
    return "cmd.exe";
  }
  return command;
}

function quoteWindowsCommandArg(arg) {
  if (/^[A-Za-z0-9_./:*-]+$/.test(arg)) {
    return arg;
  }
  return `"${arg.replaceAll('"', '\\"')}"`;
}

export function buildSpawnSpec(command, args, currentPlatform = platform) {
  if (currentPlatform === "win32" && command === "npm") {
    return {
      args: ["/d", "/s", "/c", ["npm.cmd", ...args].map(quoteWindowsCommandArg).join(" ")],
      command: "cmd.exe",
    };
  }
  return { args, command };
}

function assertCommands(commands) {
  const missing = commands.filter(([command, args]) => !commandExists(command, args));
  if (missing.length > 0) {
    throw new Error(`Missing required command(s): ${missing.map(([command]) => command).join(", ")}.`);
  }
}

function fileHash(path) {
  const content = readFileSync(path);
  return createHash("sha256").update(content).digest("hex");
}

function assertMirrorSync() {
  const agentsPath = repoPath("AGENTS.md");
  const claudePath = repoPath("CLAUDE.md");
  if (!existsSync(agentsPath) || !existsSync(claudePath)) {
    throw new Error("AGENTS.md and CLAUDE.md must both exist.");
  }
  if (fileHash(agentsPath) !== fileHash(claudePath)) {
    throw new Error("AGENTS.md / CLAUDE.md drift detected.");
  }
}

function untrackedNumstatRows() {
  const output = runCommand("git", ["ls-files", "--others", "--exclude-standard"], {
    capture: true,
    cwd: REPO_ROOT,
  });
  const rows = [];
  for (const rawPath of output.split(/\r?\n/)) {
    if (!rawPath.trim()) {
      continue;
    }
    const path = normalizePath(rawPath);
    const content = readFileSync(repoPath(rawPath));
    if (content.includes(0)) {
      rows.push(`-\t-\t${path}`);
      continue;
    }
    const lineCount = countTextLinesForNumstat(content.toString("utf8"));
    rows.push(`${lineCount}\t0\t${path}`);
  }
  return rows.join("\n");
}

export function countTextLinesForNumstat(text) {
  if (text.length === 0) {
    return 0;
  }
  const withoutFinalNewline = text.endsWith("\n") ? text.slice(0, -1) : text;
  return withoutFinalNewline.split(/\r?\n/).length;
}

function collectWorktreeStats() {
  const tracked = runCommand("git", ["diff", "--numstat", "HEAD", "--", "."], {
    capture: true,
    cwd: REPO_ROOT,
  });
  const untracked = untrackedNumstatRows();
  return collectDiffStatsFromNumstat([tracked.trim(), untracked.trim()].filter(Boolean).join("\n"));
}

function printStats(stats) {
  writeLine(`Changed files: ${stats.changedFiles}`);
  writeLine(`Insertions: ${stats.insertions}`);
  writeLine(`Deletions: ${stats.deletions}`);
  writeLine(`Net added lines: ${stats.netAddedLines}`);
  writeLine(`Total changed lines: ${stats.totalChangedLines}`);
  writeLine(`Doc added lines: ${stats.docAddedLines}`);
  writeLine(`Code changed lines: ${stats.codeChangedLines}`);
  if (stats.sensitiveFiles.length > 0) {
    writeLine(`Sensitive files: ${stats.sensitiveFiles.join(", ")}`);
  }
  if (stats.uiFiles.length > 0) {
    writeLine(`UI files: ${stats.uiFiles.join(", ")}`);
  }
}

function assertGateResult(name, result) {
  if (!result.ok) {
    throw new Error(`${name} failed:\n${result.messages.join("\n")}`);
  }
  writeLine(`${name}: PASS`);
}

function runPreflight(args) {
  assertMirrorSync();
  const required = [
    ["git", ["--version"]],
    ["node", ["--version"]],
  ];
  if (args.issue) {
    required.push(["multica", ["version"]]);
  }
  assertCommands(required);
  writeLine("preflight: PASS");
}

function runMulticaIntake(args) {
  if (!args.issue) {
    throw new Error("Multica intake requires --issue <issue-id>.");
  }
  runCommand("multica", ["issue", "get", args.issue, "--output", "json"], { dryRun: args.dryRun });
  runCommand("multica", ["issue", "comment", "list", args.issue], { dryRun: args.dryRun });
  runCommand("multica", ["issue", "runs", args.issue, "--output", "json"], { dryRun: args.dryRun });
  writeLine(args.dryRun ? "multica-intake: DRY-RUN (not evidence)" : "multica-intake: PASS");
}

function runReview(args) {
  const stats = collectWorktreeStats();
  printStats(stats);
  assertGateResult("review", evaluateReviewGate(stats, args));
}

function runGitGate() {
  const stats = collectWorktreeStats();
  printStats(stats);
  assertGateResult("git", evaluateBatchGate(stats));
}

function runValidation(args) {
  const commands = buildValidationCommands(args.profile);
  for (const spec of commands) {
    runCommand(spec.command, spec.args, { cwd: spec.cwd, dryRun: args.dryRun });
  }
  writeLine(args.dryRun ? "validation: DRY-RUN (not evidence)" : "validation: PASS");
}

function runAll(args) {
  runPreflight(args);
  if (args.issue) {
    runMulticaIntake(args);
  }
  runReview(args);
  runGitGate();
  runValidation(args);
}

function main() {
  try {
    const args = parseCliArgs(argv.slice(2));
    if (args.gate === "all") {
      runAll(args);
    } else if (args.gate === "git") {
      runGitGate(args);
    } else if (args.gate === "multica-intake") {
      runMulticaIntake(args);
    } else if (args.gate === "preflight") {
      runPreflight(args);
    } else if (args.gate === "review") {
      runReview(args);
    } else if (args.gate === "validation") {
      runValidation(args);
    }
  } catch (error) {
    writeError(error instanceof Error ? error.message : String(error));
    exit(1);
  }
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  main();
}

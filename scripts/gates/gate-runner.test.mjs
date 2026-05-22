import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildValidationCommands,
  buildSpawnSpec,
  collectDiffStatsFromNumstat,
  countTextLinesForNumstat,
  evaluateBatchGate,
  evaluateReviewGate,
  parseCliArgs,
  resolveExecutable,
} from "./gate-runner.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const servicesApiDir = resolve(repoRoot, "services", "api");

test("parseCliArgs parses gate flags", () => {
  const args = parseCliArgs([
    "validation",
    "--profile",
    "docs",
    "--issue",
    "SIK-12",
    "--reviewed",
    "--ui",
    "--browser-smoke",
    "--dry-run",
  ]);

  assert.deepEqual(args, {
    browserSmoke: true,
    dryRun: true,
    gate: "validation",
    issue: "SIK-12",
    profile: "docs",
    reviewed: true,
    ui: true,
  });
});

test("collectDiffStatsFromNumstat ignores binary rows and counts doc/code files", () => {
  const stats = collectDiffStatsFromNumstat(
    [
      "42\t0\tdocs/engineering/git-workflow.md",
      "75\t8\tscripts/gates/gate-runner.mjs",
      "-\t-\tpublic/logo.png",
      "1\t1\tpackage.json",
    ].join("\n"),
  );

  assert.deepEqual(stats, {
    changedFiles: 4,
    codeChangedLines: 83,
    deletions: 9,
    docAddedLines: 42,
    insertions: 118,
    netAddedLines: 109,
    sensitiveFiles: [],
    totalChangedLines: 127,
    uiFiles: [],
  });
});

test("countTextLinesForNumstat matches git numstat text line semantics", () => {
  assert.equal(countTextLinesForNumstat(""), 0);
  assert.equal(countTextLinesForNumstat("one"), 1);
  assert.equal(countTextLinesForNumstat("one\n"), 1);
  assert.equal(countTextLinesForNumstat("one\n\ntwo\n"), 3);
});

test("collectDiffStatsFromNumstat preserves blank lines from untracked file rows", () => {
  const stats = collectDiffStatsFromNumstat(
    `${countTextLinesForNumstat("one\n\ntwo\n")}\t0\tdocs/engineering/example.md`,
  );

  assert.equal(stats.docAddedLines, 3);
  assert.equal(stats.totalChangedLines, 3);
});

test("evaluateReviewGate requires independent review for threshold hits", () => {
  const result = evaluateReviewGate(
    {
      changedFiles: 2,
      codeChangedLines: 101,
      deletions: 0,
      docAddedLines: 0,
      insertions: 101,
      netAddedLines: 101,
      sensitiveFiles: [],
      totalChangedLines: 101,
      uiFiles: [],
    },
    { browserSmoke: false, reviewed: false, ui: false },
  );

  assert.equal(result.ok, false);
  assert.match(result.messages.join("\n"), /Independent subagent review required/);
});

test("evaluateReviewGate detects UI changes from paths", () => {
  const result = evaluateReviewGate(
    {
      changedFiles: 1,
      codeChangedLines: 1,
      deletions: 0,
      docAddedLines: 0,
      insertions: 1,
      netAddedLines: 1,
      sensitiveFiles: [],
      totalChangedLines: 1,
      uiFiles: ["apps/web/src/views/Home.tsx"],
    },
    { browserSmoke: false, reviewed: true, ui: false },
  );

  assert.equal(result.ok, false);
  assert.match(result.messages.join("\n"), /Browser smoke required/);
});

test("evaluateReviewGate requires browser smoke for UI work", () => {
  const result = evaluateReviewGate(
    {
      changedFiles: 1,
      codeChangedLines: 1,
      deletions: 0,
      docAddedLines: 0,
      insertions: 1,
      netAddedLines: 1,
      sensitiveFiles: [],
      totalChangedLines: 1,
      uiFiles: [],
    },
    { browserSmoke: false, reviewed: true, ui: true },
  );

  assert.equal(result.ok, false);
  assert.match(result.messages.join("\n"), /Browser smoke required/);
});

test("evaluateBatchGate enforces file and net-add limits", () => {
  const result = evaluateBatchGate({
    changedFiles: 16,
    codeChangedLines: 300,
    deletions: 0,
    docAddedLines: 0,
    insertions: 401,
    netAddedLines: 401,
    sensitiveFiles: [],
    totalChangedLines: 401,
    uiFiles: [],
  });

  assert.equal(result.ok, false);
  assert.match(result.messages.join("\n"), /<=15 files/);
  assert.match(result.messages.join("\n"), /<=400 net added lines/);
  assert.match(result.messages.join("\n"), /<=100 changed lines/);
});

test("buildValidationCommands returns explicit profiles", () => {
  assert.deepEqual(buildValidationCommands("docs"), [
    { command: "node", args: ["--test", "scripts/gates/*.test.mjs"], cwd: repoRoot },
  ]);

  assert.deepEqual(buildValidationCommands("backend-first"), [
    { command: "python", args: ["-m", "ruff", "check", "src", "tests"], cwd: servicesApiDir },
    { command: "python", args: ["-m", "mypy", "src"], cwd: servicesApiDir },
    { command: "python", args: ["-m", "pytest"], cwd: servicesApiDir },
    { command: "node", args: ["--test", "scripts/gates/*.test.mjs"], cwd: repoRoot },
  ]);

  assert.deepEqual(buildValidationCommands("full"), [
    { command: "npm", args: ["run", "typecheck"], cwd: repoRoot },
    { command: "npm", args: ["run", "lint"], cwd: repoRoot },
    { command: "npm", args: ["test"], cwd: repoRoot },
    { command: "node", args: ["--test", "scripts/gates/*.test.mjs"], cwd: repoRoot },
  ]);
});

test("buildValidationCommands anchors backend-first cwd to repo paths", () => {
  const commands = buildValidationCommands("backend-first");

  for (const command of commands.slice(0, 3)) {
    assert.equal(command.cwd, servicesApiDir);
  }
  assert.equal(commands.at(-1)?.cwd, repoRoot);
});

test("buildSpawnSpec wraps npm through cmd.exe on Windows", () => {
  assert.deepEqual(buildSpawnSpec("npm", ["--version"], "win32"), {
    args: ["/d", "/s", "/c", "npm.cmd --version"],
    command: "cmd.exe",
  });
  assert.deepEqual(buildSpawnSpec("npm", ["run", "type check"], "win32"), {
    args: ["/d", "/s", "/c", 'npm.cmd run "type check"'],
    command: "cmd.exe",
  });
});

test("resolveExecutable exposes the actual process executable", () => {
  assert.equal(resolveExecutable("npm", "win32"), "cmd.exe");
  assert.equal(resolveExecutable("npm", "linux"), "npm");
  assert.equal(resolveExecutable("node", "win32"), "node");
});

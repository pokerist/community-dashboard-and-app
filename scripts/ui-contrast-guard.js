#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, "apps", "admin-web", "src");
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const issues = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    scanFile(fullPath);
  }
}

function addIssue(file, reason, snippet) {
  issues.push({ file, reason, snippet });
}

function scanFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const tagRegex = /<(Button|a|Link)\b([^>]*)>/gs;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(raw)) !== null) {
    const tagName = tagMatch[1];
    const attrs = tagMatch[2] || "";
    const classMatch = attrs.match(/className\s*=\s*(["'`])([\s\S]*?)\1/);
    if (!classMatch) continue;
    const classValue = classMatch[2];
    const compactTag = `${tagName} ${attrs}`.replace(/\s+/g, " ").slice(0, 240);

    // Skip dynamic conditional templates to reduce false positives from mutually exclusive classes.
    const hasTemplateCondition = classValue.includes("?") && classValue.includes(":");
    if (!hasTemplateCondition) {
      const hasWhiteText = /\btext-white\b/.test(classValue);
      const hasWhiteBg =
        /\bbg-white\b/.test(classValue) ||
        /\bbg-\[#fff/i.test(classValue) ||
        /\bbg-\[#ffffff/i.test(classValue);
      if (hasWhiteText && hasWhiteBg) {
        addIssue(filePath, "text-white combined with white background", compactTag);
      }
    }

    if (
      tagName === "Button" &&
      /variant\s*=\s*["']outline["']/.test(attrs) &&
      /\btext-white\b/.test(classValue)
    ) {
      addIssue(filePath, "outline button uses text-white (poor contrast risk)", compactTag);
    }

    if (tagName !== "Button" && /\btext-white\b/.test(classValue)) {
      const hasExplicitDarkBg =
        /bg-(slate|gray|zinc|neutral|stone|black|primary|destructive|red|green|blue)/.test(
          classValue,
        ) || /\bbg-\[#([0-5][0-9a-fA-F]{5}|[0-2][0-9a-fA-F]{5})\b/.test(classValue);
      if (!hasExplicitDarkBg) {
        addIssue(
          filePath,
          "link uses text-white without explicit dark background",
          compactTag,
        );
      }
    }
  }
}

if (!fs.existsSync(TARGET_DIR)) {
  console.log(`UI contrast guard skipped: directory not found -> ${TARGET_DIR}`);
  process.exit(0);
}

walk(TARGET_DIR);

if (issues.length === 0) {
  console.log("UI contrast guard passed: no risky class patterns detected.");
  process.exit(0);
}

console.error(`UI contrast guard failed with ${issues.length} issue(s):`);
for (const issue of issues) {
  const rel = path.relative(ROOT, issue.file);
  console.error(`- ${rel}: ${issue.reason}`);
  console.error(`  ${issue.snippet}`);
}
process.exit(1);

#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");

const requiredFrontMatter = [
  "title",
  "description",
  "topic",
  "level",
  "date",
  "readingTime",
  "tags",
  "image",
  "imageAlt",
  "evidenceMode",
];
const evidenceModes = new Set(["strategy", "experiment"]);
const reservedEvidenceLabels = new Set(["strategy", "experiment", "trend", "research-backed", "evidence-backed", "experiment-backed"]);
const internalEvidenceFramingPattern =
  /\bDIY project\b|\boperator project\b|\bresearch-backed article\b|\bevidence-backed article\b|\bexperiment-backed article\b|\bstrategy article\b|\bexperiment article\b|\btrend article\b|\bevidenceMode\b|\bevidence mode\b|operator\/diy-project-blogs/i;
const prohibitedPatterns = [
  { label: "local model catalog health-check article", pattern: /local[- ]model[- ]catalog[- ]health[- ]check/i },
  { label: "local model catalog endpoint", pattern: /http:\/\/localhost:1234\/api\/v1\/models/i },
  { label: "local model catalog run status", pattern: /model catalog status|catalog status unavailable|unavailable catalog/i },
  { label: "operator filesystem path", pattern: /\/Users\/|\/private\/tmp\//i },
  { label: "operator AWS profile", pattern: /AWS_PROFILE=macbook-terraform|macbook-terraform/i },
  { label: "draft placeholder", pattern: /\b(TODO|TBD|FIXME|coming soon|placeholder|lorem ipsum|dummy article|sample article|draft only|not implemented)\b/i },
  { label: "local fetch failure", pattern: /\bfetch failed\b|status:\s*unavailable/i },
  { label: "lightweight production-extension section", pattern: /^##\s+Production extensions?\s*$/im },
  { label: "deterministic fixture article language", pattern: /deterministic fixture|fixture formulas/i },
  { label: "internal evidence-mode article framing", pattern: internalEvidenceFramingPattern, markdownOnly: true },
  {
    label: "generic hype or filler phrasing",
    pattern: /\b(game[- ]changing|unlock the power|rapidly evolving landscape|in today's fast[- ]paced|cutting[- ]edge solution|revolutionary)\b/i,
  },
];

function parseArgs(argv) {
  const args = {
    articlesDir: path.join(rootDir, "content", "articles"),
    assetsDir: path.join(rootDir, "content", "assets"),
    sourceLabel: "public content",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    args[key] = value;
    index += 1;
  }

  return {
    articlesDir: path.resolve(args.articlesDir),
    assetsDir: path.resolve(args.assetsDir),
    sourceLabel: args.sourceLabel,
  };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listMarkdownFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(dirPath, entry.name))
    .sort();
}

function parseFrontMatter(raw, filePath) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { metadata: {}, markdown: raw, issue: `Missing front matter in ${filePath}` };
  }

  const metadata = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    if (separator === -1) {
      return { metadata, markdown: match[2], issue: `Invalid front matter line: ${line}` };
    }
    metadata[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  return { metadata, markdown: match[2].trim(), issue: "" };
}

function wordCount(value) {
  return (value.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) || []).length;
}

function countMatches(value, pattern) {
  return (value.match(pattern) || []).length;
}

function headingTitles(markdown) {
  return [...markdown.matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) => match[1].trim());
}

function markdownLinkCount(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g)].length;
}

function metadataTags(value = "") {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function assetPathFor(image, assetsDir) {
  const prefix = "/content/v1/assets/";
  if (!image.startsWith(prefix)) return "";
  return path.join(assetsDir, image.slice(prefix.length));
}

function parseNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function svgDimensions(svg) {
  const viewBox = svg.match(/\bviewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (viewBox) {
    return {
      width: parseNumber(viewBox[1]),
      height: parseNumber(viewBox[2]),
    };
  }

  const width = svg.match(/<svg\b[^>]*\bwidth=["']([\d.]+)(?:px)?["']/i);
  const height = svg.match(/<svg\b[^>]*\bheight=["']([\d.]+)(?:px)?["']/i);
  return {
    width: width ? parseNumber(width[1]) : 0,
    height: height ? parseNumber(height[1]) : 0,
  };
}

function pngDimensions(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== signature) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  return null;
}

async function validateImageAsset(filePath) {
  const issues = [];
  const extension = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);
  let dimensions = null;

  if (buffer.length < 200) {
    issues.push("Article image asset is too small to be a useful visual.");
  }

  if (extension === ".svg") {
    const svg = buffer.toString("utf8");
    if (!/<svg\b/i.test(svg)) issues.push("SVG article image is missing an <svg> root.");
    if (!/<title\b/i.test(svg)) issues.push("SVG article image needs a <title> for accessibility.");
    if (!/<desc\b/i.test(svg)) issues.push("SVG article image needs a <desc> for accessibility.");
    if (/href=["']https?:\/\//i.test(svg)) {
      issues.push("SVG article image must not depend on remote linked assets.");
    }
    dimensions = svgDimensions(svg);
  } else if (extension === ".png") {
    dimensions = pngDimensions(buffer);
  } else if (extension === ".jpg" || extension === ".jpeg") {
    dimensions = jpegDimensions(buffer);
  } else {
    issues.push("Article image asset must be SVG, PNG, or JPEG.");
  }

  if (!dimensions || !dimensions.width || !dimensions.height) {
    issues.push("Article image asset must expose readable width and height.");
    return issues;
  }

  const ratio = dimensions.width / dimensions.height;
  if (dimensions.width < 640 || dimensions.height < 320) {
    issues.push("Article image asset should be at least 640x320 for article and social previews.");
  }
  if (ratio < 1.2 || ratio > 2.8) {
    issues.push("Article image aspect ratio should be landscape and fit the article hero slot.");
  }

  return issues;
}

async function validateArticle(filePath, assetsDir) {
  const raw = await fs.readFile(filePath, "utf8");
  const { metadata, markdown, issue } = parseFrontMatter(raw, filePath);
  const issues = [];
  const fileName = path.basename(filePath);

  if (issue) issues.push(issue);
  for (const field of requiredFrontMatter) {
    if (!metadata[field]) issues.push(`Missing front matter field "${field}".`);
  }

  if (metadata.title && (metadata.title.length < 24 || metadata.title.length > 90)) {
    issues.push("Title should be 24-90 characters and match a concrete search intent.");
  }
  if (metadata.description && (metadata.description.length < 80 || metadata.description.length > 180)) {
    issues.push("Description should be 80-180 characters and explain the tutorial outcome.");
  }
  if (metadata.date && !/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)) {
    issues.push("Date must use YYYY-MM-DD format.");
  }

  const readingTime = Number(metadata.readingTime);
  if (!Number.isFinite(readingTime) || readingTime < 8 || readingTime > 60) {
    issues.push("readingTime must be a realistic 8-60 minute value.");
  }

  const tags = metadataTags(metadata.tags);
  if (tags.length < 3) {
    issues.push("At least three specific tags are required.");
  }
  if (metadata.topic && reservedEvidenceLabels.has(metadata.topic.toLowerCase())) {
    issues.push("topic must describe the customer-facing domain, not the internal evidence mode.");
  }
  if (tags.some((tag) => reservedEvidenceLabels.has(tag.toLowerCase()))) {
    issues.push("tags must describe customer-facing domains or techniques, not the internal evidence mode.");
  }
  if (metadata.evidenceMode && !evidenceModes.has(metadata.evidenceMode)) {
    issues.push('evidenceMode must be either "strategy" or "experiment".');
  }

  if (metadata.image) {
    if (!metadata.image.startsWith("/content/v1/assets/")) {
      issues.push("Article image must be an article-specific /content/v1/assets/* asset.");
    } else {
      const articleImagePath = assetPathFor(metadata.image, assetsDir);
      if (!(await exists(articleImagePath))) {
        issues.push(`Missing article image asset: ${metadata.image}`);
      } else {
        const imageIssues = await validateImageAsset(articleImagePath);
        issues.push(...imageIssues.map((imageIssue) => `${metadata.image}: ${imageIssue}`));
      }
    }
  }
  if (metadata.imageAlt && metadata.imageAlt.length < 30) {
    issues.push("imageAlt must be descriptive and at least 30 characters.");
  }

  const headings = headingTitles(markdown);
  const bodyWords = wordCount(markdown);
  const proseWords = wordCount(markdown.replace(/```[\s\S]*?```/g, " "));
  const codeBlocks = countMatches(markdown, /^```(?!output\b)[A-Za-z0-9_-]*/gm);
  const outputBlocks = countMatches(markdown, /^```output\b/gm);
  const evidenceMode = metadata.evidenceMode || "";

  if (bodyWords < 1800) issues.push("Article is too thin for customer publishing; expected at least 1800 total words including code.");
  if (proseWords < 1300) issues.push("Article needs more explanatory prose; expected at least 1300 non-code words.");
  if (headings.filter((heading) => !heading.startsWith("#")).length < 8) {
    issues.push("Article needs at least eight h2/h3 sections for scanability and TOC quality.");
  }
  if (evidenceMode === "experiment" && codeBlocks < 3) issues.push("evidenceMode=experiment requires at least three implementation code blocks.");
  if (evidenceMode === "experiment" && outputBlocks < 1) issues.push("evidenceMode=experiment requires at least one output block.");
  if (evidenceMode === "experiment" && !headings.some((heading) => /reproduc/i.test(heading))) {
    issues.push("evidenceMode=experiment requires a reproducibility section.");
  }
  if (evidenceMode === "strategy" && markdownLinkCount(markdown) < 5) {
    issues.push("evidenceMode=strategy requires at least five current primary or high-signal sources.");
  }
  if (evidenceMode === "strategy" && !headings.some((heading) => /source|signal|research/i.test(heading))) {
    issues.push("evidenceMode=strategy requires a source/signal/research section.");
  }
  if (!headings.some((heading) => /production readiness|operating model|implementation plan/i.test(heading))) {
    issues.push("Article must include production readiness, operating model, or implementation plan guidance.");
  }
  if (!headings.some((heading) => /failure|limitation|error analysis/i.test(heading))) {
    issues.push("Article must include a failure-analysis or limitation section.");
  }
  if (!/\b(evaluation|metric|measure|benchmark|threshold|score|test|baseline|recall|precision|latency|cost|guardrail|trace)\b/i.test(markdown)) {
    issues.push("Article must include an empirical evaluation, metric, test, threshold, or operational signal.");
  }
  if (!/\b(failures?|limitations?|risks?|guardrails?|rollback|debugging?|regressions?)\b/i.test(markdown)) {
    issues.push("Article must explain failure modes, limitations, guardrails, rollback criteria, or debugging paths.");
  }

  for (const rule of prohibitedPatterns) {
    const target = rule.markdownOnly ? markdown : raw;
    if (rule.pattern.test(target)) {
      issues.push(`Contains ${rule.label}.`);
    }
  }

  return { fileName, issues };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const articleFiles = await listMarkdownFiles(args.articlesDir);
  if (!articleFiles.length) {
    throw new Error(`No Markdown articles found in ${args.articlesDir}`);
  }

  const results = [];
  for (const articleFile of articleFiles) {
    results.push(await validateArticle(articleFile, args.assetsDir));
  }

  const failures = results.filter((result) => result.issues.length);
  if (failures.length) {
    console.error(`Public content gate failed for ${args.sourceLabel}. Nothing should be published.`);
    for (const failure of failures) {
      console.error(`\n${failure.fileName}`);
      for (const issue of failure.issues) {
        console.error(`- ${issue}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Public content gate passed for ${articleFiles.length} articles in ${args.sourceLabel}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

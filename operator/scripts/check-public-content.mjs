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
const qualityProfiles = new Set(["standard", "automation"]);
const qualityTiers = new Set(["deep-research", "timely-analysis"]);
const editorialScoreKeys = [
  "questionValue",
  "technicalDepth",
  "evidenceTraceability",
  "methodologicalRigor",
  "decisionUsefulness",
  "clarityDensity",
  "visualEvidence",
];
const reservedEvidenceLabels = new Set(["strategy", "experiment", "trend", "research-backed", "evidence-backed", "experiment-backed"]);
const internalEvidenceFramingPattern =
  /\bDIY project\b|\boperator project\b|\bresearch-backed article\b|\bevidence-backed article\b|\bexperiment-backed article\b|\bstrategy article\b|\bexperiment article\b|\btrend article\b|\bevidenceMode\b|\bevidence mode\b|\bqualityTier\b|\bevidenceProject\b|\bevidenceManifest\b|\beditorial-review\b|operator\/diy-project-blogs/i;
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
    qualityProfile: "standard",
    editorialReview: "",
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
    qualityProfile: args.qualityProfile,
    editorialReview: args.editorialReview ? path.resolve(args.editorialReview) : "",
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
  return markdownLinks(markdown).length;
}

function markdownLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g)].map(
    (match) => match[1],
  );
}

function uniqueMarkdownLinks(markdown) {
  return [...new Set(markdownLinks(markdown))];
}

function sourceDomainCount(markdown) {
  const domains = new Set();
  for (const url of uniqueMarkdownLinks(markdown)) {
    try {
      domains.add(new URL(url).hostname.replace(/^www\./, ""));
    } catch {
      // Invalid URLs are already ineffective as Markdown sources.
    }
  }
  return domains.size;
}

function markdownTableCount(markdown) {
  return markdownTableStats(markdown).length;
}

function splitMarkdownTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
}

function markdownTableStats(markdown) {
  const lines = markdown.split(/\r?\n/);
  const tables = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = lines[index].trim();
    const divider = lines[index + 1].trim();
    if (
      !header.includes("|") ||
      !/^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(divider)
    ) {
      continue;
    }

    let end = index + 2;
    let rows = 0;
    while (end < lines.length && lines[end].trim() && lines[end].includes("|")) {
      rows += 1;
      end += 1;
    }
    const context = lines.slice(Math.max(0, index - 3), Math.min(lines.length, end + 4)).join("\n");
    tables.push({
      columns: splitMarkdownTableRow(header).length,
      rows,
      sourced: markdownLinkCount(context) > 0,
    });
    index = end - 1;
  }
  return tables;
}

function numericSignalCount(markdown) {
  return countMatches(markdown, /\b\d+(?:\.\d+)?(?:%|x|k|m|b|ms|s|tokens?)?\b/gi);
}

function measurementSignalCount(markdown) {
  return countMatches(
    markdown,
    /\b(?:n\s*=\s*\d+|p\s*[<=>]\s*0?\.\d+|\d+(?:\.\d+)?\s*(?:%|ms|milliseconds?|seconds?|minutes?|hours?|tokens?|parameters?|samples?|requests?|runs?|seeds?|GB|MB|TB|USD|dollars?|x)|\d+\.\d{2,})(?=\s|[.,;:)\]}]|$)/gi,
  );
}

function datedSourceSignalCount(markdown) {
  return countMatches(
    markdown,
    /\b(?:20\d{2}-\d{2}-\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+20\d{2})\b/g,
  );
}

function fencedBlocks(markdown) {
  return [...markdown.matchAll(/^```([A-Za-z0-9_-]*)\s*\n([\s\S]*?)^```\s*$/gm)].map(
    (match) => ({ language: match[1] || "text", body: match[2] }),
  );
}

function nonEmptyLineCount(value) {
  return value.split(/\r?\n/).filter((line) => line.trim()).length;
}

function normalizedWords(value) {
  return (value.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || []).filter(Boolean);
}

function proseShingles(markdown, size = 5) {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, (match) => match.replace(/\]\([^)]+\)/, "]"))
    .replace(/^#{1,6}\s+/gm, " ")
    .replace(/[|*_>`#-]/g, " ");
  const words = normalizedWords(prose);
  const shingles = new Set();
  for (let index = 0; index <= words.length - size; index += 1) {
    shingles.add(words.slice(index, index + size).join(" "));
  }
  return shingles;
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function titleSimilarity(left, right) {
  return jaccard(new Set(normalizedWords(left)), new Set(normalizedWords(right)));
}

function longParagraphFingerprints(markdown) {
  return new Set(
    markdown
      .replace(/```[\s\S]*?```/g, "")
      .split(/\n\s*\n/)
      .map((paragraph) => normalizedWords(paragraph).join(" "))
      .filter((paragraph) => paragraph.split(" ").length >= 35),
  );
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
    const rootAttributes = svg.match(/<svg\b([^>]*)>/i)?.[1] || "";
    const attributeNames = [...rootAttributes.matchAll(/\s([:\w-]+)\s*=/g)].map((match) => match[1].toLowerCase());
    if (new Set(attributeNames).size !== attributeNames.length) {
      issues.push("SVG article image has duplicate root attributes and is not valid XML.");
    }
    if (!/<title\b/i.test(svg)) issues.push("SVG article image needs a <title> for accessibility.");
    if (!/<desc\b/i.test(svg)) issues.push("SVG article image needs a <desc> for accessibility.");
    if (/href=["']https?:\/\//i.test(svg)) {
      issues.push("SVG article image must not depend on remote linked assets.");
    }
    if (!/data-visual-quality=["']publication["']/i.test(svg)) {
      issues.push("SVG article image must declare data-visual-quality=publication.");
    }
    if (!svg.includes("fieldbook-visual-system:v2")) {
      issues.push("SVG article image has not passed through the shared publication visual system.");
    }
    if (!/data-text-fit=["']bounded["']/i.test(svg)) {
      issues.push("SVG article image has not passed the bounded-text fit check.");
    }
    if (/\b(?:Arial|Helvetica)\b/i.test(svg)) {
      issues.push("SVG article image uses a generic Arial/Helvetica slide font.");
    }
    const visualMarks = countMatches(svg, /<(?:rect|path|line|circle|ellipse|polyline|polygon)\b/gi);
    if (visualMarks < 12) {
      issues.push("SVG article image is structurally too sparse for a publication figure.");
    }
    const oversizedRadius = [...svg.matchAll(/\brx=["']([\d.]+)["']/gi)].some(
      (match) => Number(match[1]) > 12,
    );
    if (oversizedRadius) {
      issues.push("SVG article image uses oversized rounded-card geometry.");
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

function resolveRepoPath(value, requiredPrefix = "") {
  if (!value || path.isAbsolute(value) || value.split(/[\\/]/).includes("..")) return "";
  if (requiredPrefix && !value.startsWith(requiredPrefix)) return "";
  const resolved = path.resolve(rootDir, value);
  return resolved.startsWith(`${rootDir}${path.sep}`) ? resolved : "";
}

async function validateEvidenceManifest(metadata) {
  const issues = [];
  const projectValue = metadata.evidenceProject || "";
  const manifestValue = metadata.evidenceManifest || "";
  const projectPath = resolveRepoPath(projectValue, "operator/diy-project-blogs/projects/");
  const manifestPath = resolveRepoPath(manifestValue, "operator/diy-project-blogs/projects/");

  if (!projectPath) {
    issues.push("Deep research requires a repo-relative evidenceProject under operator/diy-project-blogs/projects/.");
  }
  if (!manifestPath || (projectPath && !manifestPath.startsWith(`${projectPath}${path.sep}`))) {
    issues.push("Deep research requires evidenceManifest inside its evidenceProject.");
  }
  if (!projectPath || !manifestPath) return issues;

  try {
    const projectStat = await fs.stat(projectPath);
    if (!projectStat.isDirectory()) issues.push("evidenceProject must resolve to a directory.");
  } catch {
    issues.push("evidenceProject does not exist.");
  }

  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {
    issues.push("evidenceManifest must exist and contain valid JSON.");
    return issues;
  }

  if (manifest.version !== 1) issues.push("evidenceManifest version must be 1.");
  if (typeof manifest.hypothesis !== "string" || manifest.hypothesis.trim().length < 40) {
    issues.push("evidenceManifest needs a specific hypothesis of at least 40 characters.");
  }
  if (typeof manifest.claimBoundary !== "string" || manifest.claimBoundary.trim().length < 40) {
    issues.push("evidenceManifest needs an explicit claimBoundary of at least 40 characters.");
  }
  if (
    !Array.isArray(manifest.design?.baselines) ||
    manifest.design.baselines.length < 1 ||
    manifest.design.baselines.some((baseline) => typeof baseline !== "string" || baseline.trim().length < 3)
  ) {
    issues.push("evidenceManifest design requires at least one baseline.");
  }
  if (
    !Array.isArray(manifest.design?.controls) ||
    manifest.design.controls.length < 1 ||
    manifest.design.controls.some((control) => typeof control !== "string" || control.trim().length < 3)
  ) {
    issues.push("evidenceManifest design requires at least one control or ablation.");
  }
  if (!Number.isFinite(manifest.design?.repeats) || manifest.design.repeats < 2) {
    issues.push("evidenceManifest design.repeats must be at least 2.");
  }
  if (
    !Array.isArray(manifest.reproduction?.commands) ||
    manifest.reproduction.commands.length < 1 ||
    manifest.reproduction.commands.some((command) => typeof command !== "string" || command.trim().length < 3)
  ) {
    issues.push("evidenceManifest needs at least one reproduction command.");
  }

  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  if (artifacts.length < 3) {
    issues.push("evidenceManifest needs at least three traceable artifacts.");
  } else {
    let existingArtifacts = 0;
    for (const artifact of artifacts) {
      const artifactValue = typeof artifact === "string" ? artifact : artifact?.path;
      if (!artifactValue || path.isAbsolute(artifactValue) || artifactValue.split(/[\\/]/).includes("..")) {
        continue;
      }
      if (artifact?.sha256 && !/^[a-fA-F0-9]{64}$/.test(artifact.sha256)) continue;
      const artifactPath = path.resolve(projectPath, artifactValue);
      if (!artifactPath.startsWith(`${projectPath}${path.sep}`)) continue;
      try {
        const artifactStat = await fs.stat(artifactPath);
        if (artifactStat.isFile() && artifactStat.size > 0) existingArtifacts += 1;
      } catch {
        // Missing artifacts are reported through the aggregate count below.
      }
    }
    if (existingArtifacts < 3) {
      issues.push("evidenceManifest must point to at least three existing project artifacts.");
    }
  }

  return issues;
}

function editorialReviewDocumentIssues(reviewDocument, results) {
  const issues = [];
  if (reviewDocument.version !== 1) issues.push("Editorial review version must be 1.");
  if (!Array.isArray(reviewDocument.reviews)) {
    return [...issues, "Editorial review must contain a reviews array."];
  }

  const expectedSlugs = results.map((result) => result.fileName.replace(/\.md$/, ""));
  const reviewedSlugs = reviewDocument.reviews.map((review) => review.slug);
  if (new Set(reviewedSlugs).size !== reviewedSlugs.length) {
    issues.push("Editorial review contains duplicate slug entries.");
  }

  for (const slug of expectedSlugs) {
    const review = reviewDocument.reviews.find((candidate) => candidate.slug === slug);
    if (!review) {
      issues.push(`Editorial review is missing ${slug}.`);
      continue;
    }
    if (review.verdict !== "publish-ready") {
      issues.push(`${slug} editorial verdict must be publish-ready.`);
    }

    const scores = editorialScoreKeys.map((key) => review.scores?.[key]);
    for (let index = 0; index < scores.length; index += 1) {
      if (!Number.isInteger(scores[index]) || scores[index] < 4 || scores[index] > 5) {
        issues.push(`${slug} editorial score ${editorialScoreKeys[index]} must be an integer from 4 to 5.`);
      }
    }
    if (scores.every(Number.isFinite)) {
      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      if (average < 4.3) issues.push(`${slug} editorial score average must be at least 4.3.`);
    }

    for (const field of ["strongestCounterargument", "unsupportedClaimRisk", "reproductionBarrier"]) {
      if (typeof review[field] !== "string" || review[field].trim().length < 40) {
        issues.push(`${slug} editorial review needs a substantive ${field}.`);
      }
    }
    if (
      !Array.isArray(review.revisions) ||
      review.revisions.length < 2 ||
      review.revisions.some((revision) => typeof revision !== "string" || revision.trim().length < 20)
    ) {
      issues.push(`${slug} editorial review needs at least two substantive revisions.`);
    }
  }

  for (const slug of reviewedSlugs) {
    if (!expectedSlugs.includes(slug)) issues.push(`Editorial review contains unexpected slug ${slug}.`);
  }
  return issues;
}

async function validateEditorialReview(filePath, results) {
  if (!filePath) return ["Automation profile requires --editorial-review with a structured review JSON file."];

  try {
    const reviewDocument = JSON.parse(await fs.readFile(filePath, "utf8"));
    return editorialReviewDocumentIssues(reviewDocument, results);
  } catch {
    return ["Editorial review file must exist and contain valid JSON."];
  }
}

function sharedLongParagraphCount(leftMarkdown, rightMarkdown) {
  const left = longParagraphFingerprints(leftMarkdown);
  const right = longParagraphFingerprints(rightMarkdown);
  let shared = 0;
  for (const paragraph of left) if (right.has(paragraph)) shared += 1;
  return shared;
}

function batchOriginalityIssues(results) {
  const issues = [];
  for (let leftIndex = 0; leftIndex < results.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < results.length; rightIndex += 1) {
      const left = results[leftIndex];
      const right = results[rightIndex];
      const proseSimilarity = jaccard(proseShingles(left.markdown), proseShingles(right.markdown));
      if (proseSimilarity >= 0.25) {
        issues.push(
          `${left.fileName} and ${right.fileName} are too structurally similar (${proseSimilarity.toFixed(2)} shingle similarity).`,
        );
      }
      if (sharedLongParagraphCount(left.markdown, right.markdown) > 0) {
        issues.push(`${left.fileName} and ${right.fileName} reuse a long prose paragraph.`);
      }
    }
  }
  return issues;
}

async function existingLibraryOriginalityIssues(results, articlesDir) {
  const committedDir = path.join(rootDir, "content", "articles");
  if (path.resolve(articlesDir) === path.resolve(committedDir)) return [];

  const issues = [];
  const committedFiles = await listMarkdownFiles(committedDir);
  const committed = [];
  for (const filePath of committedFiles) {
    const parsed = parseFrontMatter(await fs.readFile(filePath, "utf8"), filePath);
    committed.push({
      fileName: path.basename(filePath),
      title: parsed.metadata.title || "",
      markdown: parsed.markdown,
      shingles: proseShingles(parsed.markdown),
    });
  }

  for (const candidate of results) {
    for (const prior of committed) {
      if (candidate.fileName === prior.fileName) {
        issues.push(`${candidate.fileName} reuses an existing article slug.`);
        continue;
      }
      const proseSimilarity = jaccard(proseShingles(candidate.markdown), prior.shingles);
      const headingSimilarity = titleSimilarity(candidate.metadata.title || "", prior.title);
      if (proseSimilarity >= 0.45 || headingSimilarity >= 0.8) {
        issues.push(
          `${candidate.fileName} is too close to ${prior.fileName} (prose ${proseSimilarity.toFixed(2)}, title ${headingSimilarity.toFixed(2)}).`,
        );
      } else if (sharedLongParagraphCount(candidate.markdown, prior.markdown) > 0) {
        issues.push(`${candidate.fileName} reuses a long prose paragraph from ${prior.fileName}.`);
      }
    }
  }
  return issues;
}

function runSelfTests() {
  const sourcedTable = [
    "Source: [provider release](https://provider.example/release)",
    "",
    "| Model | Latency | Score |",
    "| --- | ---: | ---: |",
    "| A | 32 ms | 81.4 |",
    "| B | 45 ms | 84.1 |",
    "| C | not reported | 79.8 |",
  ].join("\n");
  const tables = markdownTableStats(sourcedTable);
  if (tables.length !== 1 || tables[0].columns !== 3 || tables[0].rows !== 3 || !tables[0].sourced) {
    throw new Error("Self-test failed: sourced comparison table detection");
  }
  if (measurementSignalCount("n = 24, latency 32 ms, 95%, p < 0.05, released 2026-07-10") !== 4) {
    throw new Error("Self-test failed: measured-signal detection");
  }
  if (datedSourceSignalCount("2026-07-10; July 9, 2026; 2026-07-08") !== 3) {
    throw new Error("Self-test failed: dated-source detection");
  }
  const domainFixture = [
    "[a](https://one.example/a)",
    "[b](https://one.example/b)",
    "[c](https://two.example/c)",
  ].join(" ");
  if (uniqueMarkdownLinks(domainFixture).length !== 3 || sourceDomainCount(domainFixture) !== 2) {
    throw new Error("Self-test failed: unique source/domain detection");
  }
  const repeated = "A controlled comparison needs matched baselines and explicit uncertainty before the result can support an engineering decision.";
  if (jaccard(proseShingles(repeated), proseShingles(repeated)) !== 1) {
    throw new Error("Self-test failed: prose originality detection");
  }
  const reviewResults = ["deep", "timely-model", "timely-systems"].map((slug) => ({
    fileName: `${slug}.md`,
  }));
  const scores = Object.fromEntries(editorialScoreKeys.map((key) => [key, 5]));
  const reviewDocument = {
    version: 1,
    reviews: reviewResults.map((result) => ({
      slug: result.fileName.replace(/\.md$/, ""),
      verdict: "publish-ready",
      scores: { ...scores },
      strongestCounterargument: "A credible counterargument that could materially change the conclusion if supported.",
      unsupportedClaimRisk: "The least certain claim was narrowed to match the available measurements and sources.",
      reproductionBarrier: "The main barrier is access to the exact evaluation data and versioned runtime configuration.",
      revisions: [
        "Narrowed the main conclusion to the measured population.",
        "Added a decision boundary and a missing-data caveat.",
      ],
    })),
  };
  if (editorialReviewDocumentIssues(reviewDocument, reviewResults).length) {
    throw new Error("Self-test failed: valid editorial review detection");
  }
  reviewDocument.reviews[0].scores.questionValue = 3;
  if (!editorialReviewDocumentIssues(reviewDocument, reviewResults).length) {
    throw new Error("Self-test failed: weak editorial review rejection");
  }
  console.log("Public-content quality helper self-tests passed.");
}

async function validateArticle(filePath, assetsDir, qualityProfile) {
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
  const qualityTier = metadata.qualityTier || "";
  const tables = markdownTableStats(markdown);
  const tableCount = tables.length;
  const numericSignals = numericSignalCount(markdown);
  const measurementSignals = measurementSignalCount(markdown);
  const uniqueLinks = uniqueMarkdownLinks(markdown).length;
  const sourceDomains = sourceDomainCount(markdown);
  const blocks = fencedBlocks(markdown);
  const implementationBlocks = blocks.filter((block) => block.language !== "output");
  const measuredOutputBlocks = blocks.filter((block) => block.language === "output");
  const implementationLines = implementationBlocks.reduce(
    (total, block) => total + nonEmptyLineCount(block.body),
    0,
  );
  const outputLines = measuredOutputBlocks.reduce(
    (total, block) => total + nonEmptyLineCount(block.body),
    0,
  );

  if (qualityTier && !qualityTiers.has(qualityTier)) {
    issues.push('qualityTier must be either "deep-research" or "timely-analysis".');
  }
  if (qualityProfile === "automation" && !qualityTier) {
    issues.push("Automated candidates require a qualityTier.");
  }

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

  if (qualityTier === "deep-research") {
    if (evidenceMode !== "experiment") {
      issues.push("qualityTier=deep-research requires evidenceMode=experiment.");
    }
    if (bodyWords < 2400 || proseWords < 1800) {
      issues.push("Deep-research articles require enough room for the complete argument: at least 2400 total words and 1800 non-code words.");
    }
    if (headings.length < 8) {
      issues.push("Deep-research articles require at least eight purposeful h2/h3 sections.");
    }
    if (codeBlocks < 3 || outputBlocks < 2) {
      issues.push("Deep-research articles require at least three code blocks and two measured-output blocks.");
    }
    if (implementationLines < 45 || Math.max(0, ...implementationBlocks.map((block) => nonEmptyLineCount(block.body))) < 20) {
      issues.push("Deep-research implementation excerpts must include at least 45 substantive lines, with one block of at least 20 lines.");
    }
    if (outputLines < 8) {
      issues.push("Deep-research measured outputs must contain at least eight substantive lines.");
    }
    if (uniqueLinks < 6 || sourceDomains < 3) {
      issues.push("Deep-research articles require at least six unique primary or scholarly links across three source domains.");
    }
    if (numericSignals < 12 || measurementSignals < 8) {
      issues.push("Deep-research articles require dense quantitative evidence, including at least eight measured signals with units or statistical notation.");
    }
    if (!tables.some((table) => table.columns >= 3 && table.rows >= 3 && table.sourced)) {
      issues.push("Deep-research articles require a sourced result table with at least three columns and three data rows.");
    }
    const deepHeadings = [
      /method|experimental design|protocol/i,
      /baseline|control|ablation/i,
      /result|finding/i,
      /statistical|uncertainty|confidence/i,
      /reproduc/i,
      /failure|limitation|error analysis/i,
      /claim|conclusion|what the evidence supports/i,
    ];
    for (const pattern of deepHeadings) {
      if (!headings.some((heading) => pattern.test(heading))) {
        issues.push(`Deep-research article is missing a required section matching ${pattern}.`);
      }
    }
    if (!/\b(negative result|negative control|did not improve|no improvement|worse than|regression|null result|failed to outperform)\b/i.test(markdown)) {
      issues.push("Deep-research articles must report a negative result, negative control, or failed hypothesis explicitly.");
    }
    issues.push(...(await validateEvidenceManifest(metadata)));
  }

  if (qualityTier === "timely-analysis") {
    if (evidenceMode !== "strategy") {
      issues.push("qualityTier=timely-analysis requires evidenceMode=strategy.");
    }
    if (bodyWords < 1800 || proseWords < 1400) {
      issues.push("Timely-analysis articles require at least 1800 total words and 1400 non-code words, without padding beyond the useful argument.");
    }
    if (headings.length < 7) {
      issues.push("Timely-analysis articles require at least seven purposeful h2/h3 sections.");
    }
    if (uniqueLinks < 8 || sourceDomains < 4) {
      issues.push("Timely-analysis articles require at least eight unique primary or high-signal links across four source domains.");
    }
    if (!tables.some((table) => table.columns >= 3 && table.rows >= 3 && table.sourced)) {
      issues.push("Timely-analysis articles require a locally sourced comparison table with at least three columns and three data rows.");
    }
    if (tables.some((table) => !table.sourced)) {
      issues.push("Every timely-analysis comparison table needs a nearby Markdown source link.");
    }
    if (numericSignals < 10 || measurementSignals < 8) {
      issues.push("Timely-analysis articles require concrete specifications, scores, prices, latency values, or other measured signals.");
    }
    if (datedSourceSignalCount(markdown) < 3) {
      issues.push("Timely-analysis articles must identify at least three source or release dates explicitly.");
    }
    if (!headings.some((heading) => /comparison|benchmark|scorecard|model matrix|what changed/i.test(heading))) {
      issues.push("Timely-analysis articles require an explicit comparison or benchmark section.");
    }
    if (!headings.some((heading) => /engineering implication|implementation|decision|who should|operating/i.test(heading))) {
      issues.push("Timely-analysis articles require engineering decision guidance.");
    }
    if (!headings.some((heading) => /bottom line|decision summary|key finding|what changed|reader takeaway/i.test(heading))) {
      issues.push("Timely-analysis articles require a concise finding or decision-summary section.");
    }
    if (!headings.some((heading) => /when not|who should not|adoption boundary|wait|avoid/i.test(heading))) {
      issues.push("Timely-analysis articles require an explicit adoption boundary or when-not-to-use section.");
    }
    if (!headings.some((heading) => /source ledger|sources and dates|evidence ledger/i.test(heading))) {
      issues.push("Timely-analysis articles require a source ledger that records dates and claim provenance.");
    }
    if (!/\b(not directly comparable|comparison is limited|benchmark limitation|different (?:settings|hardware|datasets|prompts)|not reported|unknown|missing data)\b/i.test(markdown)) {
      issues.push("Timely-analysis articles must state comparison limits, missing data, or incompatible benchmark settings explicitly.");
    }
  }

  for (const rule of prohibitedPatterns) {
    const target = rule.markdownOnly ? markdown : raw;
    if (rule.pattern.test(target)) {
      issues.push(`Contains ${rule.label}.`);
    }
  }

  return { fileName, issues, metadata, markdown };
}

async function main() {
  if (process.argv.includes("--self-test")) {
    runSelfTests();
    return;
  }
  const args = parseArgs(process.argv.slice(2));
  if (!qualityProfiles.has(args.qualityProfile)) {
    throw new Error(`Unknown quality profile: ${args.qualityProfile}`);
  }
  const articleFiles = await listMarkdownFiles(args.articlesDir);
  if (!articleFiles.length) {
    throw new Error(`No Markdown articles found in ${args.articlesDir}`);
  }

  const results = [];
  for (const articleFile of articleFiles) {
    results.push(await validateArticle(articleFile, args.assetsDir, args.qualityProfile));
  }

  if (args.qualityProfile === "automation") {
    const batchIssues = [];
    const tiers = results.map((result) => result.metadata.qualityTier);
    const topics = new Set(results.map((result) => result.metadata.topic).filter(Boolean));
    if (results.length !== 3) batchIssues.push("Automation batches must contain exactly three articles.");
    if (tiers.filter((tier) => tier === "deep-research").length !== 1) {
      batchIssues.push("Automation batches require exactly one deep-research article.");
    }
    if (tiers.filter((tier) => tier === "timely-analysis").length !== 2) {
      batchIssues.push("Automation batches require exactly two timely-analysis articles.");
    }
    if (topics.size !== results.length) {
      batchIssues.push("Automation batch articles must cover distinct customer-facing topics.");
    }
    batchIssues.push(...batchOriginalityIssues(results));
    batchIssues.push(...(await existingLibraryOriginalityIssues(results, args.articlesDir)));
    batchIssues.push(...(await validateEditorialReview(args.editorialReview, results)));
    if (batchIssues.length) results.push({ fileName: "automation-batch", issues: batchIssues, metadata: {} });
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

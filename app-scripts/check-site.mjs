import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const appDir = path.join(distDir, "app");
const contentDir = path.join(distDir, "content");
const articleSourceDir = path.join(rootDir, "content", "articles");
const internalEvidenceFramingPattern =
  /\bDIY project\b|\boperator project\b|\bresearch-backed article\b|\bevidence-backed article\b|\bexperiment-backed article\b|\bstrategy article\b|\bexperiment article\b|\btrend article\b|\bevidenceMode\b|\bevidence mode\b|operator\/diy-project-blogs/i;

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readArticleEvidenceMode(slug) {
  const source = await readText(path.join(articleSourceDir, `${slug}.md`));
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  assert(match, `Missing source front matter for ${slug}.`);

  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    if (line.slice(0, separator).trim() === "evidenceMode") {
      return line.slice(separator + 1).trim();
    }
  }

  throw new Error(`Missing evidenceMode in source front matter for ${slug}.`);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursive(dirPath, extension) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(entryPath, extension)));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(entryPath);
    }
  }

  return files.sort();
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
    issues.push("image asset is too small to be useful");
  }

  if (extension === ".svg") {
    const svg = buffer.toString("utf8");
    if (!/<svg\b/i.test(svg)) issues.push("missing <svg> root");
    if (!/<title\b/i.test(svg)) issues.push("missing SVG <title>");
    if (!/<desc\b/i.test(svg)) issues.push("missing SVG <desc>");
    if (/href=["']https?:\/\//i.test(svg)) issues.push("depends on remote linked assets");
    dimensions = svgDimensions(svg);
  } else if (extension === ".png") {
    dimensions = pngDimensions(buffer);
  } else if (extension === ".jpg" || extension === ".jpeg") {
    dimensions = jpegDimensions(buffer);
  } else {
    issues.push("unsupported image format");
  }

  if (!dimensions || !dimensions.width || !dimensions.height) {
    issues.push("missing readable width and height");
    return issues;
  }

  const ratio = dimensions.width / dimensions.height;
  if (dimensions.width < 640 || dimensions.height < 320) {
    issues.push("should be at least 640x320");
  }
  if (ratio < 1.2 || ratio > 2.8) {
    issues.push("should use a landscape aspect ratio that fits article previews");
  }

  return issues;
}

function extractImageSources(html) {
  return [...html.matchAll(/<img\b[^>]*\bsrc=(["'])(.*?)\1/gi)].map((match) => match[2]);
}

function resolveGeneratedImagePath(src, htmlFilePath) {
  const cleanSrc = src.split(/[?#]/)[0];
  if (/^https?:\/\//i.test(cleanSrc) || cleanSrc.startsWith("data:")) return "";
  if (cleanSrc.startsWith("/content/") || cleanSrc.startsWith("/tutorials/")) {
    return path.join(contentDir, cleanSrc.replace(/^\/+/, ""));
  }
  if (cleanSrc.startsWith("/")) {
    return path.join(appDir, cleanSrc.replace(/^\/+/, ""));
  }
  return path.resolve(path.dirname(htmlFilePath), cleanSrc);
}

async function checkGeneratedImageReferences() {
  const htmlFiles = [
    ...(await listFilesRecursive(appDir, ".html")),
    ...(await listFilesRecursive(contentDir, ".html")),
  ];

  for (const htmlFile of htmlFiles) {
    const html = await readText(htmlFile);
    for (const src of extractImageSources(html)) {
      assert(!/^https?:\/\//i.test(src), `Generated image must be local, found ${src} in ${htmlFile}`);
      if (src.startsWith("data:")) continue;

      const imagePath = resolveGeneratedImagePath(src, htmlFile);
      assert(imagePath, `Could not resolve image reference ${src} in ${htmlFile}`);
      assert(await exists(imagePath), `Broken image reference in ${htmlFile}: ${src}`);
    }
  }
}

async function main() {
  const manifestPath = path.join(contentDir, "content", "v1", "manifest.json");
  const searchPath = path.join(contentDir, "content", "v1", "search-index.json");
  const manifest = await readJson(manifestPath);
  const search = await readJson(searchPath);

  assert(manifest.articles.length >= 1, "Expected at least one production-grade tutorial article.");
  assert(search.documents.length === manifest.articles.length, "Search index article count mismatch.");
  assert(manifest.topics.length >= 1, "Expected at least one topic group.");

  const styles = await readText(path.join(appDir, "assets", "styles.css"));
  assert(
    /\.article-hero-image img\s*{[\s\S]*?object-fit:\s*contain;/.test(styles),
    "Article image CSS must preserve full diagrams with object-fit: contain.",
  );
  assert(
    /\.spotlight-card img\s*{[\s\S]*?object-fit:\s*contain;/.test(styles),
    "Home spotlight image CSS must preserve full diagrams with object-fit: contain.",
  );

  const home = await readText(path.join(appDir, "index.html"));
  assert(home.includes("<title>AI Tutorial Lab</title>"), "Home page title is missing.");
  assert(home.includes('<meta name="description"'), "Home page description meta tag is missing.");
  assert(home.includes("/assets/hero-ai-workspace.png"), "Home page visual asset is missing.");
  assert(home.includes("data-home-curated"), "Home page curated discovery modules are missing.");
  assert(home.includes("data-home-search"), "Home page search entry point is missing.");
  assert(home.includes("data-tag-cloud"), "Home page tag discovery is missing.");
  const homeArticleLinks = [...home.matchAll(/href="\/tutorials\//g)].length;
  assert(
    homeArticleLinks <= 12,
    `Home page should not render the full article archive; found ${homeArticleLinks} tutorial links.`,
  );
  assert(!home.includes("undefined"), "Home page contains undefined output.");

  const agentConsole = await readText(path.join(appDir, "agent-console", "index.html"));
  assert(agentConsole.includes("LangGraph Agent Console"), "Agent console page title is missing.");
  assert(agentConsole.includes("/agent-console/console.css"), "Agent console CSS is missing.");
  assert(agentConsole.includes("/agent-console/console.js"), "Agent console JS is missing.");
  assert(!agentConsole.includes("/assets/app.js"), "Agent console must not load the tutorial app bundle.");
  assert(!agentConsole.includes("/assets/styles.css"), "Agent console must not load the tutorial stylesheet.");
  assert(!JSON.stringify(manifest).includes("agent-console"), "Agent console must stay out of content manifest.");
  assert(!JSON.stringify(search).includes("agent-console"), "Agent console must stay out of search index.");
  const agentToolCatalog = await readJson(path.join(appDir, "agent-console", "tools", "catalog.json"));
  assert(Array.isArray(agentToolCatalog.tools), "Agent console tool catalog must contain a tools array.");
  assert(
    agentToolCatalog.tools.length >= 8 && agentToolCatalog.tools.length <= 20,
    "Agent console tool catalog must contain provider-level tool packs.",
  );
  for (const id of ["git", "github", "gitlab", "aws", "terraform", "npm", "docker", "kubernetes", "python", "make"]) {
    assert(
      agentToolCatalog.tools.some((tool) => tool.id === id && tool.pack && tool.commandPackUrl),
      `Agent console tool catalog missing ${id} provider pack.`,
    );
  }
  const packCommandCounts = [];
  for (const tool of agentToolCatalog.tools.filter((entry) => entry.pack)) {
    assert(
      tool.commandPackUrl?.startsWith("/agent-console/tools/packs/"),
      `Agent console provider pack ${tool.id} must use a local pack URL.`,
    );
    const packPath = path.join(appDir, tool.commandPackUrl.replace(/^\/+/, ""));
    assert(await exists(packPath), `Missing agent console command pack for ${tool.id}.`);
    const pack = await readJson(packPath);
    assert(Array.isArray(pack.commands) && pack.commands.length > 0, `Command pack ${tool.id} must contain commands.`);
    for (const command of pack.commands) {
      assert(Array.isArray(command.command) && command.command.length > 0, `Command pack ${tool.id} has an empty command.`);
      assert(typeof command.id === "string" && command.id.length > 0, `Command pack ${tool.id} has a command without id.`);
    }
    packCommandCounts.push(pack.commands.length);
  }
  const totalPackedCommands = packCommandCounts.reduce((sum, count) => sum + count, 0);
  assert(
    totalPackedCommands >= 80 && totalPackedCommands <= 140,
    `Agent console provider packs must expose 80 to 140 commands; found ${totalPackedCommands}.`,
  );

  const sitemap = await readText(path.join(appDir, "sitemap.xml"));
  assert(sitemap.includes("<urlset"), "Sitemap is not valid XML sitemap output.");
  assert(sitemap.includes("/agent-console/"), "Sitemap missing agent console route.");

  for (const article of manifest.articles) {
    const articleHtmlPath = path.join(contentDir, article.url, "index.html");
    const articleJsonPath = path.join(
      contentDir,
      "content",
      "v1",
      "articles",
      article.slug,
      "index.json",
    );
    const html = await readText(articleHtmlPath);
    const json = await readJson(articleJsonPath);
    const evidenceMode = await readArticleEvidenceMode(article.slug);
    const hasCodeBlocks = html.includes("code-frame");
    const hasOutputBlocks = html.includes("output-frame");

    assert(html.includes(`<h1>${article.title}</h1>`), `Article h1 missing for ${article.slug}.`);
    assert(html.includes('<link rel="canonical"'), `Canonical URL missing for ${article.slug}.`);
    assert(html.includes('property="og:image"'), `Open Graph image missing for ${article.slug}.`);
    assert(html.includes('type="application/ld+json"'), `Structured data missing for ${article.slug}.`);
    assert(html.includes("toc-nav"), `TOC missing for ${article.slug}.`);
    if (evidenceMode === "experiment") {
      assert(hasCodeBlocks, `Experiment article code block missing for ${article.slug}.`);
      assert(hasOutputBlocks, `Experiment article output block missing for ${article.slug}.`);
    }
    assert(!html.includes("undefined"), `Article ${article.slug} contains undefined output.`);
    assert(!html.includes("evidenceMode"), `Article ${article.slug} exposes internal evidence metadata.`);
    assert(!JSON.stringify(json).includes("evidenceMode"), `Article JSON ${article.slug} exposes internal evidence metadata.`);
    assert(
      !internalEvidenceFramingPattern.test(`${html}\n${JSON.stringify(json)}`),
      `Article ${article.slug} exposes internal evidence-mode framing.`,
    );
    assert(json.blocks.length > 0, `Article JSON has no blocks for ${article.slug}.`);
    assert(json.toc.length >= 8, `Article JSON has too few TOC entries for ${article.slug}.`);
    assert(sitemap.includes(article.url), `Sitemap missing ${article.url}.`);
    assert(
      article.image?.startsWith("/content/v1/assets/"),
      `Article ${article.slug} must use an article-specific content asset.`,
    );
    assert(article.imageAlt?.length >= 30, `Article ${article.slug} imageAlt is too weak.`);
    assert(
      await exists(path.join(contentDir, article.image.replace(/^\/+/, ""))),
      `Missing article asset for ${article.slug}: ${article.image}`,
    );
    const articleImageIssues = await validateImageAsset(path.join(contentDir, article.image.replace(/^\/+/, "")));
    assert(
      articleImageIssues.length === 0,
      `Article ${article.slug} image asset failed validation: ${articleImageIssues.join("; ")}`,
    );
  }

  await checkGeneratedImageReferences();

  const requiredFiles = [
    path.join(appDir, "assets", "styles.css"),
    path.join(appDir, "assets", "app.js"),
    path.join(appDir, "assets", "hero-ai-workspace.png"),
    path.join(appDir, "agent-console", "console.css"),
    path.join(appDir, "agent-console", "console.js"),
    path.join(appDir, "agent-console", "tools", "catalog.json"),
    path.join(appDir, "robots.txt"),
    path.join(distDir, "pipeline-artifact", "app", "index.html"),
    path.join(distDir, "pipeline-artifact", "app", "agent-console", "index.html"),
    path.join(distDir, "pipeline-artifact", "content", "content", "v1", "manifest.json"),
  ];

  for (const filePath of requiredFiles) {
    assert(await exists(filePath), `Missing expected build artifact: ${filePath}`);
  }

  console.log("Site checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

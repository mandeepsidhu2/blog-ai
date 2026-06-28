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

async function main() {
  const manifestPath = path.join(contentDir, "content", "v1", "manifest.json");
  const searchPath = path.join(contentDir, "content", "v1", "search-index.json");
  const manifest = await readJson(manifestPath);
  const search = await readJson(searchPath);

  assert(manifest.articles.length >= 1, "Expected at least one production-grade tutorial article.");
  assert(search.documents.length === manifest.articles.length, "Search index article count mismatch.");
  assert(manifest.topics.length >= 1, "Expected at least one topic group.");

  const home = await readText(path.join(appDir, "index.html"));
  assert(home.includes("<title>AI Tutorial Lab</title>"), "Home page title is missing.");
  assert(home.includes('<meta name="description"'), "Home page description meta tag is missing.");
  assert(home.includes("/assets/hero-ai-workspace.png"), "Home page visual asset is missing.");
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
    agentToolCatalog.tools.length >= 80 && agentToolCatalog.tools.length <= 120,
    "Agent console tool catalog must contain 80 to 120 tools.",
  );
  for (const category of ["Git", "GitHub", "GitLab", "AWS", "Terraform", "NPM", "Docker", "Kubernetes", "Python", "Make"]) {
    assert(
      agentToolCatalog.tools.some((tool) => tool.category === category),
      `Agent console tool catalog missing ${category} tools.`,
    );
  }

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
  }

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

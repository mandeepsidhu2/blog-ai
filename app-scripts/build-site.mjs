import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const contentDir = path.join(rootDir, "content", "articles");
const contentAssetsDir = path.join(rootDir, "content", "assets");
const siteAssetsDir = path.join(rootDir, "site", "assets");
const distDir = path.join(rootDir, "dist");
const appDir = path.join(distDir, "app");
const contentOutDir = path.join(distDir, "content");
const pipelineDir = path.join(distDir, "pipeline-artifact");

const siteUrl = normalizeSiteUrl(process.env.SITE_URL || "https://learn.toolsite.com");
const siteName = "AI Tutorial Lab";
const siteDescription =
  "Practical AI engineering tutorials for RAG, transformers, agents, LangGraph workflows, and evaluation.";

function normalizeSiteUrl(value) {
  return value.replace(/\/+$/, "");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replaceAll("\n", " ");
}

function safeJsonScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function assetUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//.test(value)) return value;
  return `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFrontMatter(raw, filePath) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`Missing front matter in ${filePath}`);
  }

  const metadata = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    if (separator === -1) {
      throw new Error(`Invalid front matter line in ${filePath}: ${line}`);
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    metadata[key] = value;
  }

  const required = [
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
  for (const key of required) {
    if (!metadata[key]) {
      throw new Error(`Missing front matter field "${key}" in ${filePath}`);
    }
  }

  metadata.readingTime = Number(metadata.readingTime);
  metadata.tags = metadata.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  metadata.topicSlug = slugify(metadata.topic);
  metadata.image = metadata.image || "";
  metadata.imageAlt = metadata.imageAlt || `${metadata.title} tutorial diagram`;

  return { metadata, markdown: match[2].trim() };
}

function renderInlineMarkdown(input) {
  let html = escapeHtml(input);

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" rel="noopener noreferrer">$1</a>',
  );

  return html;
}

function createUniqueId(title, usedIds) {
  const base = slugify(title) || "section";
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function parseMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  const toc = [];
  const usedIds = new Set();
  let paragraph = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const fence = trimmed.match(/^```([a-zA-Z0-9_-]*)\s*$/);
    if (fence) {
      flushParagraph();
      const language = fence[1] || "text";
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index >= lines.length) {
        throw new Error("Unclosed code fence");
      }

      if (language === "output") {
        blocks.push({ type: "output", kind: "terminal", text: codeLines.join("\n") });
      } else {
        blocks.push({ type: "code", language, code: codeLines.join("\n") });
      }
      continue;
    }

    const heading = trimmed.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const depth = heading[1].length;
      const title = heading[2].trim();
      const id = createUniqueId(title, usedIds);
      blocks.push({ type: "heading", depth, id, title });
      toc.push({ id, depth, title });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      const items = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(lines[index].trim().slice(2).trim());
        index += 1;
      }
      index -= 1;
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      index -= 1;
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      const quoteLines = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      index -= 1;
      blocks.push({ type: "quote", text: quoteLines.join(" ") });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return { blocks, toc };
}

function renderBlock(block) {
  if (block.type === "heading") {
    const tag = `h${block.depth}`;
    return `<${tag} id="${escapeAttribute(block.id)}"><a href="#${escapeAttribute(block.id)}">${renderInlineMarkdown(block.title)}</a></${tag}>`;
  }

  if (block.type === "paragraph") {
    return `<p>${renderInlineMarkdown(block.text)}</p>`;
  }

  if (block.type === "list") {
    const tag = block.ordered ? "ol" : "ul";
    const items = block.items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("");
    return `<${tag}>${items}</${tag}>`;
  }

  if (block.type === "quote") {
    return `<blockquote>${renderInlineMarkdown(block.text)}</blockquote>`;
  }

  if (block.type === "code") {
    const label = block.language || "text";
    return [
      `<figure class="code-frame" data-language="${escapeAttribute(label)}">`,
      `<figcaption><span>${escapeHtml(label)}</span><button class="copy-button" type="button">Copy</button></figcaption>`,
      `<pre><code class="language-${escapeAttribute(label)}">${escapeHtml(block.code)}</code></pre>`,
      `</figure>`,
    ].join("");
  }

  if (block.type === "output") {
    return [
      `<figure class="output-frame">`,
      `<figcaption><span>output</span></figcaption>`,
      `<pre><code>${escapeHtml(block.text)}</code></pre>`,
      `</figure>`,
    ].join("");
  }

  throw new Error(`Unknown block type: ${block.type}`);
}

function renderBlocks(blocks) {
  return blocks.map(renderBlock).join("\n");
}

function articleToSearchText(article) {
  return [
    article.title,
    article.description,
    article.topic,
    article.level,
    article.tags.join(" "),
    article.markdown.replace(/```[\s\S]*?```/g, " "),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function articleJsonBlocks(blocks) {
  return blocks.map((block) => {
    if (block.type === "code") {
      return {
        type: "code",
        language: block.language,
        code: block.code,
        html: renderBlock(block),
      };
    }
    if (block.type === "output") {
      return {
        type: "output",
        kind: block.kind,
        text: block.text,
        html: renderBlock(block),
      };
    }
    return {
      type: block.type,
      html: renderBlock(block),
    };
  });
}

async function readArticles() {
  const entries = await fs.readdir(contentDir, { withFileTypes: true });
  const articleFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();

  const articles = [];
  for (const fileName of articleFiles) {
    const filePath = path.join(contentDir, fileName);
    const raw = await fs.readFile(filePath, "utf8");
    const { metadata, markdown } = parseFrontMatter(raw, filePath);
    const slug = fileName.replace(/\.md$/, "");
    const { blocks, toc } = parseMarkdown(markdown);
    const html = renderBlocks(blocks);
    const url = `/tutorials/${slug}/`;

    articles.push({
      ...metadata,
      slug,
      sourcePath: path.relative(rootDir, filePath),
      url,
      canonicalUrl: `${siteUrl}${url}`,
      markdown,
      html,
      blocks,
      toc,
      searchText: articleToSearchText({ ...metadata, markdown }),
    });
  }

  return articles.sort((left, right) => {
    if (left.topic === right.topic) return left.title.localeCompare(right.title);
    return left.topic.localeCompare(right.topic);
  });
}

function renderHead({
  title,
  description,
  pathName,
  image = "/assets/hero-ai-workspace.png",
  imageAlt = "Layered AI engineering workspace with code panels and model diagrams",
  keywords = [],
  publishedTime = "",
  type = "website",
  structuredData = [],
}) {
  const canonical = `${siteUrl}${pathName}`;
  const fullTitle = title === siteName ? title : `${title} | ${siteName}`;
  const imageUrl = assetUrl(image);
  const keywordMeta = keywords.length
    ? `<meta name="keywords" content="${escapeAttribute(keywords.join(", "))}">`
    : "";
  const articleMeta = publishedTime
    ? `<meta property="article:published_time" content="${escapeAttribute(publishedTime)}">
    <meta property="article:modified_time" content="${escapeAttribute(publishedTime)}">`
    : "";
  const structuredDataScripts = structuredData
    .map(
      (schema) =>
        `<script type="application/ld+json">${safeJsonScript({
          "@context": "https://schema.org",
          ...schema,
        })}</script>`,
    )
    .join("\n    ");

  return `
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeAttribute(description)}">
    ${keywordMeta}
    <link rel="canonical" href="${escapeAttribute(canonical)}">
    <meta property="og:site_name" content="${escapeAttribute(siteName)}">
    <meta property="og:type" content="${escapeAttribute(type)}">
    <meta property="og:title" content="${escapeAttribute(fullTitle)}">
    <meta property="og:description" content="${escapeAttribute(description)}">
    <meta property="og:url" content="${escapeAttribute(canonical)}">
    <meta property="og:image" content="${escapeAttribute(imageUrl)}">
    <meta property="og:image:alt" content="${escapeAttribute(imageAlt)}">
    ${articleMeta}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttribute(fullTitle)}">
    <meta name="twitter:description" content="${escapeAttribute(description)}">
    <meta name="twitter:image" content="${escapeAttribute(imageUrl)}">
    <meta name="twitter:image:alt" content="${escapeAttribute(imageAlt)}">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="preload" as="image" href="/assets/hero-ai-workspace.png">
    <link rel="stylesheet" href="/assets/styles.css">
    <script type="module" src="/assets/app.js"></script>
    ${structuredDataScripts}
  `;
}

function renderHeader(active = "tutorials") {
  return `
    <header class="site-header">
      <a class="brand" href="/" aria-label="${escapeAttribute(siteName)} home">
        <span class="brand-mark" aria-hidden="true">AI</span>
        <span>${escapeHtml(siteName)}</span>
      </a>
      <nav class="top-nav" aria-label="Primary">
        <a href="/" ${active === "tutorials" ? 'aria-current="page"' : ""}>Tutorials</a>
      </nav>
      <button class="icon-button search-trigger" type="button" data-search-open aria-label="Search tutorials">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m21 21-4.4-4.4m1.4-5.1a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"/></svg>
      </button>
    </header>
  `;
}

function renderSearchDialog() {
  return `
    <dialog class="search-dialog" data-search-dialog>
      <form method="dialog" class="search-panel">
        <div class="search-row">
          <input data-search-input type="search" placeholder="Search tutorials" aria-label="Search tutorials" autocomplete="off">
          <button class="icon-button" value="close" aria-label="Close search">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="search-results" data-search-results></div>
      </form>
    </dialog>
  `;
}

function renderArticleCard(article) {
  const tags = article.tags
    .slice(0, 3)
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");

  return `
    <article class="tutorial-card">
      <a href="${escapeAttribute(article.url)}">
        <span class="topic-pill">${escapeHtml(article.topic)}</span>
        <h2>${escapeHtml(article.title)}</h2>
        <p>${escapeHtml(article.description)}</p>
        <footer>
          <span>${escapeHtml(article.level)}</span>
          <span>${article.readingTime} min</span>
        </footer>
        <div class="tag-row">${tags}</div>
      </a>
    </article>
  `;
}

function renderArticleMeta(article) {
  return `
    <footer class="article-card-meta">
      <span>${escapeHtml(article.level)}</span>
      <span>${article.readingTime} min</span>
    </footer>
  `;
}

function renderSpotlightArticle(article) {
  if (!article) return "";

  const tags = article.tags
    .slice(0, 4)
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");

  return `
    <article class="spotlight-card">
      <a class="spotlight-link" href="${escapeAttribute(article.url)}">
        <div class="spotlight-copy">
          <span class="topic-pill">${escapeHtml(article.topic)}</span>
          <h2>${escapeHtml(article.title)}</h2>
          <p>${escapeHtml(article.description)}</p>
          ${renderArticleMeta(article)}
          <div class="tag-row">${tags}</div>
        </div>
        <img src="${escapeAttribute(article.image)}" alt="${escapeAttribute(article.imageAlt)}" width="1600" height="900">
      </a>
    </article>
  `;
}

function renderCompactArticleCard(article) {
  return `
    <article class="compact-article-card">
      <a href="${escapeAttribute(article.url)}">
        <span class="topic-pill">${escapeHtml(article.topic)}</span>
        <h3>${escapeHtml(article.title)}</h3>
        <p>${escapeHtml(article.description)}</p>
        ${renderArticleMeta(article)}
      </a>
    </article>
  `;
}

function renderLatestArticleRow(article) {
  return `
    <li>
      <a class="latest-link" href="${escapeAttribute(article.url)}">
        <span class="topic-pill">${escapeHtml(article.topic)}</span>
        <strong>${escapeHtml(article.title)}</strong>
        <span>${escapeHtml(article.date)} · ${article.readingTime} min</span>
      </a>
    </li>
  `;
}

function renderTopicChips(topics) {
  return topics
    .map(
      (topic) =>
        `<a class="topic-chip" href="/topics/${escapeAttribute(topic.slug)}/">${escapeHtml(topic.name)} <span>${topic.count}</span></a>`,
    )
    .join("");
}

function compareArticlesByDate(left, right) {
  return right.date.localeCompare(left.date) || left.title.localeCompare(right.title);
}

function compareTopicsByCount(left, right) {
  return right.count - left.count || left.name.localeCompare(right.name);
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function buildTagSummaries(articles, limit = 12) {
  const tagMap = new Map();
  for (const article of articles) {
    for (const tag of article.tags) {
      const summary = tagMap.get(tag) || { name: tag, count: 0 };
      summary.count += 1;
      tagMap.set(tag, summary);
    }
  }

  return [...tagMap.values()]
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, limit);
}

function renderTagCloud(tags) {
  if (!tags.length) {
    return '<p class="empty-state">Tags will appear as the tutorial library grows.</p>';
  }

  return tags
    .map(
      (tag) => `
        <button class="tag-chip" type="button" data-search-query="${escapeAttribute(tag.name)}" aria-label="Search ${escapeAttribute(tag.name)} tutorials">
          <span>${escapeHtml(tag.name)}</span>
          <strong>${tag.count}</strong>
        </button>
      `,
    )
    .join("");
}

function renderTopicHubs(topics, articles) {
  if (!topics.length) return "";

  const newestByTopic = new Map();
  for (const article of [...articles].sort(compareArticlesByDate)) {
    if (!newestByTopic.has(article.topicSlug)) {
      newestByTopic.set(article.topicSlug, article);
    }
  }

  return topics
    .map((topic) => {
      const representative = newestByTopic.get(topic.slug);
      const representativeTitle = representative
        ? `Latest: ${representative.title}`
        : "Open the topic archive";

      return `
        <a class="topic-hub" href="/topics/${escapeAttribute(topic.slug)}/">
          <span>${formatCount(topic.count)} ${topic.count === 1 ? "guide" : "guides"}</span>
          <strong>${escapeHtml(topic.name)}</strong>
          <em>${escapeHtml(representativeTitle)}</em>
        </a>
      `;
    })
    .join("");
}

function renderHomePage(articles, topics) {
  const articlesByDate = [...articles].sort(compareArticlesByDate);
  const spotlightArticle = articlesByDate[0];
  const recommendedArticles = articlesByDate.slice(1, 4);
  const usedSlugs = new Set([spotlightArticle?.slug, ...recommendedArticles.map((article) => article.slug)]);
  const latestArticles = articlesByDate.filter((article) => !usedSlugs.has(article.slug)).slice(0, 6);
  const topTopics = [...topics].sort(compareTopicsByCount).slice(0, 8);
  const topicChips = renderTopicChips(topTopics);
  const tagSummaries = buildTagSummaries(articles);
  const articleCount = formatCount(articles.length);
  const recommendedCards = recommendedArticles.map(renderCompactArticleCard).join("");
  const latestRows = latestArticles.map(renderLatestArticleRow).join("");
  const latestSection = latestRows
    ? `
    <section class="latest-section" aria-labelledby="latest-heading">
      <div class="section-heading inline-heading">
        <div>
          <p class="eyebrow">Latest updates</p>
          <h2 id="latest-heading">Fresh work, without the full archive dump.</h2>
        </div>
        <button class="secondary-action compact-action" type="button" data-search-open>Search all ${articleCount}</button>
      </div>
      <ol class="latest-list">
        ${latestRows}
      </ol>
    </section>
  `
    : "";

  return `<!doctype html>
<html lang="en">
<head>${renderHead({ title: siteName, description: siteDescription, pathName: "/" })}</head>
<body data-page="home">
  ${renderHeader("tutorials")}
  <main>
    <section class="hero-section">
      <div class="hero-copy">
        <p class="eyebrow">Stay ahead in AI</p>
        <h1>Stay ahead in AI before the stack becomes table stakes.</h1>
        <p class="hero-summary">RAG, transformers, agents, LangGraph, and evaluation are now core engineering literacy. Learn them with practical, code-heavy tutorials.</p>
        <div class="hero-actions">
          <a class="primary-action" href="#featured">Start with top guides</a>
          <button class="secondary-action" type="button" data-search-open>Search library</button>
        </div>
        <form class="home-search" data-home-search>
          <label class="sr-only" for="home-search-input">Search tutorials</label>
          <input id="home-search-input" type="search" placeholder="Search tutorials..." autocomplete="off">
          <button type="submit">Search</button>
        </form>
      </div>
      <figure class="hero-visual">
        <img src="/assets/hero-ai-workspace.png" alt="Layered AI engineering workspace with code panels and model diagrams" width="1536" height="864">
      </figure>
    </section>

    <section class="topic-band" aria-label="Topics">
      ${topicChips}
    </section>

    <section class="home-curation" id="featured" data-home-curated>
      <div class="section-heading inline-heading">
        <div>
          <p class="eyebrow">Top articles</p>
          <h2>Start with the guides that define the library.</h2>
        </div>
        <p>${articleCount} production-grade tutorials indexed by topic, tag, and full-text search.</p>
      </div>
      <div class="feature-grid">
        ${renderSpotlightArticle(spotlightArticle)}
        <div class="recommendation-stack" aria-label="Recommended tutorials">
          ${recommendedCards}
        </div>
      </div>
    </section>

    <section class="discovery-section" id="tutorials">
      <div class="section-heading">
        <p class="eyebrow">Library discovery</p>
        <h2>Browse the map instead of paging through every card.</h2>
      </div>
      <div class="discovery-grid">
        <section class="discovery-panel" aria-labelledby="topics-heading">
          <div class="panel-heading">
            <h3 id="topics-heading">Explore by topic</h3>
            <p>Topic pages keep the library navigable as the archive grows.</p>
          </div>
          <div class="topic-hub-grid">
            ${renderTopicHubs(topTopics, articles)}
          </div>
        </section>
        <section class="discovery-panel" aria-labelledby="tags-heading">
          <div class="panel-heading">
            <h3 id="tags-heading">Search by tag</h3>
            <p>Tags jump directly into matching tutorials without adding another archive page.</p>
          </div>
          <div class="tag-cloud" data-tag-cloud>
            ${renderTagCloud(tagSummaries)}
          </div>
        </section>
      </div>
    </section>

    ${latestSection}
  </main>
  ${renderSearchDialog()}
</body>
</html>`;
}

function renderTopicPage(topic, articles, topics) {
  const topicArticles = articles.filter((article) => article.topicSlug === topic.slug);
  const articleCards = topicArticles.map(renderArticleCard).join("");

  return `<!doctype html>
<html lang="en">
<head>${renderHead({
    title: `${topic.name} Tutorials`,
    description: `Practical ${topic.name} tutorials with code snippets, outputs, and production notes.`,
    pathName: `/topics/${topic.slug}/`,
  })}</head>
<body data-page="topic">
  ${renderHeader("tutorials")}
  <main>
    <section class="topic-hero">
      <p class="eyebrow">Topic</p>
      <h1>${escapeHtml(topic.name)} tutorials</h1>
      <p>${topic.count} focused ${topic.count === 1 ? "guide" : "guides"} with runnable patterns and explicit trade-offs.</p>
    </section>
    <section class="topic-band" aria-label="All topics">
      ${renderTopicChips(topics)}
    </section>
    <section class="tutorial-index">
      <div class="tutorial-grid">
        ${articleCards}
      </div>
    </section>
  </main>
  ${renderSearchDialog()}
</body>
</html>`;
}

function renderToc(toc) {
  if (!toc.length) return "";
  const items = toc
    .map(
      (item) =>
        `<a class="toc-depth-${item.depth}" href="#${escapeAttribute(item.id)}">${escapeHtml(item.title)}</a>`,
    )
    .join("");
  return `<nav class="toc-nav" aria-label="On this page"><p>On this page</p>${items}</nav>`;
}

function renderRelated(article, articles) {
  const related = articles
    .filter((candidate) => candidate.slug !== article.slug)
    .sort((left, right) => {
      const leftScore = left.topic === article.topic ? 0 : 1;
      const rightScore = right.topic === article.topic ? 0 : 1;
      if (leftScore === rightScore) return left.title.localeCompare(right.title);
      return leftScore - rightScore;
    })
    .slice(0, 3);

  return related
    .map(
      (item) => `
        <a href="${escapeAttribute(item.url)}">
          <span>${escapeHtml(item.topic)}</span>
          ${escapeHtml(item.title)}
        </a>
      `,
    )
    .join("");
}

function renderArticlePage(article, articles) {
  const tags = article.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const related = renderRelated(article, articles);
  const articleImage = article.image || "/assets/hero-ai-workspace.png";
  const articleImageAlt = article.imageAlt || `${article.title} tutorial diagram`;
  const articleSchema = {
    "@type": "TechArticle",
    headline: article.title,
    description: article.description,
    image: [assetUrl(articleImage)],
    datePublished: article.date,
    dateModified: article.date,
    author: {
      "@type": "Organization",
      name: siteName,
    },
    publisher: {
      "@type": "Organization",
      name: siteName,
    },
    mainEntityOfPage: article.canonicalUrl,
    keywords: article.tags.join(", "),
    articleSection: article.topic,
    proficiencyLevel: article.level,
  };
  const breadcrumbSchema = {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Tutorials",
        item: `${siteUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: article.topic,
        item: `${siteUrl}/topics/${article.topicSlug}/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: article.title,
        item: article.canonicalUrl,
      },
    ],
  };

  return `<!doctype html>
<html lang="en">
<head>${renderHead({
    title: article.title,
    description: article.description,
    pathName: article.url,
    image: articleImage,
    imageAlt: articleImageAlt,
    keywords: article.tags,
    publishedTime: article.date,
    type: "article",
    structuredData: [articleSchema, breadcrumbSchema],
  })}</head>
<body data-page="article" data-article-slug="${escapeAttribute(article.slug)}">
  ${renderHeader("tutorials")}
  <main class="article-shell">
    <aside class="article-left">
      ${renderToc(article.toc)}
    </aside>
    <article class="article-main">
      <a class="breadcrumb" href="/">Tutorials</a>
      <header class="article-header">
        <span class="topic-pill">${escapeHtml(article.topic)}</span>
        <h1>${escapeHtml(article.title)}</h1>
        <p>${escapeHtml(article.description)}</p>
        <div class="article-meta">
          <span>${escapeHtml(article.level)}</span>
          <span>${article.readingTime} min read</span>
          <time datetime="${escapeAttribute(article.date)}">${escapeHtml(article.date)}</time>
        </div>
        <div class="tag-row">${tags}</div>
      </header>
      <figure class="article-hero-image">
        <img src="${escapeAttribute(articleImage)}" alt="${escapeAttribute(articleImageAlt)}" width="1600" height="900">
      </figure>
      <div class="article-content">
        ${article.html}
      </div>
    </article>
    <aside class="article-right">
      <section class="related-panel">
        <h2>Related</h2>
        ${related}
      </section>
    </aside>
  </main>
  ${renderSearchDialog()}
</body>
</html>`;
}

function buildTopics(articles) {
  const topicMap = new Map();
  for (const article of articles) {
    if (!topicMap.has(article.topicSlug)) {
      topicMap.set(article.topicSlug, {
        name: article.topic,
        slug: article.topicSlug,
        count: 0,
      });
    }
    topicMap.get(article.topicSlug).count += 1;
  }
  return [...topicMap.values()].sort((left, right) => left.name.localeCompare(right.name));
}

function buildManifest(articles, topics) {
  return {
    siteName,
    description: siteDescription,
    generatedAt: new Date().toISOString(),
    articles: articles.map((article) => ({
      slug: article.slug,
      title: article.title,
      description: article.description,
      topic: article.topic,
      topicSlug: article.topicSlug,
      level: article.level,
      date: article.date,
      readingTime: article.readingTime,
      tags: article.tags,
      image: article.image,
      imageAlt: article.imageAlt,
      url: article.url,
      contentUrl: `/content/v1/articles/${article.slug}/index.json`,
    })),
    topics,
  };
}

function buildSearchIndex(articles) {
  return {
    generatedAt: new Date().toISOString(),
    documents: articles.map((article) => ({
      slug: article.slug,
      title: article.title,
      description: article.description,
      topic: article.topic,
      level: article.level,
      tags: article.tags,
      url: article.url,
      text: article.searchText,
    })),
  };
}

function buildArticleJson(article) {
  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    topic: article.topic,
    topicSlug: article.topicSlug,
    level: article.level,
    date: article.date,
    readingTime: article.readingTime,
    tags: article.tags,
    image: article.image,
    imageAlt: article.imageAlt,
    canonicalUrl: article.canonicalUrl,
    sourcePath: article.sourcePath,
    toc: article.toc,
    blocks: articleJsonBlocks(article.blocks),
  };
}

function renderSitemap(articles, topics) {
  const urls = [
    { loc: `${siteUrl}/`, priority: "1.0" },
    ...topics.map((topic) => ({
      loc: `${siteUrl}/topics/${topic.slug}/`,
      priority: "0.7",
    })),
    ...articles.map((article) => ({
      loc: article.canonicalUrl,
      lastmod: article.date,
      priority: "0.9",
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeHtml(url.loc)}</loc>
    ${url.lastmod ? `<lastmod>${escapeHtml(url.lastmod)}</lastmod>` : ""}
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function writeText(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value);
}

async function copyAssets() {
  await fs.mkdir(path.join(appDir, "assets"), { recursive: true });
  await fs.cp(siteAssetsDir, path.join(appDir, "assets"), { recursive: true });
}

async function copyContentAssets() {
  try {
    await fs.access(contentAssetsDir);
  } catch {
    return;
  }

  await fs.cp(contentAssetsDir, path.join(contentOutDir, "content", "v1", "assets"), {
    recursive: true,
  });
}

async function copyPipelineArtifact() {
  await fs.rm(pipelineDir, { recursive: true, force: true });
  await fs.mkdir(pipelineDir, { recursive: true });
  await fs.cp(appDir, path.join(pipelineDir, "app"), { recursive: true });
  await fs.cp(contentOutDir, path.join(pipelineDir, "content"), { recursive: true });
}

async function main() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(appDir, { recursive: true });
  await fs.mkdir(contentOutDir, { recursive: true });

  const articles = await readArticles();
  const topics = buildTopics(articles);
  const manifest = buildManifest(articles, topics);
  const searchIndex = buildSearchIndex(articles);

  await copyAssets();
  await copyContentAssets();

  await writeText(path.join(appDir, "index.html"), renderHomePage(articles, topics));
  await writeText(
    path.join(appDir, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`,
  );
  await writeText(path.join(appDir, "sitemap.xml"), renderSitemap(articles, topics));
  await writeText(
    path.join(appDir, "manifest.webmanifest"),
    `${JSON.stringify(
      {
        name: siteName,
        short_name: "AI Tutorials",
        start_url: "/",
        display: "standalone",
        background_color: "#f6f8fb",
        theme_color: "#0b1020",
        icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      null,
      2,
    )}\n`,
  );
  await writeText(
    path.join(appDir, "favicon.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#0b1020"/><path d="M15 45 27 17h10l12 28h-9l-2-6H26l-2 6h-9Zm13-13h8l-4-11-4 11Z" fill="#67e8f9"/></svg>`,
  );

  for (const topic of topics) {
    await writeText(
      path.join(appDir, "topics", topic.slug, "index.html"),
      renderTopicPage(topic, articles, topics),
    );
  }

  await writeJson(path.join(contentOutDir, "content", "v1", "manifest.json"), manifest);
  await writeJson(path.join(contentOutDir, "content", "v1", "search-index.json"), searchIndex);
  await writeJson(path.join(contentOutDir, "content", "v1", "topics.json"), { topics });

  for (const article of articles) {
    await writeText(
      path.join(contentOutDir, "tutorials", article.slug, "index.html"),
      renderArticlePage(article, articles),
    );
    await writeJson(
      path.join(contentOutDir, "content", "v1", "articles", article.slug, "index.json"),
      buildArticleJson(article),
    );
  }

  await copyPipelineArtifact();
  console.log(`Built ${articles.length} tutorials into ${path.relative(rootDir, distDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const searchState = {
  index: null,
  loading: null,
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadSearchIndex() {
  if (searchState.index) return searchState.index;
  if (!searchState.loading) {
    searchState.loading = fetch("/content/v1/search-index.json", { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Search index request failed: ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        searchState.index = payload.documents || [];
        return searchState.index;
      });
  }
  return searchState.loading;
}

function scoreDocument(document, terms) {
  const haystack = `${document.title} ${document.topic} ${document.tags.join(" ")} ${document.text}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (document.title.toLowerCase().includes(term)) score += 8;
    if (document.topic.toLowerCase().includes(term)) score += 5;
    if (document.tags.some((tag) => tag.toLowerCase().includes(term))) score += 4;
    if (haystack.includes(term)) score += 1;
  }
  return score;
}

function renderSearchResults(container, documents, query) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  const matches = terms.length
    ? documents
        .map((document) => ({ document, score: scoreDocument(document, terms) }))
        .filter((match) => match.score > 0)
        .sort((left, right) => right.score - left.score || left.document.title.localeCompare(right.document.title))
        .slice(0, 8)
        .map((match) => match.document)
    : documents.slice(0, 8);

  if (!matches.length) {
    container.innerHTML = '<p class="empty-state">No matching tutorials.</p>';
    return;
  }

  container.innerHTML = matches
    .map(
      (document) => `
        <a class="search-result" href="${document.url}">
          <span>${escapeHtml(document.topic)}</span>
          <strong>${escapeHtml(document.title)}</strong>
          <p>${escapeHtml(document.description)}</p>
        </a>
      `,
    )
    .join("");
}

function initSearch() {
  const dialog = document.querySelector("[data-search-dialog]");
  const input = document.querySelector("[data-search-input]");
  const results = document.querySelector("[data-search-results]");
  const triggers = document.querySelectorAll("[data-search-open]");

  if (!dialog || !input || !results || !triggers.length) return;

  async function openSearch() {
    if (!dialog.open) dialog.showModal();
    input.focus();
    results.innerHTML = '<p class="empty-state">Loading tutorials...</p>';
    try {
      const documents = await loadSearchIndex();
      renderSearchResults(results, documents, input.value);
    } catch {
      results.innerHTML = '<p class="empty-state">Search is unavailable right now.</p>';
    }
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", openSearch);
  });

  input.addEventListener("input", async () => {
    const documents = await loadSearchIndex();
    renderSearchResults(results, documents, input.value);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !event.metaKey && !event.ctrlKey && document.activeElement?.tagName !== "INPUT") {
      event.preventDefault();
      openSearch();
    }
  });
}

function initCopyButtons() {
  document.querySelectorAll(".code-frame").forEach((frame) => {
    const button = frame.querySelector(".copy-button");
    const code = frame.querySelector("code");
    if (!button || !code) return;

    button.addEventListener("click", async () => {
      const original = button.textContent;
      try {
        await navigator.clipboard.writeText(code.textContent || "");
        button.textContent = "Copied";
      } catch {
        button.textContent = "Failed";
      }
      window.setTimeout(() => {
        button.textContent = original;
      }, 1400);
    });
  });
}

function initToc() {
  const links = [...document.querySelectorAll(".toc-nav a")];
  const headings = [...document.querySelectorAll(".article-content h2[id], .article-content h3[id]")];
  if (!links.length || !headings.length || !("IntersectionObserver" in window)) return;

  const linkById = new Map(
    links.map((link) => [decodeURIComponent(link.getAttribute("href").slice(1)), link]),
  );

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
      if (!visible.length) return;

      links.forEach((link) => link.classList.remove("is-active"));
      const active = linkById.get(visible[0].target.id);
      active?.classList.add("is-active");
    },
    {
      rootMargin: "-18% 0px -68% 0px",
      threshold: 0.01,
    },
  );

  headings.forEach((heading) => observer.observe(heading));
}

function initExternalLinks() {
  document.querySelectorAll('a[href^="http"]').forEach((link) => {
    if (link.hostname !== window.location.hostname) {
      link.rel = "noopener noreferrer";
    }
  });
}

initSearch();
initCopyButtons();
initToc();
initExternalLinks();

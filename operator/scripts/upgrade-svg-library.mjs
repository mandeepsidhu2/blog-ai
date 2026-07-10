#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const assetsDirFlag = process.argv.indexOf("--assets-dir");
if (assetsDirFlag >= 0 && !process.argv[assetsDirFlag + 1]) {
  throw new Error("--assets-dir requires a directory path");
}
const assetsDir =
  assetsDirFlag >= 0
    ? path.resolve(process.argv[assetsDirFlag + 1] || "")
    : path.join(rootDir, "content", "assets");
const checkOnly = process.argv.includes("--check");
const visualMarker = "fieldbook-visual-system:v2";
const textFitMarker = 'data-text-fit="bounded"';

const colorMap = new Map([
  ["#ffffff", "#121a23"],
  ["#f8fafc", "#101720"],
  ["#f7fafc", "#101720"],
  ["#f8fbfd", "#101720"],
  ["#f8fbff", "#101720"],
  ["#f8faf7", "#101720"],
  ["#f7faf8", "#101720"],
  ["#f7fbf8", "#101720"],
  ["#f7fbff", "#101720"],
  ["#f5f9f6", "#101720"],
  ["#f5f7f2", "#101720"],
  ["#f6f7f2", "#101720"],
  ["#f7f3ea", "#101720"],
  ["#f1f5f9", "#17212b"],
  ["#e2e8f0", "#253240"],
  ["#cbd5e1", "#334250"],
  ["#d4c7b4", "#334250"],
  ["#d6dee8", "#334250"],
  ["#d5dde6", "#334250"],
  ["#ced7ca", "#334250"],
  ["#c9d5cf", "#334250"],
  ["#b9c9bf", "#334250"],
  ["#dbeafe", "#102938"],
  ["#e0f2fe", "#102938"],
  ["#eff6ff", "#102938"],
  ["#ecfeff", "#102938"],
  ["#eaf4f6", "#102938"],
  ["#eef7f8", "#102938"],
  ["#edf7ff", "#102938"],
  ["#e9f0fb", "#102938"],
  ["#e6f0fb", "#102938"],
  ["#dcfce7", "#11291f"],
  ["#ecfdf5", "#11291f"],
  ["#f0fdf4", "#11291f"],
  ["#dff0e6", "#11291f"],
  ["#e7f1ea", "#11291f"],
  ["#e8f3ef", "#11291f"],
  ["#eef8ed", "#11291f"],
  ["#e8f6f0", "#11291f"],
  ["#e9f5f2", "#11291f"],
  ["#fef3c7", "#302418"],
  ["#fefce8", "#302418"],
  ["#fff7ed", "#302418"],
  ["#fff4df", "#302418"],
  ["#fff8e9", "#302418"],
  ["#fffaf0", "#302418"],
  ["#f8efe4", "#302418"],
  ["#fff2e5", "#302418"],
  ["#fff4eb", "#302418"],
  ["#fff5e6", "#302418"],
  ["#fff2cf", "#302418"],
  ["#fee2e2", "#32191e"],
  ["#fef2f2", "#32191e"],
  ["#fff1f2", "#32191e"],
  ["#fdebec", "#32191e"],
  ["#f8d9da", "#32191e"],
  ["#f4e7eb", "#32191e"],
  ["#fdf2f2", "#32191e"],
  ["#f5f3ff", "#211b35"],
  ["#ede9fe", "#211b35"],
  ["#fae8ff", "#211b35"],
  ["#f1edfb", "#211b35"],
  ["#f1ecfb", "#211b35"],
  ["#eef1fa", "#211b35"],
  ["#eef2ff", "#211b35"],
  ["#f8edf8", "#211b35"],
  ["#f6eef8", "#211b35"],
  ["#2563eb", "#52dcef"],
  ["#1f6feb", "#52dcef"],
  ["#275dad", "#52dcef"],
  ["#315fba", "#52dcef"],
  ["#4464ad", "#52dcef"],
  ["#3b5ba9", "#52dcef"],
  ["#1e40af", "#52dcef"],
  ["#1d4ed8", "#52dcef"],
  ["#0284c7", "#52dcef"],
  ["#0369a1", "#52dcef"],
  ["#0891b2", "#52dcef"],
  ["#2274a5", "#52dcef"],
  ["#0f766e", "#43d6a0"],
  ["#126e6a", "#43d6a0"],
  ["#167c6b", "#43d6a0"],
  ["#19766f", "#43d6a0"],
  ["#1f766e", "#43d6a0"],
  ["#1f7a6d", "#43d6a0"],
  ["#1f7a8c", "#43d6a0"],
  ["#1f6f8b", "#43d6a0"],
  ["#1e5e54", "#43d6a0"],
  ["#1b998b", "#43d6a0"],
  ["#216869", "#43d6a0"],
  ["#2f7d5f", "#43d6a0"],
  ["#047857", "#43d6a0"],
  ["#059669", "#43d6a0"],
  ["#16a34a", "#b8f56a"],
  ["#166534", "#b8f56a"],
  ["#14532d", "#b8f56a"],
  ["#7c3aed", "#9b87ff"],
  ["#7d5fff", "#9b87ff"],
  ["#7457c8", "#9b87ff"],
  ["#6d5bd0", "#9b87ff"],
  ["#6c4bb5", "#9b87ff"],
  ["#574099", "#9b87ff"],
  ["#5f4b8b", "#9b87ff"],
  ["#6b5b95", "#9b87ff"],
  ["#8b5cf6", "#9b87ff"],
  ["#d97706", "#ffb84d"],
  ["#f59e0b", "#ffb84d"],
  ["#fbbf24", "#ffb84d"],
  ["#f5d46c", "#ffb84d"],
  ["#f97316", "#ff9b55"],
  ["#ea580c", "#ff9b55"],
  ["#dc2626", "#ff657a"],
  ["#b91c1c", "#ff657a"],
  ["#b43f3f", "#ff657a"],
  ["#b23a48", "#ff657a"],
  ["#c43b3b", "#ff657a"],
  ["#d64a3a", "#ff657a"],
  ["#d95d39", "#ff657a"],
  ["#94a3b8", "#40515f"],
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
}

function svgDimensions(svg, fileName) {
  const viewBox = svg.match(/\bviewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (!viewBox) {
    throw new Error(`Missing viewBox in ${fileName}`);
  }
  return { width: Number(viewBox[1]), height: Number(viewBox[2]) };
}

function removeCanvasBackground(svg, width, height, fileName) {
  const rectangles = [...svg.matchAll(/<rect\b[^>]*\/?\s*>/gi)];
  const canvas = rectangles.find((match) => {
    const tag = match[0];
    const widthMatch = tag.match(/\bwidth=["']([\d.]+)["']/i);
    const heightMatch = tag.match(/\bheight=["']([\d.]+)["']/i);
    return Number(widthMatch?.[1]) === width && Number(heightMatch?.[1]) === height;
  });
  if (!canvas) {
    throw new Error(`Could not identify canvas background in ${fileName}`);
  }
  return svg.slice(0, canvas.index) + svg.slice(canvas.index + canvas[0].length);
}

function normalizeSvg(svg) {
  let result = svg
    .replace(/Arial,\s*Helvetica,\s*sans-serif/gi, "Inter, system-ui, sans-serif")
    .replace(/Arial,\s*sans-serif/gi, "Inter, system-ui, sans-serif")
    .replace(/Helvetica,\s*sans-serif/gi, "system-ui, sans-serif")
    .replace(/\bArial\b/gi, "Inter")
    .replace(/\bHelvetica\b/gi, "system-ui")
    .replace(/\brx=["']([\d.]+)["']/gi, (match, value) =>
      Number(value) > 8 ? 'rx="8"' : match,
    );

  for (const [from, to] of colorMap) {
    result = result.replace(new RegExp(escapeRegExp(from), "gi"), to);
  }
  return result;
}

function visualType(fileName) {
  if (fileName.startsWith("measure-")) return "MEASURED RESULTS";
  if (fileName.includes("budgeted-guardrails") || fileName.includes("context-boundary")) {
    return "RESEARCH RESULT";
  }
  return "SYSTEM ARCHITECTURE";
}

function classFontSize(svg, className, fallback) {
  const classPattern = new RegExp(
    `\\.${escapeRegExp(className)}(?:\\s*,[^\\{]+)?\\s*\\{[^}]*?font(?:-size)?\\s*:[^;}]*?([\\d.]+)px`,
    "i",
  );
  return Number(svg.match(classPattern)?.[1] || fallback);
}

function removeOverlappingTopLegends(svg) {
  return svg.replace(
    /\s*<g\s+transform=["']translate\(([\d.]+)\s+12[5-7]\)["']>([\s\S]*?)<\/g>/gi,
    (match, _x, contents) =>
      /class=["'][^"']*\blegend\b/i.test(contents) &&
      !/<(?:rect|circle|path|line|polyline|polygon)\b/i.test(contents)
        ? ""
        : match,
  );
}

function balancedLines(text) {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return null;
  let best = null;
  for (let index = 1; index < words.length; index += 1) {
    const lines = [words.slice(0, index).join(" "), words.slice(index).join(" ")];
    const score = Math.max(lines[0].length, lines[1].length);
    if (!best || score < best.score) best = { lines, score };
  }
  return best?.lines || null;
}

function fitPanelLabels(svg) {
  return svg.replace(/<g\b([^>]*)>([\s\S]*?)<\/g>/gi, (group, groupAttributes, contents) => {
    const rectangles = [...contents.matchAll(/<rect\b([^>]*)\/?\s*>/gi)];
    if (rectangles.length !== 1) return group;

    const rectAttributes = rectangles[0][1];
    const rectX = Number(rectAttributes.match(/\bx=["']([\d.-]+)["']/i)?.[1] || 0);
    const rectY = Number(rectAttributes.match(/\by=["']([\d.-]+)["']/i)?.[1] || 0);
    const rectWidth = Number(rectAttributes.match(/\bwidth=["']([\d.]+)["']/i)?.[1]);
    const rectHeight = Number(rectAttributes.match(/\bheight=["']([\d.]+)["']/i)?.[1]);
    if (!Number.isFinite(rectWidth) || !Number.isFinite(rectHeight)) return group;

    const nextContents = contents.replace(
      /<text\b([^>]*)>([^<]*)<\/text>/gi,
      (textElement, attributes, text) => {
        if (/\b(?:textLength|text-anchor)=["']/i.test(attributes)) return textElement;
        const x = Number(attributes.match(/\bx=["']([\d.-]+)["']/i)?.[1]);
        const y = Number(attributes.match(/\by=["']([\d.-]+)["']/i)?.[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < rectX || x >= rectX + rectWidth) {
          return textElement;
        }

        const classNames = attributes.match(/\bclass=["']([^"']+)["']/i)?.[1]?.split(/\s+/) || [];
        const className = classNames.find((name) =>
          ["small", "body", "label", "smallTitle", "headtext"].includes(name),
        );
        const fallback = className === "smallTitle" ? 19 : className === "small" ? 15 : 17;
        const fontSize = className ? classFontSize(svg, className, fallback) : fallback;
        const availableWidth = Math.max(1, rectX + rectWidth - x - 12);
        const visibleText = text.replace(/&(?:#\d+|#x[\da-f]+|\w+);/gi, "X").trim();
        if (visibleText.length * fontSize * 0.53 <= availableWidth) return textElement;

        const lines = balancedLines(text);
        const lineHeight = Math.round(fontSize * 1.2);
        if (
          lines &&
          ["small", "body"].includes(className) &&
          y + lineHeight <= rectY + rectHeight - 6
        ) {
          return `<text${attributes}><tspan x="${x}" dy="0">${lines[0]}</tspan><tspan x="${x}" dy="${lineHeight}">${lines[1]}</tspan></text>`;
        }

        return `<text${attributes} textLength="${Math.floor(availableWidth)}" lengthAdjust="spacingAndGlyphs">${text}</text>`;
      },
    );
    return `<g${groupAttributes}>${nextContents}</g>`;
  });
}

function deepenLargeAccentPanels(svg) {
  return svg.replace(/<rect\b([^>]*)\/?\s*>/gi, (rect, attributes) => {
    const width = Number(attributes.match(/\bwidth=["']([\d.]+)["']/i)?.[1]);
    if (width > 500 && /\bfill=["']#ffb84d["']/i.test(attributes)) {
      return rect.replace(/#ffb84d/gi, "#925d18");
    }
    return rect;
  });
}

function removeMisplacedFrameDivider(svg, height) {
  if (height <= 600) return svg;
  return svg.replace(
    /\s*<line x1=["']24["'] y1=["']116["'] x2=["'][\d.]+["'] y2=["']116["'] stroke=["']#2a3641["'] stroke-width=["']1["']\/>/i,
    "",
  );
}

function fitCanvasLabels(svg, width, height) {
  const rectangles = [...svg.matchAll(/<rect\b([^>]*)\/?\s*>/gi)]
    .map((match) => {
      const attributes = match[1];
      const rectWidth = Number(attributes.match(/\bwidth=["']([\d.]+)["']/i)?.[1]);
      const rectHeight = Number(attributes.match(/\bheight=["']([\d.]+)["']/i)?.[1]);
      return {
        x: Number(attributes.match(/\bx=["']([\d.-]+)["']/i)?.[1] || 0),
        y: Number(attributes.match(/\by=["']([\d.-]+)["']/i)?.[1] || 0),
        width: rectWidth,
        height: rectHeight,
      };
    })
    .filter((rect) => Number.isFinite(rect.width) && Number.isFinite(rect.height));
  rectangles.push({ x: 0, y: 0, width, height });

  return svg.replace(/<text\b([^>]*)>([^<]*)<\/text>/gi, (textElement, attributes, text) => {
    if (/\b(?:textLength|text-anchor)=["']/i.test(attributes)) return textElement;
    const x = Number(attributes.match(/\bx=["']([\d.-]+)["']/i)?.[1]);
    const y = Number(attributes.match(/\by=["']([\d.-]+)["']/i)?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return textElement;

    const containers = rectangles
      .filter(
        (rect) =>
          x >= rect.x &&
          x < rect.x + rect.width &&
          y >= rect.y &&
          y <= rect.y + rect.height,
      )
      .sort((left, right) => left.width * left.height - right.width * right.height);
    const container = containers[0];
    if (!container) return textElement;

    const className = attributes.match(/\bclass=["']([^"']+)["']/i)?.[1]?.split(/\s+/)[0];
    const explicitSize = Number(attributes.match(/\bfont-size=["']([\d.]+)["']/i)?.[1]);
    const fontSize = Number.isFinite(explicitSize)
      ? explicitSize
      : className
        ? classFontSize(svg, className, 16)
        : 16;
    const visibleText = text.replace(/&(?:#\d+|#x[\da-f]+|\w+);/gi, "X").trim();
    const estimatedWidth = visibleText.length * fontSize * 0.53;
    const availableWidth = Math.max(1, container.x + container.width - x - 12);
    if (estimatedWidth <= availableWidth) return textElement;

    return `<text${attributes} textLength="${Math.floor(availableWidth)}" lengthAdjust="spacingAndGlyphs">${text}</text>`;
  });
}

function fitLongLabels(svg, width) {
  const fontDefaults = new Map([
    ["title", { size: 34, characterWidth: 0.56 }],
    ["subtitle", { size: 16, characterWidth: 0.52 }],
    ["note", { size: 16, characterWidth: 0.52 }],
  ]);
  let result = svg.includes(textFitMarker)
    ? svg
    : svg.replace(/<svg\b([^>]*)>/i, `<svg$1 ${textFitMarker}>`);

  result = result.replace(/<text\b([^>]*)>([^<]*)<\/text>/gi, (match, attributes, text) => {
    if (/\btextLength=["']/i.test(attributes) || /\btext-anchor=["']end["']/i.test(attributes)) {
      return match;
    }
    const className = attributes.match(/\bclass=["']([^"']+)["']/i)?.[1]
      ?.split(/\s+/)
      .find((name) => fontDefaults.has(name));
    if (!className) return match;

    const x = Number(attributes.match(/\bx=["']([\d.]+)["']/i)?.[1]);
    if (!Number.isFinite(x)) return match;
    const { size: fallback, characterWidth } = fontDefaults.get(className);
    const fontSize = classFontSize(result, className, fallback);
    const visibleText = text.replace(/&(?:#\d+|#x[\da-f]+|\w+);/gi, "X").trim();
    const estimatedWidth = visibleText.length * fontSize * characterWidth;
    const availableWidth = Math.max(1, width - x - 28);
    if (estimatedWidth <= availableWidth) return match;

    return `<text${attributes} textLength="${Math.floor(availableWidth)}" lengthAdjust="spacingAndGlyphs">${text}</text>`;
  });

  return result;
}

function upgradeSvg(svg, fileName) {
  const { width, height } = svgDimensions(svg, fileName);
  if (svg.includes(visualMarker)) {
    let repaired = fitPanelLabels(removeOverlappingTopLegends(svg));
    repaired = deepenLargeAccentPanels(removeMisplacedFrameDivider(repaired, height));
    repaired = fitCanvasLabels(repaired, width, height);
    return fitLongLabels(repaired, width).replace(/[ \t]+$/gm, "");
  }

  let result = removeCanvasBackground(svg, width, height, fileName);
  result = normalizeSvg(result);
  result = result.replace(
    /<svg\b([^>]*)>/i,
    `<svg$1 data-visual-quality="publication" data-visual-system="fieldbook-v2">`,
  );

  const descEnd = result.indexOf("</desc>");
  if (descEnd === -1) throw new Error(`Missing <desc> in ${fileName}`);

  const background = `
  <!-- ${visualMarker} -->
  <defs id="fieldbook-v2-defs">
    <pattern id="fieldbook-grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#27323d" stroke-width="1"/>
    </pattern>
  </defs>
  <g aria-hidden="true" data-fieldbook-frame="background">
    <rect width="${width}" height="${height}" fill="#080c12"/>
    <rect width="${width}" height="${height}" fill="url(#fieldbook-grid)" opacity="0.32"/>
  </g>`;
  result = result.slice(0, descEnd + 7) + background + result.slice(descEnd + 7);

  const label = visualType(fileName);
  const divider =
    height <= 600
      ? `    <line x1="24" y1="116" x2="${width - 24}" y2="116" stroke="#2a3641" stroke-width="1"/>\n`
      : "";
  const overlay = `
  <style id="fieldbook-v2-theme">
    text { fill: #e4eaed !important; font-family: Inter, system-ui, sans-serif !important; letter-spacing: 0; }
    .title { fill: #f7faf9 !important; font-weight: 750 !important; }
    .subtitle, .sub, .note, .axis, .legend, .body, .small { fill: #8d9aa6 !important; }
    .label, .smallTitle, .metric, .headtext { fill: #e7edef !important; }
    path, line, polyline { stroke-linecap: round; stroke-linejoin: round; }
    .fieldbook-kicker { fill: #73818e !important; font-family: ui-monospace, SFMono-Regular, Consolas, monospace !important; font-size: ${Math.max(11, Math.round(width / 90))}px !important; font-weight: 750 !important; }
  </style>
  <g aria-hidden="true" data-fieldbook-frame="overlay">
${divider}    <circle cx="28" cy="26" r="4" fill="#b8f56a"/>
    <circle cx="42" cy="26" r="4" fill="#52dcef"/>
    <text class="fieldbook-kicker" x="${width - 24}" y="30" text-anchor="end">AI SYSTEMS FIELDBOOK / ${label}</text>
    <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="none" stroke="#2b3742" stroke-width="1"/>
  </g>`;
  result = result.replace(/\s*<\/svg>\s*$/i, `${overlay}\n</svg>\n`);
  result = fitPanelLabels(removeOverlappingTopLegends(result));
  result = deepenLargeAccentPanels(removeMisplacedFrameDivider(result, height));
  result = fitCanvasLabels(result, width, height);
  return fitLongLabels(result, width).replace(/[ \t]+$/gm, "");
}

async function main() {
  const entries = await fs.readdir(assetsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
    .map((entry) => entry.name)
    .sort();

  const stale = [];
  let upgraded = 0;
  for (const fileName of files) {
    const filePath = path.join(assetsDir, fileName);
    const original = await fs.readFile(filePath, "utf8");
    if (checkOnly) {
      if (
        !original.includes(visualMarker) ||
        !original.includes(textFitMarker) ||
        upgradeSvg(original, fileName) !== original
      ) {
        stale.push(fileName);
      }
      continue;
    }
    const next = upgradeSvg(original, fileName);
    if (next !== original) {
      await fs.writeFile(filePath, next);
      upgraded += 1;
    }
  }

  if (stale.length) {
    throw new Error(`SVG visual system is missing from: ${stale.join(", ")}`);
  }
  console.log(
    checkOnly
      ? `SVG visual-system check passed for ${files.length} assets.`
      : `Upgraded ${upgraded} of ${files.length} SVG assets.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

#!/usr/bin/env python3
"""Render the evidence figure directly from results.json."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).parent
data = json.loads((ROOT / "results.json").read_text())
rows = sorted(
    data["localeResults"].items(),
    key=lambda item: item[1]["cl100k_base"]["ratioToAlignedEnglish"],
    reverse=True,
)

width, height = 1280, 720
left, top, chart_w, row_h = 310, 120, 820, 32
max_ratio = max(v["cl100k_base"]["ratioToAlignedEnglish"] for _, v in rows)
scale = chart_w / max(1.8, max_ratio)

parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" data-visual-quality="publication" data-text-fit="bounded">
<title>Token ratios to aligned English across fourteen MMMLU translations</title>
<desc>Paired bars compare cl100k base and o200k base token counts for each translated language, with English normalized to one.</desc>
<rect width="1280" height="720" fill="#08131f"/>
<text x="72" y="58" fill="#f1f5f9" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="28" font-weight="700">Multilingual token inflation fell, but did not disappear</text>
<text x="72" y="88" fill="#94a3b8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15">1,140 aligned questions · 57 subjects · English = 1.00 · lower is fewer tokens</text>
<line x1="{left + scale}" y1="108" x2="{left + scale}" y2="590" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 5"/>
<text x="{left + scale - 18}" y="615" fill="#cbd5e1" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13">1.0×</text>''']

for index, (locale, values) in enumerate(rows):
    y = top + index * row_h
    cl = values["cl100k_base"]["ratioToAlignedEnglish"]
    o2 = values["o200k_base"]["ratioToAlignedEnglish"]
    parts.append(f'''<text x="{left - 18}" y="{y + 15}" text-anchor="end" fill="#dbeafe" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14">{locale}</text>
<rect x="{left}" y="{y}" width="{cl * scale:.1f}" height="11" rx="3" fill="#f59e0b"/>
<rect x="{left}" y="{y + 14}" width="{o2 * scale:.1f}" height="11" rx="3" fill="#38bdf8"/>
<text x="{left + cl * scale + 8:.1f}" y="{y + 10}" fill="#fcd34d" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">{cl:.2f}×</text>
<text x="{left + o2 * scale + 8:.1f}" y="{y + 24}" fill="#7dd3fc" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">{o2:.2f}×</text>''')

agg = data["aggregate"]
parts.append(f'''<rect x="72" y="624" width="1136" height="58" rx="8" fill="#102235" stroke="#24445f"/>
<circle cx="96" cy="647" r="6" fill="#f59e0b"/><text x="110" y="652" fill="#e2e8f0" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13">cl100k_base</text>
<circle cx="250" cy="647" r="6" fill="#38bdf8"/><text x="264" y="652" fill="#e2e8f0" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13">o200k_base</text>
<text x="450" y="652" fill="#f8fafc" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14">Median inflation: {agg['medianCl100kInflationPercent']:.1f}% → {agg['medianO200kInflationPercent']:.1f}%</text>
<text x="940" y="652" fill="#a7f3d0" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="14">{agg['languagesImproved']}/{agg['languagesTotal']} improved</text>
<text x="96" y="672" fill="#94a3b8" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11">Ratios use summed paired token counts; uncertainty and comparability limits are reported in the article.</text>
</svg>''')

(ROOT / "multilingual-token-cost-audit.svg").write_text("\n".join(parts) + "\n")
print(ROOT / "multilingual-token-cost-audit.svg")

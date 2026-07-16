import html
import json
import pathlib


PROJECT = pathlib.Path(__file__).resolve().parent
RESULTS = json.loads((PROJECT / "results.json").read_text())


def find_cell(design, alignment, capacity, ttl, cadence):
    return next(
        cell
        for cell in RESULTS["cells"]
        if cell["design"] == design
        and cell["alignment"] == alignment
        and cell["capacityFraction"] == capacity
        and cell["ttlMinutes"] == ttl
        and cell["meanInterarrivalSeconds"] == cadence
    )


alignments = ["large-popular", "independent", "small-popular"]
labels = {
    "large-popular": "Large prefixes popular",
    "independent": "Size and popularity independent",
    "small-popular": "Small prefixes popular",
}
colors = {
    "request": "#f6c453",
    "token": "#5eead4",
    "savings": "#8fb7ff",
}


def panel(x, y, width, height, capacity, ttl, cadence):
    left = x + 70
    right = x + width - 26
    top = y + 64
    bottom = y + height - 70
    chart_height = bottom - top
    group_width = (right - left) / len(alignments)
    marks = [
        f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="10" '
        'fill="#111b32" stroke="#2b3b5c"/>',
        f'<text x="{x + 24}" y="{y + 35}" class="panel-title">'
        f'{int(capacity * 100)}% capacity • {ttl}m TTL • mean arrival {cadence}s</text>',
    ]
    for tick in [0.0, 0.2, 0.4, 0.6, 0.8]:
        tick_y = bottom - tick * chart_height
        marks.append(
            f'<line x1="{left}" y1="{tick_y}" x2="{right}" y2="{tick_y}" '
            'stroke="#344464" stroke-dasharray="4 5"/>'
        )
        marks.append(
            f'<text x="{left - 10}" y="{tick_y + 4}" class="axis" '
            f'text-anchor="end">{int(tick * 100)}%</text>'
        )

    for index, alignment in enumerate(alignments):
        cell = find_cell("observed-size", alignment, capacity, ttl, cadence)
        center = left + group_width * index + group_width / 2
        values = [
            ("request", cell["metrics"]["requestHitRate"]["mean"]),
            ("token", cell["metrics"]["tokenHitRate"]["mean"]),
            ("savings", cell["metrics"]["savingsRate"]["mean"]),
        ]
        for offset, (key, value) in enumerate(values):
            bar_width = 24
            bar_x = center + (offset - 1) * 31 - bar_width / 2
            bar_y = bottom - value * chart_height
            marks.append(
                f'<rect x="{bar_x}" y="{bar_y}" width="{bar_width}" '
                f'height="{bottom - bar_y}" rx="4" fill="{colors[key]}"/>'
            )
            marks.append(
                f'<text x="{bar_x + bar_width / 2}" y="{bar_y - 7}" '
                f'class="value" text-anchor="middle">{value * 100:.1f}</text>'
            )
        words = labels[alignment].split()
        first = " ".join(words[:2])
        second = " ".join(words[2:])
        marks.append(
            f'<text x="{center}" y="{bottom + 24}" class="label" '
            f'text-anchor="middle">{html.escape(first)}</text>'
        )
        if second:
            marks.append(
                f'<text x="{center}" y="{bottom + 41}" class="label" '
                f'text-anchor="middle">{html.escape(second)}</text>'
            )
    return "\n".join(marks)


legend = []
for index, (key, label) in enumerate(
    [
        ("request", "Request hit rate"),
        ("token", "Token-weighted hit rate"),
        ("savings", "Input-cost savings"),
    ]
):
    x = 165 + index * 280
    legend.append(
        f'<rect x="{x}" y="121" width="14" height="14" rx="3" '
        f'fill="{colors[key]}"/><text x="{x + 22}" y="133" '
        f'class="legend">{label}</text>'
    )

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"
 width="1280" height="720" data-visual-quality="publication"
 data-text-fit="bounded" role="img" aria-labelledby="title desc">
<title id="title">Prompt-cache request hits, token hits, and cost savings diverge</title>
<desc id="desc">Two grouped bar panels compare request hit rate, token-weighted hit rate,
and modeled input-cost savings for workloads where large prefixes are popular,
prefix size and popularity are independent, or small prefixes are popular.
Values average 40 independently seeded traces of 12,000 requests.</desc>
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop stop-color="#07101f"/><stop offset="1" stop-color="#10213b"/>
</linearGradient></defs>
<rect width="1280" height="720" fill="url(#bg)"/>
<style>
text{{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;fill:#e5eefc}}
.eyebrow{{font-size:15px;letter-spacing:2px;fill:#8fb7ff}}
.title{{font-family:ui-sans-serif,system-ui,sans-serif;font-size:31px;font-weight:700}}
.subtitle{{font-size:14px;fill:#a9bad3}}
.panel-title{{font-size:17px;font-weight:700}}
.axis{{font-size:12px;fill:#9fb0c9}}
.label{{font-size:11px;fill:#c8d5e8}}
.legend{{font-size:13px;fill:#c8d5e8}}
.value{{font-size:11px;font-weight:700}}
.note{{font-size:13px;fill:#9fb0c9}}
</style>
<text x="56" y="44" class="eyebrow">CONTROLLED CACHE SIMULATION • 40 TRACES PER CELL</text>
<text x="56" y="82" class="title">A high cache-hit rate can still save the wrong tokens</text>
<text x="56" y="106" class="subtitle">o200k token sizes from 52 committed articles; Zipf request popularity; whole-prefix LRU.</text>
{''.join(legend)}
{panel(42, 154, 582, 486, 0.2, 5, 3)}
{panel(656, 154, 582, 486, 0.2, 30, 180)}
<text x="56" y="678" class="note">Modeled billing: cache write 1.25× uncached input; cache read 0.10×; hits refresh TTL.</text>
<text x="56" y="700" class="note">Scope: metric and policy behavior under the declared trace model—not provider latency or production cache residency.</text>
</svg>
"""
(PROJECT / "prompt-cache-metric-audit.svg").write_text(svg)
print("wrote prompt-cache-metric-audit.svg from results.json")

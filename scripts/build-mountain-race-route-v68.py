from __future__ import annotations

import sys
from pathlib import Path

from collections import deque

from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets" / "mountain-race" / "images"
SOURCE = IMAGES / "summit-sprint-cartoon-route-source-v68.png"
OUTPUT = IMAGES / "summit-sprint-cartoon-route-v68.png"
MANIFEST = IMAGES / "summit-sprint-cartoon-route-v68.css"

SOURCE_WIDTH = 1024
SOURCE_HEIGHT = 1536
CROP_LEFT = 320
CROP_RIGHT = 704
OUTPUT_WIDTH = 1024
OUTPUT_HEIGHT = 4096
GROUND_SOURCE_Y = 1370

# These coordinates sit on the visible top plane or inner lip of the painted
# geology. Nothing is composited over the approved illustration.
CONTACTS = [
    (487, 1276), (522, 1236), (487, 1196), (491, 1156), (552, 1116),
    (476, 1076), (541, 1036), (454, 996), (548, 956), (451, 916),
    (503, 876), (462, 836), (543, 796), (491, 756), (536, 716),
    (493, 676), (459, 636), (555, 596), (478, 556), (505, 516),
    (446, 476), (542, 436), (463, 396), (518, 356), (466, 316),
    (539, 276), (500, 236), (540, 196), (480, 156), (512, 96),
]


def route_x(source_x: int) -> int:
    return round((source_x - CROP_LEFT) * OUTPUT_WIDTH / (CROP_RIGHT - CROP_LEFT))


def route_y(source_y: int) -> int:
    return round(source_y * OUTPUT_HEIGHT / SOURCE_HEIGHT)


def clear_connected_sky(route: Image.Image) -> Image.Image:
    """Expose only the border-connected blue sky for the moving CSS clouds."""
    rgb = route.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    sky = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def qualifies(x: int, y: int) -> bool:
        red, green, blue = pixels[x, y]
        return blue > 145 and blue - red > 42 and blue - green > 12

    def enqueue(x: int, y: int) -> None:
        offset = y * width + x
        if not sky[offset] and qualifies(x, y):
            sky[offset] = 1
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        row = y * width
        for x in range(width):
            if sky[row + x]:
                alpha_pixels[x, y] = 0
    alpha = alpha.filter(ImageFilter.GaussianBlur(.65))
    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    return rgba


def build() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)

    source = Image.open(SOURCE).convert("RGB")
    if source.size != (SOURCE_WIDTH, SOURCE_HEIGHT):
        raise RuntimeError(f"unexpected V68 source size: {source.size}")

    # One uniform scale from a single central crop. There are no repeated,
    # stitched, stretched, faded, or separately composited mountain sections.
    route = source.crop((CROP_LEFT, 0, CROP_RIGHT, SOURCE_HEIGHT))
    route = route.resize((OUTPUT_WIDTH, OUTPUT_HEIGHT), Image.Resampling.LANCZOS)
    route = route.filter(ImageFilter.UnsharpMask(radius=1.15, percent=72, threshold=3))
    route = ImageEnhance.Contrast(route).enhance(1.025)
    route = clear_connected_sky(route)
    route.save(OUTPUT, optimize=True)

    rows: list[str] = []
    for index, (source_x, source_y) in enumerate(CONTACTS):
        rows.append(f"  --mr-v68-hold-{index}-x:{route_x(source_x) / OUTPUT_WIDTH * 100:.3f}%;")
        rows.append(f"  --mr-v68-hold-{index}-y:{route_y(source_y)}px;")

    MANIFEST.write_text(
        ":root{\n"
        + "\n".join(rows)
        + f"\n  --mr-v68-route-width:{OUTPUT_WIDTH}px;"
        + f"\n  --mr-v68-route-height:{OUTPUT_HEIGHT}px;"
        + f"\n  --mr-v68-ground-y:{route_y(GROUND_SOURCE_Y)}px;"
        + f"\n  --mr-v68-summit-y:{route_y(CONTACTS[-1][1])}px;\n}}\n",
        encoding="utf-8",
    )
    print(f"built {OUTPUT} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    try:
        build()
    except Exception as error:
        print(f"V68 route build failed: {error}", file=sys.stderr)
        raise

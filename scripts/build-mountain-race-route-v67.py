from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets" / "mountain-race" / "images"
SOURCE = IMAGES / "summit-sprint-route-source-v67.png"
LEDGE_ATLAS = IMAGES / "summit-sprint-ledge-atlas-v67.png"
OUTPUT = IMAGES / "summit-sprint-unified-route-v67.png"
MANIFEST = IMAGES / "summit-sprint-unified-route-v67.css"

WIDTH = 1024
HEIGHT = 3072
GROUND_Y = 2760
FIRST_HOLD_Y = 2515
SUMMIT_Y = 154
HOLD_COUNT = 30
HOLD_X = [438, 586, 468, 610, 422, 560, 482, 604, 444, 574]


def clean_alpha(image: Image.Image, transparent_threshold: int = 8) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    alpha = alpha.point(lambda value: 0 if value <= transparent_threshold else min(255, round((value - transparent_threshold) * 255 / (255 - transparent_threshold))))
    rgba.putalpha(alpha)
    return rgba


def crop_alpha(image: Image.Image) -> Image.Image:
    box = image.getbbox()
    if box is None:
        raise RuntimeError("asset has no visible pixels")
    return image.crop(box)


def fit_width(image: Image.Image, width: int) -> Image.Image:
    height = round(image.height * width / image.width)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def contact_shadow(image: Image.Image, blur: int = 7, opacity: int = 94) -> Image.Image:
    alpha = image.getchannel("A")
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow.putalpha(alpha.point(lambda value: value * opacity // 255).filter(ImageFilter.GaussianBlur(blur)))
    return shadow


def build_base_route() -> Image.Image:
    source = clean_alpha(Image.open(SOURCE), 2)

    # One geometric operation only: take a tall central 1:3 crop and enlarge it
    # uniformly by exactly 2x. There are no repeats, stitched sections, vertical
    # stretching, fades, or generated filler bands anywhere in this route.
    crop_width = source.height // 3
    left = (source.width - crop_width) // 2
    central = source.crop((left, 0, left + crop_width, source.height))
    if central.width * 2 != WIDTH or central.height * 2 != HEIGHT:
        central = central.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    else:
        central = central.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)

    central = ImageEnhance.Contrast(central).enhance(1.05)
    central = ImageEnhance.Sharpness(central).enhance(1.12)
    return central


def atlas_ledges() -> list[Image.Image]:
    atlas = clean_alpha(Image.open(LEDGE_ATLAS), 10)
    ledges: list[Image.Image] = []
    for row in range(3):
        for column in range(2):
            x0 = column * atlas.width // 2
            x1 = (column + 1) * atlas.width // 2
            y0 = row * atlas.height // 3
            y1 = (row + 1) * atlas.height // 3
            ledge = crop_alpha(atlas.crop((x0, y0, x1, y1)))
            ledge = ImageEnhance.Color(ledge).enhance(.78)
            ledge = ImageEnhance.Contrast(ledge).enhance(1.03)
            ledges.append(ledge)
    return ledges


def composite_ledge(canvas: Image.Image, ledge: Image.Image, center_x: int, contact_y: int, width: int, mirror: bool = False) -> tuple[int, int, int, int]:
    hold = fit_width(ledge, width)
    if mirror:
        hold = ImageOps.mirror(hold)

    # The atlas was authored with the usable upper rock plane at about 34% of
    # the cutout height. Both climber contact and button overlay coordinates use
    # this exact line.
    top_ratio = .34
    x = round(center_x - hold.width / 2)
    y = round(contact_y - hold.height * top_ratio)
    shadow = contact_shadow(hold)
    canvas.alpha_composite(shadow, (x + 3, y + 7))
    canvas.alpha_composite(hold, (x, y))
    return x, y, hold.width, hold.height


def build() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    if not LEDGE_ATLAS.exists():
        raise FileNotFoundError(LEDGE_ATLAS)

    canvas = build_base_route()
    ledges = atlas_ledges()

    # A broad connected start shelf gives both boots an unmistakable support.
    # It is flattened into the same route bitmap and the grassy source terrain
    # remains visible around and beneath it.
    start = ledges[5]
    start_bounds = composite_ledge(canvas, start, WIDTH // 2, GROUND_Y, 720)
    start_x, start_y, start_width, _ = start_bounds
    grass = ImageDraw.Draw(canvas)
    for x in range(start_x + 26, start_x + start_width - 24, 13):
        blade = 5 + ((x * 7) % 12)
        grass.line((x, GROUND_Y - 2, x + ((x % 5) - 2), GROUND_Y - blade), fill=(76, 100, 42, 205), width=2)

    spacing = (FIRST_HOLD_Y - SUMMIT_Y) / (HOLD_COUNT - 1)
    rows: list[str] = []
    for index in range(HOLD_COUNT):
        final = index == HOLD_COUNT - 1
        center_x = WIDTH // 2 if final else HOLD_X[index % len(HOLD_X)]
        contact_y = SUMMIT_Y if final else round(FIRST_HOLD_Y - spacing * index)
        ledge = ledges[4 if final else index % len(ledges)]
        widths = [214, 196, 226, 202, 220, 200]
        width = 520 if final else widths[index % len(widths)]
        composite_ledge(canvas, ledge, center_x, contact_y, width, mirror=index % 4 == 1)
        rows.append(f"  --mr-v67-hold-{index}-x:{center_x / WIDTH * 100:.3f}%;")
        rows.append(f"  --mr-v67-hold-{index}-y:{contact_y}px;")

    canvas.save(OUTPUT, optimize=True)
    MANIFEST.write_text(
        ":root{\n"
        + "\n".join(rows)
        + f"\n  --mr-v67-route-width:{WIDTH}px;"
        + f"\n  --mr-v67-route-height:{HEIGHT}px;"
        + f"\n  --mr-v67-ground-y:{GROUND_Y}px;"
        + f"\n  --mr-v67-summit-y:{SUMMIT_Y}px;\n}}\n",
        encoding="utf-8",
    )
    print(f"built {OUTPUT} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    try:
        build()
    except Exception as error:
        print(f"V67 route build failed: {error}", file=sys.stderr)
        raise

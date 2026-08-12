from __future__ import annotations

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets" / "mountain-race" / "images"
SOURCE = IMAGES / "summit-sprint-route-source-v66.png"
LEDGE_SOURCE = IMAGES / "summit-sprint-natural-outcrop-1-v49.png"
LEDGE_SOURCES = [
    IMAGES / "summit-sprint-natural-outcrop-1-v49.png",
    IMAGES / "summit-sprint-natural-outcrop-2-v49.png",
    IMAGES / "summit-sprint-natural-outcrop-3-v49.png",
    IMAGES / "summit-sprint-natural-outcrop-4-v49.png",
]
OUTPUT = IMAGES / "summit-sprint-unified-route-v66.png"
MANIFEST = IMAGES / "summit-sprint-unified-route-v66.css"

WIDTH = 1024
HEIGHT = 4100
BASELINE_Y = 3640
SUMMIT_Y = 90
HOLD_COUNT = 30
HOLD_X = [430, 584, 458, 612, 420, 558, 470, 620, 438, 574]


def remove_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            key_distance = math.sqrt((255 - r) ** 2 + g**2 + (255 - b) ** 2)
            if key_distance <= 44:
                pixels[x, y] = (r, g, b, 0)
            elif key_distance < 150:
                alpha = round(a * ((key_distance - 44) / 106))
                pixels[x, y] = (min(r, g + 48), g, min(b, g + 48), alpha)
    return rgba


def crop_alpha(image: Image.Image) -> Image.Image:
    box = image.getbbox()
    if box is None:
        raise RuntimeError("image has no visible pixels")
    return image.crop(box)


def feather_segment(image: Image.Image, top: int, bottom: int) -> Image.Image:
    """Feather a native-resolution cliff crop without blurring its texture."""
    result = image.copy()
    alpha = result.getchannel("A")
    mask = Image.new("L", result.size, 255)
    pixels = mask.load()
    for y in range(result.height):
        strength = 1.0
        if top and y < top:
            strength = min(strength, y / top)
        if bottom and y >= result.height - bottom:
            strength = min(strength, (result.height - 1 - y) / bottom)
        value = max(0, min(255, round(255 * strength)))
        for x in range(result.width):
            pixels[x, y] = value
    result.putalpha(Image.composite(alpha, Image.new("L", result.size, 0), mask))
    return result


def assemble_native_mountain(source: Image.Image) -> Image.Image:
    """Build a tall route from overlapping 1:1 cliff crops.

    The previous cover operation enlarged a narrow slice of the source by 2.5x,
    which made the game visibly soft. These overlapping sections keep the
    generated texture at native width while varying the crop and reflection so
    the climb reads as one long face instead of a repeated wallpaper tile.
    """
    if source.width != WIDTH:
        source = source.resize((WIDTH, round(source.height * WIDTH / source.width)), Image.Resampling.LANCZOS)

    assembled = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))

    top_height = min(760, source.height)
    assembled.alpha_composite(feather_segment(source.crop((0, 0, WIDTH, top_height)), 0, 160))

    body_specs = [
        (210, 1110, 590, False),
        (330, 1230, 1260, True),
        (165, 1065, 1930, False),
        (355, 1255, 2600, True),
    ]
    for source_top, source_bottom, destination_y, mirror in body_specs:
        source_bottom = min(source_bottom, source.height)
        segment = source.crop((0, source_top, WIDTH, source_bottom))
        if mirror:
            segment = ImageOps.mirror(segment)
        segment = feather_segment(segment, 150, 150)
        assembled.alpha_composite(segment, (0, destination_y))

    bottom_height = min(540, source.height)
    bottom = source.crop((0, source.height - bottom_height, WIDTH, source.height))
    bottom = bottom.resize((WIDTH, 800), Image.Resampling.LANCZOS)
    bottom.putalpha(Image.new("L", bottom.size, 255))
    assembled.alpha_composite(bottom, (0, HEIGHT - bottom.height))
    return assembled


def multiply_rgba(image: Image.Image, factor: float) -> Image.Image:
    rgba = image.convert("RGBA")
    rgb = ImageEnhance.Brightness(rgba.convert("RGB")).enhance(factor)
    rgb.putalpha(rgba.getchannel("A"))
    return rgb


def shadow_for(image: Image.Image, blur: int, opacity: int) -> Image.Image:
    alpha = image.getchannel("A")
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow.putalpha(alpha.point(lambda value: value * opacity // 255).filter(ImageFilter.GaussianBlur(blur)))
    return shadow


def build() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)

    mountain_source = crop_alpha(remove_magenta(Image.open(SOURCE)))
    mountain = assemble_native_mountain(mountain_source)
    mountain = ImageEnhance.Contrast(mountain).enhance(1.06)
    mountain = ImageEnhance.Sharpness(mountain).enhance(1.12)

    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    canvas.alpha_composite(mountain)

    # Connect the route to a substantial foreground base before painting the
    # holds. Painting this last used to hide the first four physical ledges
    # while leaving their arrow coordinates visible.
    base_texture = mountain.crop((0, HEIGHT - 520, WIDTH, HEIGHT)).resize((WIDTH, 520), Image.Resampling.LANCZOS)
    base_mask = Image.new("L", (WIDTH, 520), 0)
    base_draw = ImageDraw.Draw(base_mask)
    base_draw.polygon([(0, 110), (90, 70), (220, 105), (352, 54), (500, 92), (650, 42), (820, 88), (1024, 58), (1024, 520), (0, 520)], fill=255)
    base_mask = base_mask.filter(ImageFilter.GaussianBlur(4))
    base_texture.putalpha(base_mask)
    canvas.alpha_composite(base_texture, (0, HEIGHT - 520))

    ledges: list[Image.Image] = []
    for path in LEDGE_SOURCES:
        ledge = crop_alpha(Image.open(path).convert("RGBA"))
        target_width = 248
        ledge = ledge.resize((target_width, round(ledge.height * target_width / ledge.width)), Image.Resampling.LANCZOS)
        ledge = ImageEnhance.Color(ledge).enhance(0.08)
        ledge = ImageEnhance.Contrast(ledge).enhance(0.80)
        ledge = multiply_rgba(ledge, 1.08)
        ledges.append(ledge)

    first_y = 3405
    final_y = SUMMIT_Y
    spacing = (first_y - final_y) / (HOLD_COUNT - 1)
    rows: list[str] = []
    for index in range(HOLD_COUNT):
        center_x = WIDTH // 2 if index == HOLD_COUNT - 1 else HOLD_X[index % len(HOLD_X)]
        center_y = round(first_y - spacing * index)
        ledge = ledges[index % len(ledges)]
        scale = [0.72, 0.65, 0.70, 0.63, 0.68, 0.64][index % 6]
        if index == HOLD_COUNT - 1:
            # The last grab is the broad existing summit rim, not another
            # platform placed below or above the mountain.
            scale = 1.86
        width = round(ledge.width * scale)
        height = round(ledge.height * scale)
        hold = ledge.resize((width, height), Image.Resampling.LANCZOS)
        if index % 4 == 1:
            hold = ImageOps.mirror(hold)

        rock_embed = 37 if index < HOLD_COUNT - 1 else round(height * .02)
        x = round(center_x - width / 2)
        y = round(center_y - height * 0.42 + rock_embed)

        # Only the underside contact shadow is retained. A broad rectangular
        # shadow would make the ledge read as a pasted-on card.
        shadow = shadow_for(hold, 6, 82)
        shadow_alpha = shadow.getchannel("A")
        shadow_alpha_draw = ImageDraw.Draw(shadow_alpha)
        shadow_alpha_draw.rectangle((0, 0, width, round(height * 0.42)), fill=0)
        shadow.putalpha(shadow_alpha)
        canvas.alpha_composite(shadow, (x + 2, y + 9))
        canvas.alpha_composite(hold, (x, y))

        # Repaint a narrow, irregular band of the surrounding mountain over the
        # rear of the shelf. This makes the ledge emerge from the cliff while
        # keeping its grabbable front lip clear; no pillar or floating shadow is
        # added beneath it.
        if index < HOLD_COUNT - 1:
            join_x = max(0, x + round(width * .12))
            join_y = max(0, y - 3)
            join_width = min(WIDTH - join_x, round(width * .76))
            join_height = min(HEIGHT - join_y, max(10, round(height * .27)))
            join = mountain.crop((join_x, join_y, join_x + join_width, join_y + join_height))
            join_mask = Image.new("L", (join_width, join_height), 0)
            join_draw = ImageDraw.Draw(join_mask)
            join_draw.polygon(
                [
                    (0, 0),
                    (join_width, 0),
                    (join_width, round(join_height * .55)),
                    (round(join_width * .77), round(join_height * .78)),
                    (round(join_width * .54), round(join_height * .57)),
                    (round(join_width * .31), round(join_height * .84)),
                    (0, round(join_height * .58)),
                ],
                fill=235,
            )
            join_mask = join_mask.filter(ImageFilter.GaussianBlur(2))
            join.putalpha(Image.composite(join.getchannel("A"), Image.new("L", join.size, 0), join_mask))
            canvas.alpha_composite(join, (join_x, join_y))

        # The contact coordinate is the ledge's top face. Runtime arrows and
        # climber hands use this same immutable route-space point.
        contact_y = y + round(height * 0.40)
        rows.append(f"  --mr-v66-hold-{index}-x:{center_x / WIDTH * 100:.3f}%;")
        rows.append(f"  --mr-v66-hold-{index}-y:{contact_y}px;")

    # A restrained grass seam is painted onto the connected base, never floated.
    ground_draw = ImageDraw.Draw(canvas)
    for x in range(0, WIDTH, 9):
        height = 7 + ((x * 17) % 17)
        y = BASELINE_Y - ((x * 7) % 9)
        ground_draw.line((x, y, x + ((x % 5) - 2), y - height), fill=(84, 104, 42, 205), width=2)

    canvas.save(OUTPUT, optimize=True)
    MANIFEST.write_text(
        ":root{\n"
        + "\n".join(rows)
        + f"\n  --mr-v66-route-width:{WIDTH}px;\n  --mr-v66-route-height:{HEIGHT}px;\n  --mr-v66-ground-y:{BASELINE_Y}px;\n  --mr-v66-summit-y:{SUMMIT_Y}px;\n}}\n",
        encoding="utf-8",
    )
    print(f"built {OUTPUT} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    try:
        build()
    except Exception as error:
        print(f"V66 route build failed: {error}", file=sys.stderr)
        raise

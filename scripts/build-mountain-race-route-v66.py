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
HEIGHT = 3840
BASELINE_Y = 3640
SUMMIT_Y = 430
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


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


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

    mountain = crop_alpha(remove_magenta(Image.open(SOURCE)))
    mountain = cover(mountain, (WIDTH, HEIGHT))
    mountain = ImageEnhance.Contrast(mountain).enhance(1.06)
    mountain = ImageEnhance.Sharpness(mountain).enhance(1.18)

    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    canvas.alpha_composite(mountain)

    ledges: list[Image.Image] = []
    for path in LEDGE_SOURCES:
        ledge = crop_alpha(Image.open(path).convert("RGBA"))
        target_width = 248
        ledge = ledge.resize((target_width, round(ledge.height * target_width / ledge.width)), Image.Resampling.LANCZOS)
        ledge = ImageEnhance.Color(ledge).enhance(0.48)
        ledge = ImageEnhance.Contrast(ledge).enhance(0.92)
        ledge = multiply_rgba(ledge, 0.96)
        ledges.append(ledge)

    first_y = 3405
    final_y = SUMMIT_Y
    spacing = (first_y - final_y) / (HOLD_COUNT - 1)
    rows: list[str] = []
    for index in range(HOLD_COUNT):
        center_x = HOLD_X[index % len(HOLD_X)]
        center_y = round(first_y - spacing * index)
        ledge = ledges[index % len(ledges)]
        scale = [0.72, 0.65, 0.70, 0.63, 0.68, 0.64][index % 6]
        if index == HOLD_COUNT - 1:
            # The last grab is the broad existing summit rim, not another
            # platform placed below or above the mountain.
            scale = 1.32
        width = round(ledge.width * scale)
        height = round(ledge.height * scale)
        hold = ledge.resize((width, height), Image.Resampling.LANCZOS)
        if index % 4 == 1:
            hold = ImageOps.mirror(hold)

        rock_embed = 32 if index < HOLD_COUNT - 1 else 52
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

        # The contact coordinate is the ledge's top face. Runtime arrows and
        # climber hands use this same immutable route-space point.
        contact_y = y + round(height * 0.40)
        rows.append(f"  --mr-v66-hold-{index}-x:{center_x / WIDTH * 100:.3f}%;")
        rows.append(f"  --mr-v66-hold-{index}-y:{contact_y}px;")

    # Connect the route to a substantial foreground base. This is painted into
    # the same bitmap, so it can never drift or expose sky beneath the controls.
    base_texture = mountain.crop((0, HEIGHT - 520, WIDTH, HEIGHT)).resize((WIDTH, 520), Image.Resampling.LANCZOS)
    base_mask = Image.new("L", (WIDTH, 520), 0)
    base_draw = ImageDraw.Draw(base_mask)
    base_draw.polygon([(0, 110), (90, 70), (220, 105), (352, 54), (500, 92), (650, 42), (820, 88), (1024, 58), (1024, 520), (0, 520)], fill=255)
    base_mask = base_mask.filter(ImageFilter.GaussianBlur(4))
    base_texture.putalpha(base_mask)
    canvas.alpha_composite(base_texture, (0, HEIGHT - 520))

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

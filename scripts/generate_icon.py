"""Generate neutral Windows and tray icons for 桌面便签."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SCALE = 4


def scaled(values):
    return tuple(round(value * SCALE) for value in values)


def stroke(value):
    return round(value * SCALE)


def generate_icon():
    canvas = Image.new("RGBA", (256 * SCALE, 256 * SCALE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    # Deep floating shadow and a compact obsidian glass tile.
    draw.rounded_rectangle(scaled((27, 31, 235, 239)), radius=stroke(48), fill=(7, 10, 13, 90))
    draw.rounded_rectangle(
        scaled((20, 20, 228, 228)),
        radius=stroke(47),
        fill="#20242a",
        outline="#6b747e",
        width=stroke(3),
    )

    # A warm note sheet is the only symbol: neutral, readable at tray size.
    draw.rounded_rectangle(
        scaled((61, 48, 195, 202)),
        radius=stroke(21),
        fill="#f5d66f",
        outline="#fff1b8",
        width=stroke(3),
    )
    draw.polygon(scaled((163, 48, 195, 48, 195, 80)), fill="#e6b947")
    draw.line(scaled((84, 97, 170, 97)), fill="#65572b", width=stroke(8))
    draw.line(scaled((84, 128, 170, 128)), fill="#65572b", width=stroke(8))
    draw.line(scaled((84, 159, 143, 159)), fill="#65572b", width=stroke(8))

    full = canvas.resize((256, 256), Image.Resampling.LANCZOS)
    ASSETS.mkdir(parents=True, exist_ok=True)
    full.save(ASSETS / "icon.png")
    full.save(
        ASSETS / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    full.resize((32, 32), Image.Resampling.LANCZOS).save(ASSETS / "tray.png")


if __name__ == "__main__":
    generate_icon()

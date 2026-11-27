"""Compose a 1280x640 distribution graphic from approved artwork and an actual screenshot."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import os

root = Path(__file__).resolve().parent.parent
out = root / "dist"
canvas = Image.new("RGB", (1280, 640), "#12151b")
draw = ImageDraw.Draw(canvas)
fonts = Path(os.environ["WINDIR"]) / "Fonts"
def font(size, bold=False):
    return ImageFont.truetype(str(fonts / ("segoeuib.ttf" if bold else "segoeui.ttf")), size)
mark = Image.open(root / "assets/nocturne-brand-mark.png").convert("RGBA")
mark.thumbnail((105, 105), Image.Resampling.LANCZOS)
canvas.paste(mark, (58, 65), mark)
draw.text((58, 194), "Nocturne", font=font(54, True), fill="#f3f4f6")
draw.text((58, 252), "Notes", font=font(54, True), fill="#f3f4f6")
draw.text((60, 338), "Minimalist note editor", font=font(25), fill="#b9c3cf")
draw.text((60, 381), "Local. Private. Focused.", font=font(23), fill="#a2afbf")
draw.rounded_rectangle((60, 465, 321, 514), radius=13, fill="#293340")
draw.text((76, 477), "2.5.0  ·  Windows 11", font=font(21), fill="#e0e7ef")
shot = Image.open(out / "Nocturne-Notes-Editor.png").convert("RGBA")
shot.thumbnail((824, 552), Image.Resampling.LANCZOS)
x, y = 1280 - shot.width - 34, (640 - shot.height) // 2
canvas.paste(shot, (x, y), shot)
canvas.save(out / "Nocturne-Notes-Social-Preview.png", optimize=True)

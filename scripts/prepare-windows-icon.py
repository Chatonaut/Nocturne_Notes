"""Regenerate Windows ICO from the exact approved source artwork.
Only scale and transparent canvas size change; never redraw or restyle the logo.
This is a build-time tool, not a runtime dependency.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "assets" / "nocturne-notes-logo.png"
output = ROOT / "assets" / "nocturne-notes-refined.ico"
im = Image.open(source).convert("RGBA")
alpha = im.getchannel("A")
bbox = alpha.point(lambda p: 255 if p > 8 else 0).getbbox()
if bbox is None:
    raise RuntimeError("The approved logo has no visible pixels.")
left, top, right, bottom = bbox
cx, cy = (left + right) / 2, (top + bottom) / 2
# Original square silhouette fills ~80% of the ICO frame. Target ~92%.
side = int(round(max(right - left, bottom - top) * 1.08))
side = min(side, min(im.width, im.height))
x = max(0, min(int(round(cx - side / 2)), im.width - side))
y = max(0, min(int(round(cy - side / 2)), im.height - side))
icon = im.crop((x, y, x + side, y + side)).resize((1024, 1024), Image.Resampling.LANCZOS)
sizes = [(s, s) for s in (16, 24, 32, 48, 64, 128, 256)]
icon.save(output, format="ICO", sizes=sizes)
print(f"Windows icon prepared from approved source: {output.name} / {icon.size} / {sizes}")

# A separate Start Menu asset: ~97.6% visible bounding box; preserve artwork.
# The standard ICO above is intentionally byte-for-byte unchanged.
start_side = min(int(round(max(right - left, bottom - top) * 1.025)), min(im.width, im.height))
sx = max(0, min(int(round(cx - start_side / 2)), im.width - start_side))
sy = max(0, min(int(round(cy - start_side / 2)), im.height - start_side))
start = im.crop((sx, sy, sx + start_side, sy + start_side)).resize((1024, 1024), Image.Resampling.LANCZOS)
start_output = ROOT / "assets" / "nocturne-start-menu.ico"
start.save(start_output, format="ICO", sizes=sizes)
for name, image in ((output.name, icon), (start_output.name, start)):
    box = image.getchannel("A").point(lambda p: 255 if p > 8 else 0).getbbox()
    fill = max(box[2] - box[0], box[3] - box[1]) / image.width
    print(f"{name}: visible fill {fill:.2%}")
    if name == start_output.name:
        assert 0.965 <= fill <= 0.995, f"Unexpected Start Menu icon fill: {fill}"

"""Compare actual PE primary icon group with the approved generated ICO."""
import io
import struct
import sys
from pathlib import Path
import pefile
from PIL import Image, ImageChops, ImageStat

def lookup(root, ident):
    for entry in root.entries:
        if entry.id == ident:
            return entry.directory
    raise AssertionError(f"Missing PE resource {ident}")

def blob(pe, node):
    data = node.entries[0].data.struct
    return pe.get_data(data.OffsetToData, data.Size)

def composite(image, background):
    base = Image.new("RGBA", image.size, background)
    return Image.alpha_composite(base, image.convert("RGBA")).convert("RGB")

def verify(exe, reference):
    pe = pefile.PE(str(exe), fast_load=True)
    try:
        pe.parse_data_directories(directories=[pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_RESOURCE"]])
        root = pe.DIRECTORY_ENTRY_RESOURCE
        groups = lookup(root, 14)
        icons = lookup(root, 3)
        group = blob(pe, groups.entries[0].directory)
        reserved, kind, count = struct.unpack_from("<HHH", group, 0)
        assert reserved == 0 and kind == 1 and count > 0
        matches = []
        for i in range(count):
            w, h, colors, zero, planes, bits, size, icon_id = struct.unpack_from("<BBBBHHIH", group, 6 + 14*i)
            dims = (w or 256, h or 256)
            if dims not in reference.ico.sizes():
                continue
            data = blob(pe, lookup(icons, icon_id))
            header = struct.pack("<HHH", 0, 1, 1) + struct.pack("<BBBBHHII", w,h,colors,zero,planes,bits,len(data),22)
            actual = Image.open(io.BytesIO(header+data)).convert("RGBA")
            expected = reference.ico.getimage(dims).convert("RGBA")
            for bg in ("#000000", "#ffffff"):
                error = max(ImageStat.Stat(ImageChops.difference(composite(actual,bg),composite(expected,bg))).mean)
                assert error < 4, f"{exe.name}: incorrect {dims} icon (mean pixel error {error:.2f})"
            matches.append(dims)
        assert len(set(matches)) >= 2 and any(w>=32 for w,h in matches), f"{exe.name}: insufficient matching icon sizes {matches}"
        print(f"PASS {exe.name}: embedded primary icon matches approved artwork at {matches}")
    finally:
        pe.close()

if __name__ == "__main__":
    with Image.open(sys.argv[1]) as source:
        for name in sys.argv[2:]:
            verify(Path(name), source)

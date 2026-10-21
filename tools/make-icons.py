"""Draws the home-screen icons (a tennis ball on black) as PNG files in icons/.

Usage: python3 tools/make-icons.py
Uses only Python's standard library, so nothing needs installing.
"""
import math
import os
import struct
import zlib

BALL = (204, 255, 0)       # tennis-ball yellow-green
SEAM = (255, 255, 255)
BACKGROUND = (0, 0, 0)
SAMPLES = 3                # 3x3 samples per pixel for smooth edges


def colour_at(x, y):
    """Colour at a point, where the icon spans 0..1 in both directions."""
    dx, dy = x - 0.5, y - 0.5
    r = 0.40                                   # ball radius
    if dx * dx + dy * dy > r * r:
        return BACKGROUND
    # The seam: two curves bowing in from the left and right edges.
    for side in (-1, 1):
        cx = 0.5 + side * r * 1.25
        d = math.hypot(x - cx, y - 0.5)
        if abs(d - r * 0.95) < r * 0.07:
            return SEAM
    return BALL


def draw(size):
    rows = []
    for py in range(size):
        row = bytearray([0])                   # PNG filter byte: none
        for px in range(size):
            total = [0, 0, 0]
            for sy in range(SAMPLES):
                for sx in range(SAMPLES):
                    c = colour_at((px + (sx + 0.5) / SAMPLES) / size,
                                  (py + (sy + 0.5) / SAMPLES) / size)
                    for i in range(3):
                        total[i] += c[i]
            row += bytes(round(t / SAMPLES ** 2) for t in total)
        rows.append(bytes(row))
    return b"".join(rows)


def write_png(path, size, pixels):
    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)   # 8-bit RGB
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", header))
        f.write(chunk(b"IDAT", zlib.compress(pixels, 9)))
        f.write(chunk(b"IEND", b""))


os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
os.makedirs("icons", exist_ok=True)
for size in (180, 192, 512):
    write_png(f"icons/icon-{size}.png", size, draw(size))
    print(f"icons/icon-{size}.png")

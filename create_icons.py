#!/usr/bin/env python3
"""Generate simple placeholder icons for the Chrome extension."""

import struct
import zlib
import os

def create_png(width, height, color=(0, 212, 255)):
    """Create a simple solid color PNG."""
    def png_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)

    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    png += png_chunk(b'IHDR', ihdr_data)

    # IDAT chunk (image data)
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # Filter byte (none)
        for x in range(width):
            # Create a simple gradient/circle pattern
            cx, cy = width / 2, height / 2
            radius = min(width, height) / 2 - 1
            dx, dy = x - cx, y - cy
            dist = (dx*dx + dy*dy) ** 0.5

            if dist <= radius:
                # Inside circle - gradient from cyan to blue
                t = dist / radius
                r = int(color[0] * (1 - t * 0.5))
                g = int(color[1] * (1 - t * 0.3))
                b = int(min(255, color[2] + (255 - color[2]) * t * 0.5))
                raw_data += bytes([r, g, b])
            else:
                # Outside circle - transparent (we use white for simplicity)
                raw_data += bytes([255, 255, 255])

    compressed = zlib.compress(raw_data, 9)
    png += png_chunk(b'IDAT', compressed)

    # IEND chunk
    png += png_chunk(b'IEND', b'')

    return png


def create_icon_with_checkmark(size):
    """Create an icon with a document and checkmark design."""
    def png_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)

    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk (RGBA)
    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png += png_chunk(b'IHDR', ihdr_data)

    # Create image data
    raw_data = b''
    scale = size / 128.0
    cx, cy = size / 2, size / 2
    radius = size / 2 - 2 * scale

    for y in range(size):
        raw_data += b'\x00'  # Filter byte
        for x in range(size):
            dx, dy = x - cx, y - cy
            dist = (dx*dx + dy*dy) ** 0.5

            if dist <= radius:
                # Inside circle - gradient background
                t = dist / radius if radius > 0 else 0
                r = int(0 + 0 * t)
                g = int(212 - 100 * t)
                b = int(255)
                a = 255

                # Check if we're on the checkmark or document outline
                norm_x = x / scale
                norm_y = y / scale

                # Document bounds
                doc_left, doc_top = 36, 28
                doc_right, doc_bottom = 92, 100

                # Check if on document border (simplified)
                on_border = False
                border_width = max(2, 4 * scale)

                if (doc_left <= norm_x <= doc_right and doc_top <= norm_y <= doc_bottom):
                    # Check edges
                    if (abs(norm_x - doc_left) < border_width/scale or
                        abs(norm_x - doc_right) < border_width/scale or
                        abs(norm_y - doc_top) < border_width/scale or
                        abs(norm_y - doc_bottom) < border_width/scale):
                        on_border = True

                # Check if on checkmark line (simplified)
                on_check = False
                check_width = max(3, 6 * scale)

                # First part of checkmark: (48,64) to (58,74)
                if 48 <= norm_x <= 58 and 64 <= norm_y <= 74:
                    expected_y = 64 + (norm_x - 48)
                    if abs(norm_y - expected_y) < check_width/scale:
                        on_check = True

                # Second part of checkmark: (58,74) to (80,52)
                if 58 <= norm_x <= 80 and 52 <= norm_y <= 74:
                    expected_y = 74 - (norm_x - 58)
                    if abs(norm_y - expected_y) < check_width/scale:
                        on_check = True

                # Bottom line
                if 48 <= norm_x <= 80 and abs(norm_y - 86) < 3:
                    on_border = True

                if on_border or on_check:
                    r, g, b = 255, 255, 255

                raw_data += bytes([r, g, b, a])
            else:
                # Outside circle - transparent
                raw_data += bytes([0, 0, 0, 0])

    compressed = zlib.compress(raw_data, 9)
    png += png_chunk(b'IDAT', compressed)

    # IEND chunk
    png += png_chunk(b'IEND', b'')

    return png


def main():
    icons_dir = os.path.join(os.path.dirname(__file__), 'icons')
    os.makedirs(icons_dir, exist_ok=True)

    sizes = [16, 48, 128]

    for size in sizes:
        print(f"Creating icon{size}.png...")
        png_data = create_icon_with_checkmark(size)
        filepath = os.path.join(icons_dir, f'icon{size}.png')
        with open(filepath, 'wb') as f:
            f.write(png_data)
        print(f"  Created {filepath}")

    print("\nDone! Icons created successfully.")


if __name__ == '__main__':
    main()

import struct

# 创建一个最简单的 256x256 PNG 文件
def create_simple_png(filename):
    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk (image header)
    width = 128
    height = 128
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    ihdr_chunk = struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', 0x3623B3A4)

    # Create a simple gradient image data
    image_data = []
    for y in range(height):
        for x in range(width):
            r = int(255 * (x / width))
            g = int(255 * (y / height))
            b = 128
            image_data.extend([r, g, b])

    # Apply PNG filtering (filter type 0 = none)
    scanlines = []
    for y in range(height):
        scanlines.append(0)  # filter type
        scanlines.extend(image_data[y * width * 3:(y + 1) * width * 3])

    # Compress the data using zlib
    import zlib
    compressed = zlib.compress(bytes(scanlines))

    # IDAT chunk (image data)
    idat_chunk = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', 0x2A8F3112)

    # IEND chunk (end)
    iend_chunk = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', 0xAE426082)

    # Write PNG file
    with open(filename, 'wb') as f:
        f.write(signature)
        f.write(ihdr_chunk)
        f.write(idat_chunk)
        f.write(iend_chunk)

    print(f"Created {filename}")

def create_simple_ico(filename):
    # ICO file header
    header = struct.pack('<HHH', 0, 1, 1)  # Reserved, Type (1=icon), Count

    # Directory entry for 128x128 (ICO max without PNG is 256, but simpler to use 128)
    w, h = 128, 128
    entry = struct.pack('BB', w, h)  # width, height
    entry += b'\x00\x00\x01\x00'  # colors, reserved, planes (1)
    entry += struct.pack('<H', 32)  # bpp (32)
    entry += struct.pack('<I', 0)  # size (will be 0 for PNG)
    entry += struct.pack('<I', 22)  # offset

    # Read the PNG file
    with open('icon.png', 'rb') as f:
        png_data = f.read()

    # Write ICO file
    with open(filename, 'wb') as f:
        f.write(header)
        f.write(entry)
        f.write(png_data)

    print(f"Created {filename}")

if __name__ == '__main__':
    create_simple_png('icon.png')
    create_simple_ico('icon.ico')

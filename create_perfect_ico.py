#!/usr/bin/env python3
import struct
import os

# 创建一个完美的 32x32 32位 ICO 文件，严格按照 ICO 格式规范

# ICO 文件头 (6字节)
ico_header = struct.pack('<HHH',
    0,        # Reserved (must be 0)
    1,        # Type (1 = ICO)
    1          # Count (1 image)
)

# ICO 目录项 (16字节)
ico_dir = struct.pack('<BBHHII',
    32,        # Width (32)
    32,        # Height (32)
    0,         # Colors (0 = no palette)
    0,         # Reserved (MUST BE 0!)
    1,         # Color planes (1)
    32         # Bits per pixel (32)
)
# Image data size (4 bytes)
ico_dir += struct.pack('<I', 4096)  # 32x32x4 = 4096 bytes

# Image data offset (4 bytes)
ico_dir += struct.pack('<I', 22)  # Header (6) + Dir (16) = 22

# BITMAPINFOHEADER (40 bytes) - 12个参数
bmp_info = struct.pack('<IIIIHHIIIIII',
    40,        # Size (40 bytes)
    32,        # Width
    64,        # Height (2x for ICO: includes AND mask)
    1,         # Planes (1)
    32,        # Bits per pixel (32)
    0,         # Compression (0 = BI_RGB)
    4096,      # Image size (32x32x4)
    0,         # X pixels per meter (0 = unspecified)
    0,         # Y pixels per meter (0 = unspecified)
    0,         # Colors used (0 = all colors)
    0,         # Important colors (0 = all colors important)
    0          # 第12个参数 (扩展)
)

# XOR mask (32x32 pixels, BGRA format)
xor_mask = b''
for y in range(32):
    for x in range(32):
        # 创建一个蓝色渐变图标
        blue = 255
        green = int((x / 31) * 200)
        red = int((y / 31) * 100)
        alpha = 255
        xor_mask += struct.pack('<BBBB', blue, green, red, alpha)

# AND mask (32x32 bits = 128 bytes)
and_mask = b'\x00' * 128

# 组合所有部分
ico_data = ico_header + ico_dir + bmp_info + xor_mask + and_mask

# 写入文件
ico_path = r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.ico'
with open(ico_path, 'wb') as f:
    f.write(ico_data)

print(f"Perfect ICO file created: {len(ico_data)} bytes")
print(f"Path: {ico_path}")
print("Details:")
print(f"  - Header: {len(ico_header)} bytes")
print(f"  - Directory: {len(ico_dir)} bytes")
print(f"  - BMP Info: {len(bmp_info)} bytes")
print(f"  - XOR Mask: {len(xor_mask)} bytes")
print(f"  - AND Mask: {len(and_mask)} bytes")
print(f"  - Total: {len(ico_data)} bytes")

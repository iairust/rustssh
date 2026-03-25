#!/usr/bin/env python3
import struct

# 创建一个最简单的 16x16 1位 ICO 文件
# 参考：https://en.wikipedia.org/wiki/ICO_(file_format)

# ICO 文件头 (6字节)
ico_header = struct.pack('<HHH',
    0,   # Reserved
    1,   # Type (1 = ICO)
    1    # Count (1 image)
)

# ICO 目录项 (16字节)
ico_dir = struct.pack('<BBHHII',
    16,   # Width
    16,   # Height
    2,    # Colors (2 = 1 bit: black and white)
    0,    # Reserved (MUST BE 0)
    1,    # Color planes
    1     # Bits per pixel
)
# Image data size
ico_dir += struct.pack('<I', 74)  # 计算后的大小

# Image data offset
ico_dir += struct.pack('<I', 22)  # Header (6) + Dir (16) = 22

# BITMAPINFOHEADER (40字节) - 需要12个参数
bmp_info = struct.pack('<IIIIHHIIIIII',
    40,    # Size
    16,    # Width
    32,    # Height (2x for ICO)
    1,     # Planes
    1,     # Bits per pixel
    0,     # Compression
    8,     # Image size (16x16/8 = 32 + 32/8 = 4, padding = 36)
    0, 0,  # Resolution
    2,     # Colors used (2 for 1-bit)
    2,     # Important colors (2)
    0      # 第12个参数
)

# 颜色表 (8字节: 2 colors × 4 bytes each)
color_table = struct.pack('<BBBB', 0, 0, 0, 0)   # Black
color_table += struct.pack('<BBBB', 255, 255, 255, 0)  # White

# XOR mask (32 bytes: 16 rows × 2 bytes/row)
xor_mask = b''
for i in range(32):
    xor_mask += struct.pack('<H', 0xFFFF)  # 全白

# AND mask (32 bytes: 16 rows × 2 bytes/row)
and_mask = b'\x00' * 32  # 全透明

# 组合
ico_data = ico_header + ico_dir + bmp_info + color_table + xor_mask + and_mask

ico_path = r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.ico'
with open(ico_path, 'wb') as f:
    f.write(ico_data)

print(f"Minimal valid ICO created: {len(ico_data)} bytes")
print(f"Path: {ico_path}")

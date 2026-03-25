#!/usr/bin/env python3
import struct

# 创建一个有效的 16x16 1位深度的 ICO 文件
# 基于最小的有效 ICO 格式

# ICO 文件头 (6字节)
ico_header = struct.pack('<HHH', 0, 1, 1)  # Reserved, Type (1=ICO), Count (1)

# 目录项 (16字节)
ico_dir_entry = struct.pack('<BBHHII',
    16,   # 宽度
    16,   # 高度
    0,    # 颜色数
    0,    # 保留
    1,    # 颜色平面数
    1     # 每像素位数
)
ico_dir_entry += struct.pack('<I', 22)  # 图片数据偏移量

# 位图信息头 (40字节)
bmp_header = struct.pack('<IIIIHHIIIIII',
    40,      # 头大小
    16, 16,  # 宽度, 高度
    1,       # 颜色平面数
    1,       # 每像素位数
    0,       # 压缩方式
    0, 0,    # 图像大小
    0, 0,    # 水平, 垂直分辨率
    2, 2     # 调色板大小, 重要颜色数
)

# 调色板 (8字节: 黑色和白色)
palette = struct.pack('<BBBB', 0, 0, 0, 0)   # 黑色
palette += struct.pack('<BBBB', 255, 255, 255, 0)  # 白色

# 图像数据 (XOR mask: 32字节, AND mask: 32字节)
xor_mask = b''
for i in range(32):
    xor_mask += bytes([0xFF])

and_mask = b'\x00' * 32

# 组合所有部分
ico_data = ico_header + ico_dir_entry + bmp_header + palette + xor_mask + and_mask

# 写入文件
with open(r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.ico', 'wb') as f:
    f.write(ico_data)

print(f"ICO file created, size: {len(ico_data)} bytes")

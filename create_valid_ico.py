#!/usr/bin/env python3
import struct
import os

# 创建一个更符合标准的 ICO 文件
# 使用 32x32 32位颜色深度

# ICO 文件头 (6字节)
ico_header = struct.pack('<HHH', 0, 1, 1)  # Reserved, Type (1=ICO), Count (1)

# 目录项 (16字节)
ico_dir_entry = struct.pack('<BBHHII',
    32,    # 宽度
    32,    # 高度
    0,     # 颜色数 (0 = 不使用调色板)
    0,     # 保留
    1,     # 颜色平面数
    32     # 每像素位数
)
ico_dir_entry += struct.pack('<I', 22)  # 图片数据偏移量

# 位图信息头 (40字节) - 32x32 32位 BMP
bmp_header = struct.pack('<IIIIHHIIIIII',
    40,      # 头大小
    32, 32,  # 宽度, 高度
    1,       # 颜色平面数
    32,      # 每像素位数 (32位)
    0,       # 压缩方式 (无压缩)
    4096,    # 图像大小 (32*32*4)
    0, 0,    # 水平, 垂直分辨率
    0, 0,    # 调色板颜色数, 重要颜色数
    0        # 额外的字段
)

# 图像数据 (32x32 32位像素，BGRA 格式)
# 创建一个简单的蓝色方块
pixel_data = b''
for y in range(32):
    for x in range(32):
        # 创建渐变蓝色效果
        blue = 255
        green = (x * 255 // 32)
        red = (y * 255 // 32)
        alpha = 255
        pixel_data += struct.pack('<BBBB', blue, green, red, alpha)

# AND 掩码 (32x32 位，即 128 字节)
and_mask = b'\x00' * 128

# 组合所有部分
ico_data = ico_header + ico_dir_entry + bmp_header + pixel_data + and_mask

# 写入文件
ico_path = r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.ico'
with open(ico_path, 'wb') as f:
    f.write(ico_data)

print(f"Valid ICO file created: {len(ico_data)} bytes")
print(f"Path: {ico_path}")

from PIL import Image
import struct
import zlib

# 创建一个 256x256 的蓝色渐变图像
width = 256
height = 256

# 创建图像数据 (RGBA)
image_data = []
for y in range(height):
    for x in range(width):
        r = int(255 * (x / width))
        g = int(255 * (y / height))
        b = 128
        a = 255
        image_data.extend([r, g, b, a])

# 使用 PIL 创建图像
img = Image.frombytes('RGBA', (width, height), bytes(image_data))

# 先保存为 PNG
img.save('icon.png', 'PNG')
print("Created icon.png")

# 使用 PIL 保存为 ICO,包含多个尺寸
img.save('icon.ico', format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
print("Created icon.ico with multiple sizes")

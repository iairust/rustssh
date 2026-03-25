from PIL import Image

try:
    # 打开 PNG 文件
    img = Image.open('icon.png')
    
    # 保存为 ICO 文件,包含多种尺寸
    img.save('icon.ico', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
    
    print("Successfully created icon.ico")
except Exception as e:
    print(f"Error: {e}")

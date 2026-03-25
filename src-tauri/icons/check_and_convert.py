import sys
from pathlib import Path

try:
    # 先安装 PIL
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "Pillow"], check=True)
    
    from PIL import Image
    
    # 验证 PNG
    print("Checking PNG file...")
    with open('icon.png', 'rb') as f:
        header = f.read(8)
        print(f"File header: {header}")
        if header != b'\x89PNG\r\n\x1a\n':
            print("Error: Not a valid PNG file!")
            sys.exit(1)
    
    # 打开并验证图像
    print("Opening image...")
    img = Image.open('icon.png')
    print(f"Image mode: {img.mode}")
    print(f"Image size: {img.size}")
    
    # 转换为 RGBA
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
        print("Converted to RGBA")
    
    # 保存为 ICO
    print("Saving as ICO...")
    img.save('icon.ico', format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
    print("Successfully created icon.ico")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

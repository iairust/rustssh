from PIL import Image

try:
    img = Image.open(r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.png')
    img.save(r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.ico', format='ICO', sizes=[(256,256), (128,128), (64,64), (32,32), (16,16)])
    print("Icon converted successfully")
except Exception as e:
    print(f"Error: {e}")

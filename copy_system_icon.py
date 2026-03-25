import os
import shutil

# 尝试从 Windows 系统目录复制一个图标文件
system_icon_paths = [
    r'C:\Windows\System32\imageres.dll',  # Windows 资源文件，包含很多图标
    r'C:\Windows\System32\shell32.dll',      # Windows Shell 资源文件
    r'C:\Windows\System32\moricons.dll',      # 鼠标图标
]

for path in system_icon_paths:
    if os.path.exists(path):
        print(f"Found system icon file: {path}")
        # 注意：这些是 DLL 文件，不能直接用作 ICO

# 让我们尝试使用一个简单的方案：复制 icon.png 并重命名为 icon.ico
png_icon = r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.png'
ico_target = r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.ico'

if os.path.exists(png_icon):
    try:
        shutil.copy(png_icon, ico_target)
        print(f"Copied {png_icon} to {ico_target}")
        print("Note: This is a PNG file renamed to .ico, may not work with RC.EXE")
    except Exception as e:
        print(f"Error copying file: {e}")
else:
    print(f"Source PNG file not found: {png_icon}")

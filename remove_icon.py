import os
import shutil

# 临时删除 icon.ico 文件
ico_path = r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.ico'
backup_path = r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.ico.temp'

try:
    if os.path.exists(ico_path):
        shutil.move(ico_path, backup_path)
        print(f"Moved {ico_path} to {backup_path}")
    else:
        print(f"File {ico_path} not found")
except Exception as e:
    print(f"Error: {e}")

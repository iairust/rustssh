import os
import shutil

ico_path = r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.ico'
backup_path = r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.ico.bak'

try:
    if os.path.exists(ico_path):
        shutil.move(ico_path, backup_path)
        print(f"Renamed {ico_path} to {backup_path}")
    else:
        print(f"File {ico_path} does not exist")
except Exception as e:
    print(f"Error: {e}")

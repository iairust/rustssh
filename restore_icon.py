import os
import shutil

backup_path = r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.ico.bak'
ico_path = r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\icon.ico'

try:
    if os.path.exists(backup_path):
        shutil.copy(backup_path, ico_path)
        print(f"Restored {ico_path}")
    else:
        print(f"Backup file {backup_path} does not exist")
except Exception as e:
    print(f"Error: {e}")

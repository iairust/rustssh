import urllib.request

try:
    urllib.request.urlretrieve(
        'https://github.com/tauri-apps/tauri/raw/dev/tooling/cli/templates/app/app-icon.png',
        r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\temp_icon.png'
    )
    print("Icon downloaded successfully")
except Exception as e:
    print(f"Error: {e}")

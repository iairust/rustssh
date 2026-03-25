import urllib.request
import os

# 尝试从 Windows 系统或者其他来源下载一个有效的 ICO 文件
# 这里我们使用一个简单的 URL 示例

try:
    # 尝试下载 Windows 默认图标的替代方案
    # 这里我们使用一个公开可用的图标
    url = "https://github.com/gorhill/uBlock/raw/master/src/img/icon-16.png"

    print("Downloading icon...")
    urllib.request.urlretrieve(url, r'e:\AiCode\Codeup\xshell.ngo100.com\src-tauri\icons\temp_download.png')
    print("Icon downloaded successfully")
    print("Note: This is a PNG file, need to convert to ICO")

except Exception as e:
    print(f"Error downloading icon: {e}")

# WebSSH Manager - 启动指南

## 🚀 快速启动

### 方法 1: 使用启动脚本 (推荐)

#### 开发模式
```batch
start_tauri_dev.bat
```

#### 生产构建
```batch
start_tauri_build.bat
```

#### 一键启动所有服务
```batch
start_dev.bat
```

---

### 方法 2: 手动启动

#### 选项 A: Tauri 开发模式
```powershell
cd src-tauri
cargo tauri dev
```

**说明**:
- 自动启动前端和后端
- 热重载支持
- 适合开发调试

#### 选项 B: Tauri 生产构建
```powershell
cd src-tauri
cargo tauri build
```

**说明**:
- 编译优化版本
- 生成可执行文件
- 位置: `target/release/xshell-tauri.exe`

#### 选项 C: 运行编译好的程序
```powershell
.\target\release\xshell-tauri.exe
```

**说明**:
- 直接运行,无需编译
- 启动速度快
- 适合测试和部署

#### 选项 D: Web 模式 (不使用 Tauri)
```powershell
# 终端 1 - 启动后端
cd backend
node server.js

# 终端 2 - 启动前端
cd frontend
npm run dev
```

**说明**:
- 纯 Web 应用
- 访问 http://localhost:5175
- 适合前端开发

---

## 📂 目录结构说明

```
e:/AiCode/Codeup/xshell.ngo100.com/
├── start_tauri_dev.bat      # Tauri 开发模式启动脚本
├── start_tauri_build.bat    # Tauri 构建脚本
├── start_dev.bat            # 一键启动所有服务
├── backend/                 # Node.js 后端
│   └── server.js           # 服务器入口
├── frontend/                # React 前端
│   ├── src/                # 源代码
│   ├── dist/               # 构建输出
│   └── package.json
├── src-tauri/              # Tauri 桌面应用
│   ├── src/
│   │   ├── lib.rs         # Tauri 应用逻辑
│   │   └── main.rs        # 入口文件
│   ├── icons/
│   │   ├── icon.png       # PNG 图标
│   │   └── icon.ico       # Windows ICO 图标
│   ├── Cargo.toml
│   └── tauri.conf.json
└── target/
    └── release/
        └── xshell-tauri.exe  # 可执行文件
```

---

## 🛠️ 常用命令

### Tauri 相关

```powershell
# 开发模式
cd src-tauri
cargo tauri dev

# 构建生产版本
cd src-tauri
cargo tauri build

# 运行可执行文件
.\target\release\xshell-tauri.exe

# 清理构建缓存
cd src-tauri
cargo clean
```

### 前端相关

```powershell
# 开发模式
cd frontend
npm run dev

# 构建生产版本
cd frontend
npm run build

# 预览构建结果
cd frontend
npm run preview
```

### 后端相关

```powershell
# 启动后端
cd backend
node server.js
```

---

## ❓ 常见问题

### Q1: 运行 `cargo tauri dev` 时报错 "No package info in the config file"

**原因**: 命令需要在 `src-tauri` 目录下运行

**解决方案**:
```powershell
# 错误 ❌
cargo tauri dev

# 正确 ✅
cd src-tauri
cargo tauri dev

# 或使用脚本 ✅
start_tauri_dev.bat
```

### Q2: 前端端口被占用

**错误信息**: `Port 5173 is in use, trying another one...`

**解决方案**:
```powershell
# 关闭占用端口的进程
netstat -ano | findstr :5173
taskkill /PID <进程ID> /F

# 或修改 vite.config.js 中的端口配置
```

### Q3: 后端连接失败

**错误信息**: `ECONNREFUSED`

**解决方案**:
```powershell
# 确保后端正在运行
cd backend
node server.js

# 或在 Tauri 开发模式中会自动启动后端
```

### Q4: 编译失败

**错误信息**: `failed to compile`

**解决方案**:
```powershell
# 清理缓存
cd src-tauri
cargo clean

# 重新编译
cargo build
```

### Q5: 图标错误

**错误信息**: `Couldn't find a .ico icon`

**解决方案**:
```powershell
# 检查图标文件
cd src-tauri/icons
dir icon.ico

# 重新生成图标
python create_proper_ico.py
```

---

## 🔍 调试技巧

### 查看详细日志

```powershell
# Tauri 开发模式 (详细日志)
cd src-tauri
cargo tauri dev --verbose

# Rust 编译 (详细输出)
cd src-tauri
cargo build --verbose
```

### 检查进程

```powershell
# 查看所有 cargo 进程
tasklist | findstr cargo

# 查看所有 node 进程
tasklist | findstr node

# 查看 tauri 进程
tasklist | findstr tauri

# 查看端口占用
netstat -ano | findstr :3000   # 后端
netstat -ano | findstr :5173   # 前端
```

### 清理环境

```powershell
# 清理 Rust 构建缓存
cd src-tauri
cargo clean

# 清理前端构建
cd frontend
rmdir /s /q dist

# 清理 node_modules
cd frontend
rmdir /s /q node_modules
npm install
```

---

## 📊 性能优化

### 加速编译

1. **使用增量编译**
```powershell
cd src-tauri
cargo build --incremental
```

2. **并行编译**
```powershell
cd src-tauri
set CARGO_BUILD_JOBS=4
cargo build
```

3. **使用编译缓存**
```powershell
cd src-tauri
cargo install sccache
set CARGO_INCREMENTAL=0
set RUSTC_WRAPPER=sccache
cargo build
```

### 减小文件大小

1. **启用 LTO (Link Time Optimization)**
已在 `Cargo.toml` 中配置:
```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
strip = true
```

2. **前端代码分割**
在 `vite.config.js` 中配置动态导入

---

## 🎯 开发工作流

### 日常开发流程

1. **启动开发环境**
```powershell
start_tauri_dev.bat
```

2. **修改代码**
   - 前端代码会自动热重载
   - Rust 代码修改后会自动重新编译

3. **测试功能**
   - 在应用中测试修改的功能
   - 查看控制台日志

4. **提交代码**
   - 确保所有功能正常
   - 提交到版本控制

### 发布流程

1. **清理构建**
```powershell
cd src-tauri
cargo clean
```

2. **构建生产版本**
```powershell
start_tauri_build.bat
```

3. **测试可执行文件**
```powershell
.\target\release\xshell-tauri.exe
```

4. **发布**
   - 创建安装包 (修复 WiX 问题后)
   - 上传到服务器/应用商店

---

## 📚 相关文档

- **[构建成功报告](c:\Users\Tinge\AppData\Roaming\WorkBuddy\User\globalStorage\tencent-cloud.coding-copilot\brain\82759e34b6dc41c2ac44bd03ff89cb8f\build_success.md)**
- **[构建修复报告](c:\Users\Tinge\AppData\Roaming\WorkBuddy\User\globalStorage\tencent-cloud.coding-copilot\brain\82759e34b6dc41c2ac44bd03ff89cb8f\build_fix_report.md)**
- **[运行反馈报告](c:\Users\Tinge\AppData\Roaming\WorkBuddy\User\globalStorage\tencent-cloud.coding-copilot\brain\82759e34b6dc41c2ac44bd03ff89cb8f\feedback_report.md)**
- **[调试状态报告](c:\Users\Tinge\AppData\Roaming\WorkBuddy\User\globalStorage\tencent-cloud.coding-copilot\brain\82759e34b6dc41c2ac44bd03ff89cb8f\debug_status.md)**
- **[项目概览](c:\Users\Tinge\AppData\Roaming\WorkBuddy\User\globalStorage\tencent-cloud.coding-copilot\brain\82759e34b6dc41c2ac44bd03ff89cb8f\overview.md)**

---

## 🎉 总结

### 推荐的启动方式

**开发调试**: `start_tauri_dev.bat`
**生产构建**: `start_tauri_build.bat`
**快速启动**: `.\target\release\xshell-tauri.exe`

### 重要提示

1. ⚠️ `cargo tauri dev` 必须在 `src-tauri` 目录下运行
2. ✅ 使用批处理脚本可以避免这个问题
3. ✅ 开发模式会自动启动前端和后端
4. ✅ 生产构建生成可执行文件

---

**最后更新**: 2026-03-22
**版本**: 1.0.0
**状态**: 生产就绪 ✅

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen, File, Upload, Download, Trash2, RefreshCw, ChevronRight,
  Home, ArrowUp, FolderPlus, X, AlertCircle, Loader
} from 'lucide-react';
import { sftpListDirectory, sftpDownloadFile, sftpUploadFile, sftpDeletePath, sftpCreateDirectory } from './api-tauri';

function formatSize(bytes) {
  if (bytes == null) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function formatDate(ts) {
  if (!ts) return '-';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('zh-CN') + ' ' + d.toTimeString().slice(0, 5);
}

export default function SftpPanel({ connectionId, onClose }) {
  const [path, setPath] = useState('/');
  const [inputPath, setInputPath] = useState('/');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);

  const loadDir = useCallback(async (dir) => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const data = await sftpListDirectory(connectionId, dir);
      setFiles(data);
      setPath(dir);
      setInputPath(dir);
    } catch (e) {
      setError(e.message || 'Failed to list directory');
    }
    setLoading(false);
  }, [connectionId]);

  useEffect(() => { loadDir('/'); }, [loadDir]);

  const navigate = (file) => {
    if (file.type === 'd') loadDir(joinPath(path, file.name));
  };

  const goUp = () => {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return;
    parts.pop();
    loadDir('/' + parts.join('/') || '/');
  };

  const goHome = () => loadDir('/');

  const joinPath = (base, name) => {
    if (base.endsWith('/')) return base + name;
    return base + '/' + name;
  };

  const handleSelectAll = () => {
    if (selected.size === files.length) setSelected(new Set());
    else setSelected(new Set(files.map(f => f.name)));
  };

  const toggleSelect = (name) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确认删除 ${selected.size} 个文件/文件夹？`)) return;
    setLoading(true);
    try {
      for (const name of selected) {
        const filePath = joinPath(path, name);
        await sftpDeletePath(connectionId, filePath);
      }
      loadDir(path);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleDownload = async (file) => {
    const filePath = joinPath(path, file.name);
    try {
      // 使用 Tauri 的文件保存对话框选择保存位置
      const { save } = await import('@tauri-apps/plugin-dialog');
      const savePath = await save({
        defaultPath: file.name,
        filters: [{ name: 'All Files', extensions: ['*'] }]
      });
      if (!savePath) return; // 用户取消

      setLoading(true);
      const localPath = await sftpDownloadFile(connectionId, filePath, savePath);
      setError(`已下载到: ${localPath}`);
    } catch (e) {
      console.error('下载错误:', e);
      const errorMsg = e?.message || e?.toString() || '未知错误';
      setError(`下载失败: ${errorMsg}`);
    }
    setLoading(false);
  };

  const handleUpload = async (e) => {
    const uploadFiles = Array.from(e.target.files);
    if (!uploadFiles.length) return;
    setUploading(true);
    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        setUploadProgress({ name: file.name, current: i + 1, total: uploadFiles.length });

        // 读取文件内容为 ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const remotePath = joinPath(path, file.name);
        await sftpUploadFile(connectionId, new Uint8Array(arrayBuffer), remotePath);
      }
    } catch (e) {
      setError(`上传失败: ${e.message}`);
    }
    setUploading(false);
    setUploadProgress(null);
    loadDir(path);
    e.target.value = '';
  };

  const handleMkdir = async () => {
    const name = prompt('新建文件夹名称：');
    if (!name) return;
    try {
      await sftpCreateDirectory(connectionId, joinPath(path, name));
      loadDir(path);
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePathInput = (e) => {
    if (e.key === 'Enter') {
      loadDir(inputPath || '/');
    }
  };

  const breadcrumbs = ['/', ...path.split('/').filter(Boolean)];

  return (
    <div className="sftp-panel">
      {/* 顶栏 */}
      <div className="sftp-header">
        <FolderOpen size={14} style={{ color: '#2ecc71', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, color: '#e0e0e0', marginRight: 8 }}>SFTP 文件管理</span>

        {/* 面包屑 */}
        <div className="sftp-breadcrumb">
          {breadcrumbs.map((part, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && <ChevronRight size={11} style={{ color: '#555', margin: '0 2px' }} />}
              <span
                className="breadcrumb-item"
                onClick={() => {
                  const p = '/' + breadcrumbs.slice(1, i + 1).join('/');
                  loadDir(i === 0 ? '/' : p);
                }}
              >
                {i === 0 ? '/' : part}
              </span>
            </span>
          ))}
        </div>
        <button className="toolbar-btn" style={{ marginLeft: 'auto' }} onClick={onClose} title="关闭">
          <X size={14} />
        </button>
      </div>

      {/* 工具栏 */}
      <div className="sftp-toolbar">
        <div className="toolbar-group">
          <button className="toolbar-btn" title="主目录" onClick={goHome}><Home size={13} /></button>
          <button className="toolbar-btn" title="上级目录" onClick={goUp} disabled={path === '/'}>
            <ArrowUp size={13} />
          </button>
          <button className="toolbar-btn" title="刷新" onClick={() => loadDir(path)}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        <div className="toolbar-sep" />

        {/* 路径输入 */}
        <input
          className="sftp-path-input"
          value={inputPath}
          onChange={e => setInputPath(e.target.value)}
          onKeyDown={handlePathInput}
          title="输入路径后按 Enter 导航"
        />

        <div className="toolbar-sep" />

        <div className="toolbar-group">
          <button className="toolbar-btn" title="新建文件夹" onClick={handleMkdir}>
            <FolderPlus size={13} />
          </button>
          <button className="toolbar-btn" title="上传文件" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload size={13} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleUpload}
            disabled={uploading}
          />
          {selected.size > 0 && (
            <button className="toolbar-btn danger" title="删除所选" onClick={handleDelete}>
              <Trash2 size={13} />
              <span style={{ fontSize: 11 }}>{selected.size}</span>
            </button>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="sftp-error">
          <AlertCircle size={13} />
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={12} /></button>
        </div>
      )}

      {/* 上传进度 */}
      {uploadProgress && (
        <div className="sftp-upload-progress">
          <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
          <span>上传 {uploadProgress.name} ({uploadProgress.current}/{uploadProgress.total})</span>
        </div>
      )}

      {/* 文件列表 */}
      <div className="sftp-file-list">
        {loading && !files.length ? (
          <div className="sftp-loading"><Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /><span>加载中...</span></div>
        ) : (
          <>
            <div className="sftp-list-header">
              <div style={{ width: 24 }}>
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === files.length}
                  onChange={handleSelectAll}
                />
              </div>
              <div style={{ flex: 3 }}>名称</div>
              <div style={{ flex: 1, textAlign: 'right' }}>大小</div>
              <div style={{ flex: 2, textAlign: 'right' }}>修改时间</div>
              <div style={{ flex: 1, textAlign: 'right' }}>权限</div>
              <div style={{ width: 60 }} />
            </div>

            {files.length === 0 && (
              <div className="sftp-empty">目录为空</div>
            )}

            {files.map(file => (
              <div
                key={file.name}
                className={`sftp-file-item ${selected.has(file.name) ? 'selected' : ''}`}
                onDoubleClick={() => navigate(file)}
                onClick={() => toggleSelect(file.name)}
              >
                <div style={{ width: 24 }}>
                  <input
                    type="checkbox"
                    checked={selected.has(file.name)}
                    onChange={() => toggleSelect(file.name)}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <div style={{ flex: 3, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                  {file.type === 'd'
                    ? <FolderOpen size={14} style={{ color: '#f39c12', flexShrink: 0 }} />
                    : <File size={14} style={{ color: '#888', flexShrink: 0 }} />
                  }
                  <span className="sftp-filename" title={file.name}>{file.name}</span>
                  {file.type === 'l' && <span style={{ fontSize: 10, color: '#4a6cf7' }}>link</span>}
                </div>
                <div style={{ flex: 1, textAlign: 'right', color: '#888', fontSize: 11 }}>
                  {file.type === 'd' ? '-' : formatSize(file.size)}
                </div>
                <div style={{ flex: 2, textAlign: 'right', color: '#666', fontSize: 11 }}>
                  {formatDate(file.modifyTime)}
                </div>
                <div style={{ flex: 1, textAlign: 'right', color: '#555', fontSize: 11, fontFamily: 'monospace' }}>
                  {file.permissions}
                </div>
                <div style={{ width: 60, display: 'flex', gap: 2, justifyContent: 'flex-end' }}
                  onClick={e => e.stopPropagation()}>
                  {file.type !== 'd' && (
                    <button
                      className="btn btn-icon btn-sm"
                      title="下载"
                      onClick={() => handleDownload(file)}
                      style={{ color: '#4a6cf7' }}
                    >
                      <Download size={11} />
                    </button>
                  )}
                  {file.type === 'd' && (
                    <button
                      className="btn btn-icon btn-sm"
                      title="进入目录"
                      onClick={() => navigate(file)}
                      style={{ color: '#f39c12' }}
                    >
                      <ChevronRight size={11} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 底部状态 */}
      <div className="sftp-statusbar">
        <span>{files.length} 项</span>
        {selected.size > 0 && <span style={{ color: '#4a6cf7' }}>已选 {selected.size} 项</span>}
      </div>
    </div>
  );
}

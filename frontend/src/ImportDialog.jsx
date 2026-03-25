import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, FileText, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { parseImportFile, batchImportConnections } from './api-tauri';

export default function ImportDialog({ onClose, onImported }) {
  const [step, setStep] = useState('select'); // select | preview | done
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState([]);   // ImportedConnection[]
  const [selected, setSelected] = useState(new Set());
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef(null);

  // ── 文件选择 ─────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xsh', 'xts', 'csv'].includes(ext)) {
      setError(`不支持的格式：.${ext}，请选择 .xsh / .xts / .csv 文件`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const conns = await parseImportFile(file.name, new Uint8Array(buf));
      setPreview(conns);
      setSelected(new Set(conns.map((_, i) => i)));
      setStep('preview');
    } catch (e) {
      setError(e?.message || e?.toString() || '解析失败');
    }
    setLoading(false);
  };

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ── 全选/反选 ─────────────────────────────────────────────
  const toggleAll = () => {
    if (selected.size === preview.length) setSelected(new Set());
    else setSelected(new Set(preview.map((_, i) => i)));
  };

  const toggleOne = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  // ── 确认导入 ─────────────────────────────────────────────
  const doImport = async () => {
    const toImport = preview.filter((_, i) => selected.has(i));
    if (!toImport.length) return;
    setLoading(true);
    setError(null);
    try {
      const result = await batchImportConnections(toImport);
      setImportedCount(result.length);
      setStep('done');
      onImported?.();
    } catch (e) {
      setError(e?.message || e?.toString() || '导入失败');
    }
    setLoading(false);
  };

  // ── 渲染 ─────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ width: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        {/* 标题 */}
        <div className="modal-header">
          <Upload size={16} style={{ color: '#4a6cf7' }} />
          <span>导入 Xshell 会话</span>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {step === 'select' && (
            <>
              {/* 拖拽区域 */}
              <div
                className={`import-drop-zone ${dragging ? 'dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {loading ? (
                  <Loader size={32} style={{ animation: 'spin 1s linear infinite', color: '#4a6cf7' }} />
                ) : (
                  <Upload size={32} style={{ color: dragging ? '#4a6cf7' : '#555' }} />
                )}
                <p style={{ margin: '12px 0 4px', fontWeight: 600, color: '#ccc' }}>
                  {loading ? '解析中...' : '拖拽文件到此，或点击选择'}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                  支持 .xsh（单个会话）、.xts（批量导出）、.csv
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xsh,.xts,.csv"
                  style={{ display: 'none' }}
                  onChange={onInputChange}
                />
              </div>

              {/* 说明 */}
              <div style={{ marginTop: 16, padding: 12, background: '#1a1e2e', borderRadius: 6, fontSize: 12, color: '#888', lineHeight: 1.7 }}>
                <strong style={{ color: '#aaa' }}>如何从 Xshell 导出：</strong><br />
                · <strong>.xsh</strong> 单个会话：右键会话 → 在文件夹中显示 → 复制 .xsh 文件<br />
                · <strong>.xts</strong> 批量导出：工具 → 导入/导出 → 导出会话<br />
                · <strong>.csv</strong> 表格：工具 → 导入/导出 → 导出为 CSV
              </div>

              {/* 密码提示 */}
              <div style={{ marginTop: 12, padding: 12, background: '#2a1e10', borderRadius: 6, fontSize: 12, color: '#c9a227', lineHeight: 1.7, border: '1px solid #5c4a1f' }}>
                <strong>⚠️ 关于密码：</strong><br />
                Xshell 的密码是加密存储的，导入时无法解密。导入后密码将为空，连接时会提示您输入密码，或您可以右键编辑连接提前设置密码。
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CheckCircle size={16} style={{ color: '#2ecc71' }} />
                <span style={{ color: '#ccc', fontSize: 13 }}>
                  解析到 <strong style={{ color: '#fff' }}>{preview.length}</strong> 个连接，请确认后导入：
                </span>
                <button
                  style={{ marginLeft: 'auto', fontSize: 12, color: '#4a6cf7', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={toggleAll}
                >
                  {selected.size === preview.length ? '取消全选' : '全选'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {preview.map((conn, i) => (
                  <div
                    key={i}
                    className={`import-conn-item ${selected.has(i) ? 'selected' : ''}`}
                    onClick={() => toggleOne(i)}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleOne(i)}
                      onClick={e => e.stopPropagation()}
                      style={{ flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={12} style={{ color: '#4a6cf7', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conn.name}
                        </span>
                        {conn.group && conn.group !== 'Xshell导入' && (
                          <span style={{ fontSize: 10, color: '#666', background: '#1e2235', padding: '1px 6px', borderRadius: 3, flexShrink: 0 }}>
                            {conn.group}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                        {conn.username ? `${conn.username}@` : ''}{conn.host}:{conn.port}
                        <span style={{ marginLeft: 8, color: '#4a6cf7' }}>
                          {conn.authType === 'key' ? '🔑 密钥' : '🔐 密码'}
                        </span>
                        {conn.description && (
                          <span style={{ marginLeft: 8, color: '#555', fontStyle: 'italic' }}>
                            {conn.description.slice(0, 40)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <CheckCircle size={48} style={{ color: '#2ecc71', margin: '0 auto 16px' }} />
              <p style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: '0 0 8px' }}>
                导入成功
              </p>
              <p style={{ fontSize: 14, color: '#888' }}>
                共导入 <strong style={{ color: '#4a6cf7' }}>{importedCount}</strong> 个连接
              </p>
              <div style={{ marginTop: 16, padding: 12, background: '#2a1e10', borderRadius: 6, fontSize: 12, color: '#c9a227', border: '1px solid #5c4a1f' }}>
                ⚠️ 密码未导入，首次连接时需要输入密码
              </div>
            </div>
          )}

          {/* 错误 */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '8px 12px', background: '#2d1515', border: '1px solid #c0392b', borderRadius: 6, color: '#e74c3c', fontSize: 13 }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{error}</span>
              <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }} onClick={() => setError(null)}>
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="modal-footer">
          {step === 'select' && (
            <button className="btn btn-secondary" onClick={onClose}>取消</button>
          )}
          {step === 'preview' && (
            <>
              <button className="btn btn-secondary" onClick={() => setStep('select')}>返回</button>
              <button
                className="btn btn-primary"
                onClick={doImport}
                disabled={selected.size === 0 || loading}
              >
                {loading
                  ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> 导入中...</>
                  : `导入 ${selected.size} 个连接`
                }
              </button>
            </>
          )}
          {step === 'done' && (
            <button className="btn btn-primary" onClick={onClose}>完成</button>
          )}
        </div>
      </div>
    </div>
  );
}

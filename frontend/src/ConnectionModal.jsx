import { useState, useEffect } from 'react';
import { X, FolderOpen } from 'lucide-react';
import { testConnection } from './api-tauri';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

const DEFAULT_FORM = {
  name: '',
  host: '',
  port: '22',
  username: '',
  password: '',
  privateKey: '',
  authType: 'password',
  group: 'default',
};

export default function ConnectionModal({ open, onClose, onSave, initialData }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initialData ? { ...DEFAULT_FORM, ...initialData } : DEFAULT_FORM);
      setTestResult(null);
    }
  }, [open, initialData]);

  const set = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // 转换为正确的数据类型
      const dataToSend = {
        ...form,
        port: Number(form.port) || 22
      };
      console.log('测试连接数据:', dataToSend);
      const result = await testConnection(dataToSend);
      console.log('测试连接结果:', result);
      setTestResult(result);
    } catch (e) {
      console.error('测试连接异常:', e);
      setTestResult({ success: false, error: e.message || String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleBrowsePem = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          { name: '私钥文件', extensions: ['pem', 'key', 'rsa', 'ppk', 'openssh'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });
      if (selected) {
        // 通过 Rust 后端读取文件内容
        const content = await invoke('read_text_file', { path: selected });
        set('privateKey', content);
      }
    } catch (e) {
      console.error('选择文件失败:', e);
    }
  };

  const handleSave = async () => {
    if (!form.host || !form.username) return;
    setSaving(true);
    try {
      // 转换为正确的数据类型，并排除不需要的字段
      const { id, created_at, ...dataToSend } = {
        ...form,
        port: Number(form.port) || 22
      };
      await onSave(dataToSend);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>{initialData ? '编辑连接' : '新建连接'}</h3>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>连接名称</label>
            <input
              className="form-control"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="My Server"
            />
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 3 }}>
              <label>主机地址 *</label>
              <input
                className="form-control"
                value={form.host}
                onChange={e => set('host', e.target.value)}
                placeholder="192.168.1.1 或 example.com"
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>端口</label>
              <input
                className="form-control"
                value={form.port}
                onChange={e => set('port', e.target.value)}
                placeholder="22"
                type="number"
              />
            </div>
          </div>
          <div className="form-group">
            <label>用户名 *</label>
            <input
              className="form-control"
              value={form.username}
              onChange={e => set('username', e.target.value)}
              placeholder="root"
            />
          </div>
          <div className="form-group">
            <label>认证方式</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="password"
                  checked={form.authType === 'password'}
                  onChange={() => set('authType', 'password')}
                />
                密码认证
              </label>
              <label>
                <input
                  type="radio"
                  value="key"
                  checked={form.authType === 'key'}
                  onChange={() => set('authType', 'key')}
                />
                密钥认证
              </label>
            </div>
          </div>
          {form.authType === 'password' ? (
            <div className="form-group">
              <label>密码</label>
              <input
                className="form-control"
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="••••••••"
              />
            </div>
          ) : (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>私钥内容（PEM 格式）</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '2px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={handleBrowsePem}
                  title="从文件选择私钥"
                >
                  <FolderOpen size={13} />
                  选择文件
                </button>
              </label>
              <textarea
                className="form-control"
                value={form.privateKey}
                onChange={e => set('privateKey', e.target.value)}
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----&#10;&#10;也可点击右上角「选择文件」直接加载 .pem / .key 文件"
                rows={5}
              />
            </div>
          )}
          <div className="form-group">
            <label>分组</label>
            <input
              className="form-control"
              value={form.group}
              onChange={e => set('group', e.target.value)}
              placeholder="default"
            />
          </div>

          {testResult && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
              background: testResult.success ? '#1a3a2a' : '#3a1a1a',
              border: `1px solid ${testResult.success ? '#2ecc71' : '#e05555'}`,
              color: testResult.success ? '#2ecc71' : '#e05555',
              marginBottom: '4px',
              wordBreak: 'break-word',
            }}>
              {testResult.success ? '✓ 连接成功！' : `✗ ${testResult.error || '连接失败，请检查配置'}`}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-ghost"
            onClick={handleTest}
            disabled={testing || !form.host || !form.username}
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !form.host || !form.username}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

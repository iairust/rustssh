import { useState, useCallback, useRef, useEffect } from 'react';
import { Terminal as TermIcon, Plus, X, Monitor, Wifi, WifiOff, Globe, FolderOpen, Upload } from 'lucide-react';
import Sidebar from './Sidebar';
import Terminal from './Terminal';
import SftpPanel from './SftpPanel';
import ConnectionModal from './ConnectionModal';
import ImportDialog from './ImportDialog';
import { createConnection, updateConnection, getConnection } from './api-tauri';
import './index.css';

let tabIdCounter = 1;

export default function App() {
  const [tabs, setTabs] = useState([]);
  // tab: { id, type: 'terminal'|'sftp', connectionId, name, status }
  const [activeTab, setActiveTab] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingConn, setEditingConn] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const draggingRef = useRef(false);
  const sidebarKeyRef = useRef(0);
  const terminalRefs = useRef({});

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const handleConnect = useCallback(async (connectionId) => {
    const existing = tabs.find(t => t.connectionId === connectionId && t.type === 'terminal' && t.status !== 'disconnected');
    if (existing) { setActiveTab(existing.id); return; }
    try {
      const conn = await getConnection(connectionId);
      
      // 检查是否有密码（密码认证且密码为空）
      const needsPassword = conn.auth_type === 'password' && !conn.password;
      if (needsPassword) {
        showToast('请先设置密码', 'warning');
        setEditingConn(conn);
        setModalOpen(true);
        return;
      }
      
      const tabId = tabIdCounter++;
      setTabs(prev => [...prev, {
        id: tabId, type: 'terminal', connectionId,
        name: conn.name || conn.host, host: conn.host, status: 'connecting',
      }]);
      setActiveTab(tabId);
    } catch (e) {
      showToast('无法获取连接信息: ' + e.message, 'error');
    }
  }, [tabs, showToast]);

  // 处理认证失败，打开编辑对话框让用户修改密码
  const handleAuthError = useCallback(async (connectionId) => {
    try {
      const conn = await getConnection(connectionId);
      showToast('认证失败，请检查密码', 'error');
      setEditingConn(conn);
      setModalOpen(true);
    } catch (e) {
      showToast('无法获取连接信息: ' + e.message, 'error');
    }
  }, [showToast]);

  const handleSftp = useCallback(async (connectionId) => {
    const existing = tabs.find(t => t.connectionId === connectionId && t.type === 'sftp');
    if (existing) { setActiveTab(existing.id); return; }
    try {
      const conn = await getConnection(connectionId);
      const tabId = tabIdCounter++;
      setTabs(prev => [...prev, {
        id: tabId, type: 'sftp', connectionId,
        name: `SFTP: ${conn.name || conn.host}`, host: conn.host, status: 'connected',
      }]);
      setActiveTab(tabId);
    } catch (e) {
      showToast('无法获取连接信息: ' + e.message, 'error');
    }
  }, [tabs, showToast]);

  const handleCloseTab = useCallback((tabId, e) => {
    e?.stopPropagation();
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId);
      const next = prev.filter(t => t.id !== tabId);
      if (activeTab === tabId && next.length > 0) {
        setActiveTab(next[Math.max(0, idx - 1)]?.id ?? next[0]?.id);
      } else if (next.length === 0) {
        setActiveTab(null);
      }
      return next;
    });
  }, [activeTab]);

  const handleTabStatus = useCallback((tabId, status) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, status } : t));
  }, []);

  const handleEditConn = useCallback((conn) => {
    setEditingConn(conn || null);
    setModalOpen(true);
  }, []);

  const handleSaveConn = useCallback(async (data) => {
    try {
      if (editingConn?.id) {
        await updateConnection(editingConn.id, data);
        showToast('连接已更新', 'success');
      } else {
        await createConnection(data);
        showToast('连接已创建', 'success');
      }
      sidebarKeyRef.current += 1;
    } catch (e) {
      const errorMsg = e?.message || e?.toString() || '未知错误';
      showToast('保存失败: ' + errorMsg, 'error');
    }
  }, [editingConn, showToast]);

  // 拖拽侧边栏
  const handleMouseDown = (e) => { draggingRef.current = true; e.preventDefault(); };
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return;
      setSidebarWidth(Math.max(160, Math.min(400, e.clientX)));
    };
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const activeTabData = tabs.find(t => t.id === activeTab);

  return (
    <div className="app-layout">
      {/* 顶部标题栏 */}
      <header className="app-header">
        <div className="logo">
          <TermIcon size={20} />
          <span>Rust<b style={{ color: '#4a6cf7' }}>SSH</b></span>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setImportDialogOpen(true)} title="导入 Xshell 会话">
            <Upload size={13} /> 导入
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => handleEditConn(null)}>
            <Plus size={13} /> 新建连接
          </button>
        </div>
      </header>

      <div className="app-body">
        <div style={{ width: sidebarWidth, flexShrink: 0, display: 'flex' }}>
          <Sidebar
            key={sidebarKeyRef.current}
            onConnect={handleConnect}
            onEdit={handleEditConn}
            onSftp={handleSftp}
            activeConnectionId={activeTabData?.connectionId}
          />
        </div>

        <div className="resize-handle" onMouseDown={handleMouseDown} />

        <div className="main-content">
          {/* 标签栏 */}
          {tabs.length > 0 && (
            <div className="tabs-bar">
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  className={`tab-item ${tab.id === activeTab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.host}
                >
                  {tab.type === 'sftp'
                    ? <FolderOpen size={11} style={{ color: '#2ecc71', flexShrink: 0 }} />
                    : <span className={`status-dot ${tab.status}`} />
                  }
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tab.name}
                  </span>
                  <span className="tab-close" onClick={e => handleCloseTab(tab.id, e)}>
                    <X size={11} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 内容区 */}
          <div className="terminal-area">
            {tabs.length === 0 ? (
              <WelcomeScreen onNewConnection={() => handleEditConn(null)} />
            ) : (
              <div className="terminal-wrapper">
                {tabs.map(tab =>
                  tab.type === 'terminal' ? (
                    <Terminal
                      key={tab.id}
                      ref={el => terminalRefs.current[tab.id] = el}
                      connectionId={tab.connectionId}
                      isActive={tab.id === activeTab}
                      onStatusChange={(s) => handleTabStatus(tab.id, s)}
                      onAuthError={() => handleAuthError(tab.connectionId)}
                    />
                  ) : (
                    <div
                      key={tab.id}
                      style={{ display: tab.id === activeTab ? 'flex' : 'none', width: '100%', height: '100%' }}
                    >
                      <SftpPanel
                        connectionId={tab.connectionId}
                        onClose={() => handleCloseTab(tab.id)}
                      />
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 状态栏 */}
      <div className="status-bar">
        <div className="status-item">
          <Globe size={11} />
          <span>RustSSH Manager</span>
        </div>
        {activeTabData && (
          <div className="status-item">
            {activeTabData.type === 'sftp'
              ? <FolderOpen size={11} style={{ color: '#2ecc71' }} />
              : activeTabData.status === 'connected'
                ? <Wifi size={11} color="#2ecc71" />
                : <WifiOff size={11} color="#555" />
            }
            <span>{activeTabData.host}</span>
            {activeTabData.type === 'sftp'
              ? <span style={{ color: '#2ecc71' }}>SFTP</span>
              : <span style={{ color: activeTabData.status === 'connected' ? '#2ecc71' : '#555' }}>
                  {activeTabData.status === 'connected' ? '已连接' : activeTabData.status === 'connecting' ? '连接中' : '已断开'}
                </span>
            }
          </div>
        )}
        <div className="status-item" style={{ marginLeft: 'auto' }}>
          <span>{tabs.length} 个标签页</span>
        </div>
      </div>

      <ConnectionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveConn}
        initialData={editingConn}
      />

      {importDialogOpen && (
        <ImportDialog
          onClose={() => setImportDialogOpen(false)}
          onImported={() => {
            // 刷新侧边栏连接列表
            sidebarKeyRef.current += 1;
            showToast('会话导入成功', 'success');
          }}
        />
      )}

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
        ))}
      </div>
    </div>
  );
}

function WelcomeScreen({ onNewConnection }) {
  return (
    <div className="welcome-screen">
      <Monitor size={60} color="#2a2a4a" />
      <h2>欢迎使用 RustSSH</h2>
      <p>双击左侧连接以打开终端，或右键查看更多操作</p>
      <div className="shortcuts">
        <div className="shortcut-item">
          <span className="shortcut-key">双击</span>
          <span>打开 SSH 终端</span>
        </div>
        <div className="shortcut-item">
          <span className="shortcut-key">右键菜单</span>
          <span>终端 / SFTP / 编辑 / 删除</span>
        </div>
        <div className="shortcut-item">
          <span className="shortcut-key">Ctrl+C</span>
          <span>中断当前命令</span>
        </div>
        <div className="shortcut-item">
          <span className="shortcut-key">Tab</span>
          <span>命令自动补全</span>
        </div>
      </div>
      <button className="btn btn-primary" onClick={onNewConnection} style={{ marginTop: 8 }}>
        <Plus size={14} /> 新建 SSH 连接
      </button>
    </div>
  );
}

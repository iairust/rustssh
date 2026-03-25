import { useState, useEffect, useCallback } from 'react';
import { Plus, Server, ChevronDown, ChevronRight, Search, RefreshCw, Terminal, Edit2, Trash2, FolderOpen, Copy } from 'lucide-react';
import { getConnections, deleteConnection } from './api-tauri';
import ContextMenu from './ContextMenu';

export default function Sidebar({ onConnect, onEdit, onSftp, activeConnectionId }) {
  const [connections, setConnections] = useState([]);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, conn }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConnections();
      setConnections(data);
      const groups = {};
      data.forEach(c => { groups[c.group || 'default'] = true; });
      setExpandedGroups(groups);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!confirm('确认删除此连接？')) return;
    await deleteConnection(id);
    load();
  };

  const handleContextMenu = (e, conn) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, conn });
  };

  const filtered = connections.filter(c => {
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.host?.toLowerCase().includes(q) ||
      c.username?.toLowerCase().includes(q)
    );
  });

  const groups = {};
  filtered.forEach(c => {
    const g = c.group || 'default';
    if (!groups[g]) groups[g] = [];
    groups[g].push(c);
  });

  const toggleGroup = (g) => {
    setExpandedGroups(prev => ({ ...prev, [g]: !prev[g] }));
  };

  const contextMenuItems = contextMenu?.conn ? [
    {
      label: '连接终端',
      icon: <Terminal size={13} />,
      onClick: () => onConnect(contextMenu.conn.id),
    },
    {
      label: 'SFTP 文件管理',
      icon: <FolderOpen size={13} />,
      onClick: () => onSftp && onSftp(contextMenu.conn.id),
    },
    { separator: true },
    {
      label: '编辑连接',
      icon: <Edit2 size={13} />,
      onClick: () => onEdit(contextMenu.conn),
    },
    {
      label: '复制连接',
      icon: <Copy size={13} />,
      onClick: () => {
        const { id, ...rest } = contextMenu.conn;
        onEdit({ ...rest, name: rest.name + ' (副本)' });
      },
    },
    { separator: true },
    {
      label: '删除连接',
      icon: <Trash2 size={13} />,
      danger: true,
      onClick: () => handleDelete(contextMenu.conn.id),
    },
  ] : [];

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">连接管理</span>
          <div className="sidebar-actions">
            <button className="btn btn-icon" title="刷新" onClick={load}>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button
              className="btn btn-icon btn-primary" title="新建连接" onClick={() => onEdit(null)}
              style={{ background: '#4a6cf720', color: '#4a6cf7' }}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="search-bar">
          <Search size={12} style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: '#555', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索连接..."
            style={{ paddingLeft: 28 }}
          />
        </div>

        <div className="connection-list">
          {Object.keys(groups).length === 0 && (
            <div className="empty-state">
              <Server size={32} color="#333" />
              <span>暂无连接</span>
              <button className="btn btn-primary btn-sm" onClick={() => onEdit(null)}>
                <Plus size={12} /> 添加连接
              </button>
            </div>
          )}
          {Object.entries(groups).map(([groupName, conns]) => (
            <div key={groupName} className="connection-group">
              <div className="group-header" onClick={() => toggleGroup(groupName)}>
                {expandedGroups[groupName]
                  ? <ChevronDown size={12} style={{ marginRight: 4 }} />
                  : <ChevronRight size={12} style={{ marginRight: 4 }} />}
                {groupName} ({conns.length})
              </div>
              {expandedGroups[groupName] && conns.map(conn => (
                <div
                  key={conn.id}
                  className={`connection-item ${activeConnectionId === conn.id ? 'active' : ''}`}
                  onDoubleClick={() => onConnect(conn.id)}
                  onContextMenu={(e) => handleContextMenu(e, conn)}
                  title={`${conn.username}@${conn.host}:${conn.port}`}
                >
                  <div className="conn-icon">
                    <Server size={13} />
                  </div>
                  <div className="conn-info">
                    <div className="conn-name">{conn.name}</div>
                    <div className="conn-host">{conn.username}@{conn.host}:{conn.port}</div>
                  </div>
                  <div className="conn-actions">
                    <button
                      className="btn btn-icon btn-sm"
                      title="连接终端"
                      onClick={e => { e.stopPropagation(); onConnect(conn.id); }}
                      style={{ color: '#4a6cf7' }}
                    >
                      <Terminal size={12} />
                    </button>
                    {onSftp && (
                      <button
                        className="btn btn-icon btn-sm"
                        title="SFTP文件管理"
                        onClick={e => { e.stopPropagation(); onSftp(conn.id); }}
                        style={{ color: '#2ecc71' }}
                      >
                        <FolderOpen size={12} />
                      </button>
                    )}
                    <button
                      className="btn btn-icon btn-sm"
                      title="编辑"
                      onClick={e => { e.stopPropagation(); onEdit(conn); }}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      className="btn btn-icon btn-sm"
                      title="删除"
                      onClick={e => { e.stopPropagation(); handleDelete(conn.id); }}
                      style={{ color: '#e05555' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { listenTerminalEvents, connectTerminal, sendTerminalData, disconnectTerminal } from './api-tauri';
import '@xterm/xterm/css/xterm.css';
import {
  ZoomIn, ZoomOut, Trash2, Copy, RotateCcw, Power, Search, X, ChevronUp, ChevronDown
} from 'lucide-react';

const THEMES = {
  dark: {
    background: '#0c0c14',
    foreground: '#e0e0e0',
    cursor: '#4a6cf7',
    cursorAccent: '#0c0c14',
    selectionBackground: 'rgba(74, 108, 247, 0.3)',
    black: '#000000', red: '#e05555', green: '#2ecc71', yellow: '#f39c12',
    blue: '#4a6cf7', magenta: '#9b59b6', cyan: '#1abc9c', white: '#e0e0e0',
    brightBlack: '#555', brightRed: '#ff6b6b', brightGreen: '#55efc4',
    brightYellow: '#fdcb6e', brightBlue: '#74b9ff', brightMagenta: '#a29bfe',
    brightCyan: '#00cec9', brightWhite: '#fff',
  },
  solarized: {
    background: '#002b36', foreground: '#839496', cursor: '#859900',
    selectionBackground: 'rgba(133,153,0,0.3)',
    black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900',
    blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
    brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75',
    brightYellow: '#657b83', brightBlue: '#839496', brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1', brightWhite: '#fdf6e3',
  },
  monokai: {
    background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f0',
    selectionBackground: 'rgba(73,72,62,0.5)',
    black: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#f4bf75',
    blue: '#66d9ef', magenta: '#ae81ff', cyan: '#a1efe4', white: '#f8f8f2',
    brightBlack: '#75715e', brightRed: '#f92672', brightGreen: '#a6e22e',
    brightYellow: '#f4bf75', brightBlue: '#66d9ef', brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4', brightWhite: '#f9f8f5',
  },
  light: {
    background: '#fafafa', foreground: '#2d2d2d', cursor: '#2d2d2d',
    selectionBackground: 'rgba(0,0,0,0.15)',
    black: '#000', red: '#c0392b', green: '#27ae60', yellow: '#f39c12',
    blue: '#2980b9', magenta: '#8e44ad', cyan: '#16a085', white: '#555',
    brightBlack: '#888', brightRed: '#e74c3c', brightGreen: '#2ecc71',
    brightYellow: '#f1c40f', brightBlue: '#3498db', brightMagenta: '#9b59b6',
    brightCyan: '#1abc9c', brightWhite: '#333',
  },
};

const Terminal = forwardRef(function Terminal(
  { connectionId, isActive, onStatusChange, onAuthError, fontSize: initialFontSize = 13, theme: initialTheme = 'dark' },
  ref
) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const searchAddonRef = useRef(null);
  const termIdRef = useRef(null);
  const unlistenRef = useRef(null);   // 追踪事件监听器，防止重复注册
  const onDataDisposeRef = useRef(null); // 追踪 onData disposable
  const [status, setStatus] = useState('disconnected');
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [theme, setTheme] = useState(initialTheme);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  const updateStatus = (s) => {
    setStatus(s);
    onStatusChange?.(s);
  };

  useImperativeHandle(ref, () => ({
    reconnect: () => {
      if (termIdRef.current) {
        disconnectTerminal(termIdRef.current);
        termIdRef.current = null;
        connect();
      }
    },
    clear: () => termRef.current?.clear(),
    focus: () => termRef.current?.focus(),
  }));

  const connect = async () => {
    if (!termRef.current) return;

    // 先清理旧的监听器，防止重复注册导致双重回显
    if (unlistenRef.current) {
      const ul = unlistenRef.current;
      unlistenRef.current = null;
      try { ul(); } catch {}
    }
    if (onDataDisposeRef.current) {
      try { onDataDisposeRef.current.dispose(); } catch {}
      onDataDisposeRef.current = null;
    }

    const term = termRef.current;
    const { cols, rows } = term;

    try {
      term.writeln('\x1b[1;34mConnecting to server...\x1b[0m');
      const termId = await connectTerminal(connectionId, cols, rows);
      termIdRef.current = termId;
      updateStatus('connecting');
    } catch (e) {
      term.writeln(`\r\n\x1b[1;31m[Connect Error] ${e.message || 'Failed to connect'}\x1b[0m`);
      updateStatus('disconnected');
      return;
    }

    // 监听终端事件（保存 unlisten 引用，防止重复注册）
    const unlisten = await listenTerminalEvents((payload) => {
      if (payload.termId !== termIdRef.current) return;

      if (payload.type === 'data') {
        // base64 解码为二进制 Uint8Array，正确处理中文等非 ASCII 字符
        const binaryStr = atob(payload.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        termRef.current?.write(bytes);
      } else if (payload.type === 'status') {
        updateStatus(payload.status);
        if (payload.status === 'connected') {
          term.writeln('\x1b[1;32mConnected!\x1b[0m\r\n');
          termRef.current?.focus();
        } else if (payload.status === 'disconnected') {
          term.writeln('\r\n\x1b[1;33m[Connection closed]\x1b[0m');
        }
      } else if (payload.type === 'error') {
        term.writeln(`\r\n\x1b[1;31m[Error] ${payload.message}\x1b[0m\r\n`);
        updateStatus('disconnected');
        // 连接失败时触发编辑回调，让用户修改密码
        if (payload.message?.includes('authentication') || payload.message?.includes('密码') || payload.message?.includes('password') || payload.message?.includes('denied')) {
          onAuthError?.();
        }
      }
    });
    unlistenRef.current = unlisten;

    // onData 只注册一次，保存 disposable 以便后续清理
    const onDataDispose = term.onData((data) => {
      if (termIdRef.current) {
        sendTerminalData(termIdRef.current, data).catch(() => {});
      }
    });
    onDataDisposeRef.current = onDataDispose;

    // 清理函数
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      if (onDataDisposeRef.current) {
        try { onDataDisposeRef.current.dispose(); } catch {}
        onDataDisposeRef.current = null;
      }
      if (termIdRef.current) {
        disconnectTerminal(termIdRef.current).catch(() => {});
        termIdRef.current = null;
      }
    };
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      theme: THEMES[theme],
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
      fontSize,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    setTimeout(() => { try { fitAddon.fit(); } catch {} }, 50);

    let cleanup;
    connect().then(fn => { cleanup = fn; });

    return () => {
      cleanup?.();
      term.dispose();
    };
  }, [connectionId]);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize;
      try { fitAddonRef.current?.fit(); } catch {}
    }
  }, [fontSize]);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = THEMES[theme];
    }
  }, [theme]);

  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => { try { fitAddonRef.current.fit(); } catch {} }, 50);
    }
  }, [isActive]);

  const handleSearch = (dir = 'next') => {
    if (!searchText || !searchAddonRef.current) return;
    if (dir === 'next') {
      searchAddonRef.current.findNext(searchText, { caseSensitive: false, incremental: false });
    } else {
      searchAddonRef.current.findPrevious(searchText, { caseSensitive: false, incremental: false });
    }
  };

  const handleCopy = () => {
    const sel = termRef.current?.getSelection();
    if (sel) navigator.clipboard.writeText(sel);
  };

  const handleClear = () => {
    termRef.current?.clear();
    termRef.current?.focus();
  };

  const termBg = THEMES[theme]?.background || '#0c0c14';

  return (
    <div style={{ display: isActive ? 'flex' : 'none', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div className="terminal-toolbar">
        <div className="toolbar-group">
          <button className="toolbar-btn" title="减小字体" onClick={() => setFontSize(s => Math.max(10, s - 1))}>
            <ZoomOut size={13} />
          </button>
          <span className="toolbar-font-size">{fontSize}px</span>
          <button className="toolbar-btn" title="增大字体" onClick={() => setFontSize(s => Math.min(24, s + 1))}>
            <ZoomIn size={13} />
          </button>
        </div>

        <div className="toolbar-sep" />

        <div className="toolbar-group">
          <select
            className="toolbar-select"
            value={theme}
            onChange={e => setTheme(e.target.value)}
            title="终端主题"
          >
            <option value="dark">暗色</option>
            <option value="monokai">Monokai</option>
            <option value="solarized">Solarized</option>
            <option value="light">浅色</option>
          </select>
        </div>

        <div className="toolbar-sep" />

        <div className="toolbar-group">
          <button className="toolbar-btn" title="搜索" onClick={() => setSearchOpen(s => !s)}>
            <Search size={13} />
          </button>
          <button className="toolbar-btn" title="复制选中" onClick={handleCopy}>
            <Copy size={13} />
          </button>
          <button className="toolbar-btn" title="清屏" onClick={handleClear}>
            <Trash2 size={13} />
          </button>
        </div>

        <div className="toolbar-sep" />

        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            title="重新连接"
            onClick={() => {
              if (termIdRef.current) {
                disconnectTerminal(termIdRef.current).catch(() => {});
                termIdRef.current = null;
              }
              connect();
            }}
            disabled={status === 'connecting'}
          >
            <RotateCcw size={13} />
          </button>
          <button
            className="toolbar-btn danger"
            title="断开连接"
            onClick={() => {
              if (termIdRef.current) {
                disconnectTerminal(termIdRef.current).catch(() => {});
                termIdRef.current = null;
              }
            }}
            disabled={status === 'disconnected'}
          >
            <Power size={13} />
          </button>
        </div>

        <div style={{ marginLeft: 'auto', marginRight: 8 }}>
          <span className={`toolbar-status ${status}`}>
            <span className="status-dot-sm" />
            {status === 'connected' ? '已连接' : status === 'connecting' ? '连接中' : '已断开'}
          </span>
        </div>
      </div>

      {searchOpen && (
        <div className="terminal-search-bar">
          <Search size={12} style={{ color: '#888', flexShrink: 0 }} />
          <input
            autoFocus
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSearch(e.shiftKey ? 'prev' : 'next');
              if (e.key === 'Escape') setSearchOpen(false);
            }}
            placeholder="搜索..."
          />
          <button className="toolbar-btn" title="上一个" onClick={() => handleSearch('prev')}>
            <ChevronUp size={13} />
          </button>
          <button className="toolbar-btn" title="下一个" onClick={() => handleSearch('next')}>
            <ChevronDown size={13} />
          </button>
          <button className="toolbar-btn" onClick={() => setSearchOpen(false)}>
            <X size={13} />
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        style={{ flex: 1, background: termBg, overflow: 'hidden', padding: '2px' }}
      />
    </div>
  );
});

export default Terminal;

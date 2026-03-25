import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import * as Event from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-shell';

// ===== 连接管理 =====

export async function getConnections() {
  return await invoke('get_all_connections');
}

export async function getConnection(id) {
  return await invoke('get_connection', { id });
}

export async function createConnection(data) {
  return await invoke('create_connection', { conn: data });
}

export async function updateConnection(id, data) {
  return await invoke('update_connection', { id, updates: data });
}

export async function deleteConnection(id) {
  return await invoke('delete_connection', { id });
}

export async function testConnection(data) {
  return await invoke('test_connection', { conn: data });
}

// ===== 终端 =====

let terminalListener = null;

export async function connectTerminal(connectionId, cols = 80, rows = 24) {
  const termId = await invoke('connect_terminal', { connectionId, cols, rows });
  return termId;
}

export async function sendTerminalData(termId, data) {
  // 直接传字符串，Rust 端会原样转发给后端
  await invoke('send_data', { termId, data });
}

export async function resizeTerminal(termId, cols, rows) {
  await invoke('resize_terminal', { termId, cols, rows });
}

export async function disconnectTerminal(termId) {
  await invoke('disconnect_terminal', { termId });
}

export function listenTerminalEvents(callback) {
  return Event.listen('terminal-event', (event) => {
    callback(event.payload);
  });
}

// ===== SFTP =====

export async function sftpListDirectory(connectionId, path) {
  return await invoke('list_directory', { connectionId, path });
}

export async function sftpDownloadFile(connectionId, remotePath, savePath = null) {
  const localPath = await invoke('download_file', { connectionId, remotePath, savePath });
  return localPath;
}

export async function sftpUploadFile(connectionId, fileData, remotePath) {
  // fileData: Uint8Array or ArrayBuffer
  const data = fileData instanceof ArrayBuffer ? new Uint8Array(fileData) : fileData;
  await invoke('upload_file', { connectionId, remotePath, fileData: Array.from(data) });
}

export async function sftpDeletePath(connectionId, path) {
  await invoke('delete_path', { connectionId, path });
}

export async function sftpCreateDirectory(connectionId, path) {
  await invoke('create_directory', { connectionId, path });
}

// ===== 导入 Xshell 会话 =====

export async function parseImportFile(fileName, fileData) {
  const data = fileData instanceof ArrayBuffer ? new Uint8Array(fileData) : fileData;
  return await invoke('parse_import_file', { fileName, fileData: Array.from(data) });
}

export async function batchImportConnections(connections) {
  return await invoke('batch_import_connections', { connections });
}

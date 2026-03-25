import { invoke } from '@tauri-apps/api/core';

export async function saveCommand(connectionId, connectionName, host, command, sessionStart) {
  try {
    await invoke('save_command', {
      connectionId,
      connectionName,
      host,
      command,
      sessionStart: sessionStart.toISOString()
    });
  } catch (e) {
    console.error('保存命令失败:', e);
  }
}

export async function getCommandHistory(options = {}) {
  try {
    const result = await invoke('get_command_history', {
      connectionId: options.connectionId || null,
      search: options.search || null,
      limit: options.limit || 100,
      offset: options.offset || 0
    });
    return result;
  } catch (e) {
    console.error('获取命令历史失败:', e);
    return { commands: [], total: 0 };
  }
}

export async function getFrequentCommands(connectionId, limit = 20) {
  try {
    return await invoke('get_frequent_commands', {
      connectionId: connectionId || null,
      limit
    });
  } catch (e) {
    console.error('获取常用命令失败:', e);
    return [];
  }
}

export async function clearCommandHistory(connectionId) {
  try {
    await invoke('clear_command_history', { connectionId: connectionId || null });
    return true;
  } catch (e) {
    console.error('清空历史失败:', e);
    return false;
  }
}

export async function exportCommandHistory(format = 'json') {
  try {
    return await invoke('export_command_history', { format });
  } catch (e) {
    console.error('导出历史失败:', e);
    return null;
  }
}

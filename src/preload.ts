import { contextBridge, ipcRenderer } from 'electron';

const fnNames = ipcRenderer.sendSync('win-api:list') as string[];

const api: Record<string, unknown> = {};

for (const name of fnNames) {
  if (name.startsWith('on')) {
    api[name] = (onChange: (...args: unknown[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
        onChange(...args);
      };
      ipcRenderer.on(`win-api:${name}`, listener);
      return () => {
        ipcRenderer.removeListener(`win-api:${name}`, listener);
      };
    };
  } else {
    api[name] = (...args: unknown[]) => ipcRenderer.invoke(`win-api:${name}`, ...args);
  }
}

contextBridge.exposeInMainWorld('winApi', api);

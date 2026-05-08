// src/main/app.ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import './ipc/handlers'; // registers IPC handlers in main

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/bridge.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Load your renderer (HTML or dev server URL)
  win.loadURL(process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../renderer/index.html')}`);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
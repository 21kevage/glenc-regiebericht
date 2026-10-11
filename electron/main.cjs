const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const startUrl = `file://${path.join(__dirname, '..', 'index.html')}`;
  const window = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 760,
    minHeight: 640,
    title: 'Glenc Regiebericht',
    autoHideMenuBar: true,
    backgroundColor: '#f6f2ea',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== startUrl) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  window.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

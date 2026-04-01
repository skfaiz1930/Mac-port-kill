const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut } = require('electron');
const { exec } = require('child_process');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 650,
    minWidth: 800,
    minHeight: 500,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d0d0f',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    center: true,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Hide window when it loses focus (optional, but very "Spotlight-like")
  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      // mainWindow.hide(); // Uncomment if you want it to hide automatically on blur
    }
  });
}

// ─── Shortcut Toggle ───────────────────────────────────────────────────────
function toggleWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }

  if (mainWindow.isVisible()) {
    if (mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// ─── IPC: Hide Window ────────────────────────────────────────────────────────
ipcMain.on('hide-window', () => {
  if (mainWindow) mainWindow.hide();
});

// ─── IPC: Get Ports ──────────────────────────────────────────────────────────
// ... (rest of the file remains same, will just append handlers below)
ipcMain.handle('get-ports', async () => {
  return new Promise((resolve) => {
    exec('lsof -i -P -n | grep LISTEN', (err, stdout) => {
      if (err && !stdout) {
        // lsof returns exit code 1 when no results; that's fine
        resolve([]);
        return;
      }

      const lines = stdout.trim().split('\n').filter(Boolean);
      const portMap = new Map(); // dedupe by PID+port

      const ports = lines.reduce((acc, line) => {
        const cols = line.trim().split(/\s+/);
        if (cols.length < 8) return acc;

        const processName = cols[0];
        const pid = parseInt(cols[1], 10);
        
        // Find the column that contains the address and port (e.g. *:3000 or 127.0.0.1:8080)
        // Usually it's index 8, but it could vary. Let's look for ":"
        let nameCol = cols.find(c => c.includes(':') && !c.startsWith('0x')); 
        if (!nameCol) return acc;

        const match = nameCol.match(/^(.*):(\d+)$/);
        if (!match) return acc;

        const address = match[1] === '*' ? '0.0.0.0' : match[1];
        const port = parseInt(match[2], 10);
        const protocol = line.includes('UDP') ? 'UDP' : 'TCP';

        const key = `${pid}-${port}`;
        if (portMap.has(key)) return acc;
        portMap.set(key, true);

        acc.push({ processName, pid, port, address, protocol });
        return acc;
      }, []);

      // Sort by port ascending
      ports.sort((a, b) => a.port - b.port);
      resolve(ports);
    });
  });
});

// ─── IPC: Kill Process ───────────────────────────────────────────────────────
ipcMain.handle('kill-process', async (event, pid) => {
  return new Promise((resolve) => {
    exec(`kill -9 ${pid}`, (err) => {
      if (err) {
        // Try with sudo if regular kill fails (system processes)
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

// ─── IPC: Get Process Info ───────────────────────────────────────────────────
ipcMain.handle('get-process-info', async (event, pid) => {
  return new Promise((resolve) => {
    exec(`ps -p ${pid} -o pid,ppid,user,pcpu,pmem,command`, (err, stdout) => {
      if (err) { resolve(null); return; }
      const lines = stdout.trim().split('\n');
      if (lines.length < 2) { resolve(null); return; }
      const parts = lines[1].trim().split(/\s+/);
      resolve({
        pid: parts[0],
        ppid: parts[1],
        user: parts[2],
        cpu: parts[3],
        mem: parts[4],
        command: parts.slice(5).join(' '),
      });
    });
  });
});

app.whenReady().then(() => {
  createWindow();

  // Register Global Shortcut: Cmd + Shift + P
  const ret = globalShortcut.register('CommandOrControl+Shift+P', () => {
    toggleWindow();
  });

  if (!ret) {
    console.log('Registration failed');
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

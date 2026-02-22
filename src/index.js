const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fse = require('fs-extra');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 740,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools (remove in production)
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ────────────────────────────────────────────────
// IPC Handlers
// ────────────────────────────────────────────────

ipcMain.handle('dialog:select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Modpack Folder',
  });

  if (result.canceled) return null;
  return result.filePaths[0] || null;
});

ipcMain.handle('transfer:configs', async (event, payload) => {
  const { oldPath, newPath, options } = payload;

  if (!oldPath || !newPath) {
    return { success: false, message: 'Both folders must be selected.' };
  }

  const conflicts = [];

  // ─── Helper: Check if target exists ───────────────────────────────
  const checkConflict = (targetPath) => {
    if (fs.existsSync(targetPath)) {
      conflicts.push(targetPath);
    }
  };

  // ─── Collect potential conflicts ──────────────────────────────────
  try {
    // 1. Minecraft Configs → options.txt
    if (options.minecraftConfigs) {
      const src = path.join(oldPath, 'options.txt');
      const dest = path.join(newPath, 'options.txt');
      if (fs.existsSync(src)) checkConflict(dest);
    }

    // 2. Xaero's Configs → any file containing "xaero" in config/
    if (options.xaerosConfigs) {
      const configDir = path.join(oldPath, 'config');
      if (fs.existsSync(configDir)) {
        const files = fs.readdirSync(configDir);
        for (const file of files) {
          if (file.toLowerCase().includes('xaero')) {
            const src = path.join(configDir, file);
            const dest = path.join(newPath, 'config', file);
            checkConflict(dest);
          }
        }
      }
    }

    // 3. Xaero's World Map folder
    if (options.xaerosWorldMap) {
      const srcDir = path.join(oldPath, 'xaero', 'minimap', 'Multiplayer_openstars.scrim.club');
      const destDir = path.join(newPath, 'xaero', 'minimap', 'Multiplayer_openstars.scrim.club');
      if (fs.existsSync(srcDir)) checkConflict(destDir);
    }

    // 4. Xaero's Mini-Map Waypoints folder
    if (options.xaerosMiniMapWaypoints) {
      const srcDir = path.join(oldPath, 'xaero', 'world-map', 'Multiplayer_openstars.scrim.club');
      const destDir = path.join(newPath, 'xaero', 'world-map', 'Multiplayer_openstars.scrim.club');
      if (fs.existsSync(srcDir)) checkConflict(destDir);
    }

    // 5. Create mod schematics folder
    if (options.createSchematics) {
      const srcDir = path.join(oldPath, 'schematics');
      const destDir = path.join(newPath, 'schematics');
      if (fs.existsSync(srcDir)) checkConflict(destDir);
    }

    // ─── Ask user about overwrite if needed ───────────────────────────
    let overwrite = false;

    if (conflicts.length > 0) {
      const message = [
        'The following items already exist in the target folder:',
        '',
        conflicts.map(p => `• ${path.relative(newPath, p) || p}`).join('\n'),
        '',
        'Overwrite them?'
      ].join('\n');

      const response = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Yes, overwrite', 'No, cancel'],
        defaultId: 1,
        cancelId: 1,
        title: 'Overwrite Existing Files?',
        message,
        detail: 'Existing files/folders will be replaced if you choose Yes.',
      });

      if (response.response !== 0) {
        return { success: false, message: 'Transfer cancelled by user.' };
      }
      overwrite = true;
    }

    // ─── Perform the actual transfers ─────────────────────────────────
    // Helper: safe recursive copy (merge style)
    const copyDirIfExists = async (src, dest, shouldOverwrite) => {
      if (!fs.existsSync(src)) return;
      
      if (shouldOverwrite && fs.existsSync(dest)) {
        await fse.remove(dest); // full replace
      }
      
      await fse.ensureDir(dest);
      await fse.copy(src, dest, {
        overwrite: shouldOverwrite,
        errorOnExist: false,
      });
    };

    if (options.minecraftConfigs) {
      const src = path.join(oldPath, 'options.txt');
      const dest = path.join(newPath, 'options.txt');
      if (fs.existsSync(src)) {
        await fse.ensureDir(path.dirname(dest));
        await fse.copy(src, dest, { overwrite });
      }
    }

    if (options.xaerosConfigs) {
      const srcDir = path.join(oldPath, 'config');
      if (fs.existsSync(srcDir)) {
        const files = fs.readdirSync(srcDir);
        await fse.ensureDir(path.join(newPath, 'config'));
        for (const file of files) {
          if (file.toLowerCase().includes('xaero')) {
            const src = path.join(srcDir, file);
            const dest = path.join(newPath, 'config', file);
            await fse.copy(src, dest, { overwrite });
          }
        }
      }
    }

    if (options.xaerosWorldMap) {
      await copyDirIfExists(
        path.join(oldPath, 'xaero', 'minimap', 'Multiplayer_openstars.scrim.club'),
        path.join(newPath, 'xaero', 'minimap', 'Multiplayer_openstars.scrim.club'),
        overwrite
      );
    }

    if (options.xaerosMiniMapWaypoints) {
      await copyDirIfExists(
        path.join(oldPath, 'xaero', 'world-map', 'Multiplayer_openstars.scrim.club'),
        path.join(newPath, 'xaero', 'world-map', 'Multiplayer_openstars.scrim.club'),
        overwrite
      );
    }

    if (options.createSchematics) {
      await copyDirIfExists(
        path.join(oldPath, 'schematics'),
        path.join(newPath, 'schematics'),
        overwrite
      );
    }

    return {
      success: true,
      message: 'Transfer completed successfully!'
    };

  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: `Error during transfer:\n${err.message}`
    };
  }
});
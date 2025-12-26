const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Get the correct base path (works in dev and packaged)
function getBasePath() {
    if (app.isPackaged) {
        return path.dirname(app.getPath('exe'));
    }
    return __dirname;
}

// Paths
const SOLUTION_FILE = 'codeforces_solution.py';
const SNIPPETS_FILE = 'snippets.json';
const DEFAULT_SNIPPETS_FILE = 'default-snippets.json';

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        backgroundColor: '#0d1117',
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
    
    // Open DevTools in development
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }
}

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

// Window controls
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});
ipcMain.on('window-close', () => mainWindow.close());

// File operations
ipcMain.handle('read-solution', async () => {
    const filePath = path.join(getBasePath(), SOLUTION_FILE);
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
        // Create default file if doesn't exist
        const defaultContent = `# Codeforces Solution
# Start coding here!

`;
        fs.writeFileSync(filePath, defaultContent);
        return defaultContent;
    } catch (error) {
        console.error('Error reading solution:', error);
        return '';
    }
});

ipcMain.handle('save-solution', async (event, content) => {
    const filePath = path.join(getBasePath(), SOLUTION_FILE);
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('Error saving solution:', error);
        return { success: false, error: error.message };
    }
});

// Snippets operations
ipcMain.handle('load-snippets', async () => {
    const snippetsPath = path.join(getBasePath(), SNIPPETS_FILE);
    const defaultPath = path.join(__dirname, DEFAULT_SNIPPETS_FILE);
    
    try {
        // Try to load user snippets
        if (fs.existsSync(snippetsPath)) {
            return JSON.parse(fs.readFileSync(snippetsPath, 'utf-8'));
        }
        
        // Fall back to default snippets
        if (fs.existsSync(defaultPath)) {
            const defaultSnippets = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
            // Save as user snippets
            fs.writeFileSync(snippetsPath, JSON.stringify(defaultSnippets, null, 2));
            return defaultSnippets;
        }
        
        return {};
    } catch (error) {
        console.error('Error loading snippets:', error);
        return {};
    }
});

ipcMain.handle('save-snippets', async (event, snippets) => {
    const filePath = path.join(getBasePath(), SNIPPETS_FILE);
    try {
        fs.writeFileSync(filePath, JSON.stringify(snippets, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('Error saving snippets:', error);
        return { success: false, error: error.message };
    }
});

// Python execution
let currentProcess = null;

ipcMain.handle('run-python', async (event, { code, input }) => {
    return new Promise((resolve) => {
        // Kill previous process if running
        if (currentProcess) {
            currentProcess.kill();
        }

        const tempFile = path.join(getBasePath(), '_temp_run.py');
        fs.writeFileSync(tempFile, code);

        let output = '';
        let error = '';
        const startTime = Date.now();

        currentProcess = spawn('python', [tempFile], {
            cwd: getBasePath()
        });

        // Send input if provided
        if (input) {
            currentProcess.stdin.write(input);
            currentProcess.stdin.end();
        }

        currentProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        currentProcess.stderr.on('data', (data) => {
            error += data.toString();
        });

        currentProcess.on('close', (code) => {
            const executionTime = Date.now() - startTime;
            // Clean up temp file
            try { fs.unlinkSync(tempFile); } catch (e) {}
            
            currentProcess = null;
            resolve({
                output: output.trim(),
                error: error.trim(),
                exitCode: code,
                executionTime
            });
        });

        currentProcess.on('error', (err) => {
            currentProcess = null;
            resolve({
                output: '',
                error: `Failed to run Python: ${err.message}`,
                exitCode: -1,
                executionTime: 0
            });
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            if (currentProcess) {
                currentProcess.kill();
                currentProcess = null;
                resolve({
                    output: output.trim(),
                    error: 'Time Limit Exceeded (10s)',
                    exitCode: -1,
                    executionTime: 10000
                });
            }
        }, 10000);
    });
});

ipcMain.on('stop-python', () => {
    if (currentProcess) {
        currentProcess.kill();
        currentProcess = null;
    }
});

// Get app info
ipcMain.handle('get-app-info', () => {
    return {
        version: app.getVersion(),
        basePath: getBasePath()
    };
});

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs-extra");
const os = require("os");

// Importar módulos
const { ROOT_FOLDER_ID } = require("./config/app-config");
const { initGoogleDrive } = require("./services/drive-service");
const { setupFileHandlers } = require("./handlers/file-handlers");
const { listFolders, listFiles, initDrive } = require("./services/gdrive");
const { processDocument, cleanupTempFiles } = require("./services/html");

// Variável global para a janela principal
let mainWindow;

// Inicialização da aplicação
async function init() {
  try {
    // Inicializa o Google Drive
    try {
      await initDrive();
      console.log("Google Drive inicializado com sucesso");
    } catch (error) {
      console.warn(
        "Não foi possível inicializar o Google Drive:",
        error.message
      );
      // Não interrompe a execução do aplicativo se o Drive falhar
    }

    // Configura os handlers de arquivo
    setupFileHandlers(mainWindow);

    console.log("Aplicação inicializada com sucesso");
  } catch (error) {
    console.error("Erro na inicialização:", error);
    // Pode adicionar um dialog.showErrorBox aqui para informar o usuário
  }
}

// Criar a janela principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 1100,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Carregar página principal (agora é main.html)
  mainWindow.loadFile(path.join(__dirname, "main.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Inicializar componentes após criação da janela
  init().catch((err) => console.error("Erro na inicialização:", err));

  // HTML Processing handlers
  ipcMain.handle("processar-documento", async (event, fileContent) => {
    try {
      const result = await processDocument(fileContent);
      return result;
    } catch (error) {
      console.error("Erro ao processar documento:", error);
      return { error: error.message };
    }
  });

  ipcMain.handle("baixar-html-zip", async (event, zipPath, saveAs) => {
    try {
      // Usa o dialog para selecionar onde salvar o arquivo
      let savePath = saveAs;
      if (!saveAs) {
        const dialogResult = await dialog.showSaveDialog({
          title: "Salvar HTML gerado",
          defaultPath: path.join(app.getPath("downloads"), "aula.zip"),
          filters: [{ name: "Arquivos ZIP", extensions: ["zip"] }],
        });

        if (dialogResult.canceled) {
          return { success: false, canceled: true };
        }

        savePath = dialogResult.filePath;
      }

      // Copia o arquivo zip para o destino escolhido
      await fs.copyFile(zipPath, savePath);

      // Se chegou aqui, o download foi bem sucedido
      return {
        success: true,
        filePath: savePath,
      };
    } catch (error) {
      console.error("Erro ao baixar HTML:", error);
      return { error: error.message };
    }
  });

  ipcMain.handle("limpar-arquivos-temp", async (event, tempDir) => {
    try {
      await cleanupTempFiles(tempDir);
      return { success: true };
    } catch (error) {
      console.error("Erro ao limpar arquivos temporários:", error);
      return { error: error.message };
    }
  });

  ipcMain.handle("open-dev-tools", () => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.webContents.openDevTools();
    }
  });
}

// Configurar sistema de navegação
function setupNavigation() {
  ipcMain.on("navigate", (event, page) => {
    if (!mainWindow) return;

    switch (page) {
      case "home":
        mainWindow.loadFile(path.join(__dirname, "main.html"));
        break;
      case "fabrica":
        mainWindow.loadFile(path.join(__dirname, "src/pages/fabrica.html"));
        break;
      case "identidades-componentes":
        mainWindow.loadFile(
          path.join(__dirname, "src/pages/identidades-componentes.html")
        );
        break;
      case "criar-identidade":
        mainWindow.loadFile(
          path.join(__dirname, "src/pages/criar-identidade.html")
        );
        break;
      case "listar-identidades":
        mainWindow.loadFile(
          path.join(__dirname, "src/pages/listar-identidades.html")
        );
        break;
      case "explorador":
        mainWindow.loadFile(path.join(__dirname, "index.html"));
        break;
      default:
        console.error(`Página não reconhecida: ${page}`);
    }
  });
}

// Eventos do ciclo de vida do Electron
app.whenReady().then(() => {
  createWindow();
  setupNavigation();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Exportar a mainWindow para que outros módulos possam acessá-la
module.exports = { getMainWindow: () => mainWindow };

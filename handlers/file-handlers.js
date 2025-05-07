const { ipcMain } = require("electron");
const { ROOT_FOLDER_ID } = require("../config/app-config");
const {
  listFolders,
  listFiles,
  downloadFile,
  getFileContent,
} = require("../services/gdrive");

/**
 * Configura os handlers IPC relacionados a arquivos
 * @param {BrowserWindow} mainWindow - Janela principal do Electron (opcional)
 */
function setupFileHandlers(mainWindow = null) {
  /**
   * Listar pastas dentro de uma pasta específica (nova API)
   */
  ipcMain.handle("listar-pastas", async (event, parentFolderId = null) => {
    try {
      const folders = await listFolders(parentFolderId);
      return folders;
    } catch (error) {
      console.error("Erro ao listar pastas:", error.message);
      return [];
    }
  });

  /**
   * Listar arquivos dentro de uma pasta específica (nova API)
   */
  ipcMain.handle("listar-arquivos", async (event, folderId = null) => {
    try {
      const files = await listFiles(folderId);
      return files;
    } catch (error) {
      console.error("Erro ao listar arquivos:", error.message);
      return [];
    }
  });

  /**
   * Listar pastas dentro de uma pasta específica (API legada)
   */
  ipcMain.handle("get-folders", async (event, parentFolderId = null) => {
    try {
      const folders = await listFolders(parentFolderId);
      return folders;
    } catch (error) {
      console.error("Erro ao listar pastas (legacy):", error.message);
      return [];
    }
  });

  /**
   * Listar arquivos dentro de uma pasta específica (API legada)
   */
  ipcMain.handle("get-files", async (event, folderId = null) => {
    try {
      const files = await listFiles(folderId);
      return files;
    } catch (error) {
      console.error("Erro ao listar arquivos (legacy):", error.message);
      return [];
    }
  });

  /**
   * Obter conteúdo de arquivo do Google Drive
   */
  ipcMain.handle("get-file-content", async (event, fileId) => {
    console.log("Recebida solicitação para obter conteúdo do arquivo:", fileId);

    try {
      const result = await getFileContent(fileId);

      if (result.error) {
        console.error("Erro ao obter conteúdo:", result.error);
        return { error: result.error };
      }

      console.log("Arquivo obtido com sucesso:", result.name);
      console.log("Tipo MIME:", result.mimeType);
      //console.log("Tamanho do conteúdo (bytes):", result.content.length);

      return result;
    } catch (error) {
      console.error("Erro no handler get-file-content:", error);
      return { error: error.message };
    }
  });

  /**
   * Baixar arquivo do Google Drive
   */
  ipcMain.on("download-resource", async (event, fileId) => {
    try {
      const filePath = await downloadFile(fileId);
      event.sender.send("download-complete", { success: true, filePath });
    } catch (error) {
      console.error("Erro ao baixar arquivo:", error);
      event.sender.send("download-complete", {
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * Verifica status de processamento de um recurso
   */
  ipcMain.handle("get-resource-status", async (event, resourceId) => {
    try {
      return { status: "not_found" };
    } catch (error) {
      console.error("Erro ao verificar status do recurso:", error);
      return { error: error.message };
    }
  });

  console.log("Handlers de arquivo configurados com sucesso");
}

module.exports = {
  setupFileHandlers,
};

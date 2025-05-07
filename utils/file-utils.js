const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { shell, dialog } = require("electron");

/**
 * Garante que um diretório existe, criando-o se necessário
 * @param {string} dirPath - Caminho do diretório
 * @returns {boolean} - true se o diretório já existia ou foi criado com sucesso
 */
function ensureDirectoryExists(dirPath) {
  try {
    fs.ensureDirSync(dirPath);
    return true;
  } catch (error) {
    console.error(`Erro ao criar diretório ${dirPath}:`, error);
    return false;
  }
}

/**
 * Gera um nome de arquivo temporário para download
 * @param {string} fileId - ID do arquivo no Google Drive
 * @param {string} extension - Extensão do arquivo (padrão: .docx)
 * @returns {string} - Nome do arquivo sanitizado
 */
function generateTempFileName(fileId, extension = ".docx") {
  return `${fileId}_${Date.now()}${extension}`;
}

/**
 * Gera um caminho completo para um arquivo temporário
 * @param {string} fileName - Nome do arquivo
 * @param {string} baseDir - Diretório base (padrão: pasta de downloads)
 * @returns {string} - Caminho completo do arquivo
 */
function getTempFilePath(fileName, baseDir = null) {
  const downloadsPath =
    baseDir || path.join(os.homedir(), "Downloads", "ConstrutorDeAulas");
  ensureDirectoryExists(downloadsPath);
  return path.join(downloadsPath, fileName);
}

/**
 * Baixa um recurso para o computador do usuário ou abre no navegador
 * @param {string} resourceUrl - URL ou caminho do recurso
 * @returns {Promise<boolean>} - true se o download foi bem-sucedido
 */
async function downloadResource(resourceUrl) {
  try {
    if (!resourceUrl) {
      throw new Error("URL do recurso não fornecida");
    }

    // Se for um caminho de arquivo local
    if (resourceUrl.startsWith("/") || resourceUrl.includes(":\\")) {
      // Verificar se o arquivo existe
      if (fs.existsSync(resourceUrl)) {
        // Abrir diálogo para selecionar destino
        const saveDialogResult = await dialog.showSaveDialog({
          defaultPath: path.basename(resourceUrl),
        });

        if (!saveDialogResult.canceled && saveDialogResult.filePath) {
          // Copiar o arquivo para o destino escolhido
          await fs.copy(resourceUrl, saveDialogResult.filePath);
          shell.showItemInFolder(saveDialogResult.filePath);
          return true;
        }
      } else {
        throw new Error("Arquivo não encontrado: " + resourceUrl);
      }
    }
    // Se for uma URL HTTP
    else if (resourceUrl.startsWith("http")) {
      // Abrir no navegador padrão
      shell.openExternal(resourceUrl);
      return true;
    } else {
      throw new Error("Formato de recurso não suportado");
    }

    return false;
  } catch (error) {
    console.error("Erro ao baixar recurso:", error);
    throw error;
  }
}

module.exports = {
  ensureDirectoryExists,
  generateTempFileName,
  getTempFilePath,
  downloadResource,
};

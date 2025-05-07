// services/html/index.js

const { processarAula, createZipFromHTMLs } = require("./processor-service");  // atualizado para usar títulos do parser
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

/**
 * Processa um documento e gera os HTMLs correspondentes
 * @param {string} fileContent - Conteúdo do arquivo a ser processado
 * @returns {Promise<Object>} - Resultado do processamento, incluindo caminhos para download
 */
async function processDocument(fileContent) {
  try {
    // Agora processarAula retorna { htmls, titles } ou { error }
     const { htmls, titles } = processarAula(fileContent);
     if (!Array.isArray(htmls) || htmls.length === 0) {
       return { success: false, error: 'Nenhum HTML gerado pelo parser.' };
     }

    // Diretório temporário para os HTMLs gerados
    const tempDir = path.join(os.tmpdir(), `html-gen-${Date.now()}`);
    await fs.ensureDir(tempDir);

    // Salvar cada HTML em disco
    const htmlPaths = await Promise.all(
      htmls.map(async (html, index) => {
        const fileName = `topico_${index + 1}.html`;
        const fullPath = path.join(tempDir, fileName);
        await fs.writeFile(fullPath, html, "utf8");
        return fullPath;
      })
    );

    // Gerar ZIP contendo todos os HTMLs
    const zipPath = await createZipFromHTMLs(htmls, titles, tempDir);

    return {
      success: true,
      htmls,
      htmlPaths,
      zipPath,
      tempDir,
    };
  } catch (err) {
    console.error("Erro ao processar documento:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Processa um documento vindo do Google Drive e acrescenta fileId ao resultado
 * @param {string} fileId
 * @param {string} fileContent
 */
async function processDriveDocument(fileId, fileContent) {
  try {
    const result = await processDocument(fileContent);
    if (!result.success) {
      return result;
    }
    return { ...result, fileId };
  } catch (err) {
    console.error("Erro ao processar documento do Drive:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Remove arquivos temporários gerados pelo processamento
 * @param {string} tempDir
 */
async function cleanupTempFiles(tempDir) {
  try {
    if (tempDir && (await fs.pathExists(tempDir))) {
      await fs.remove(tempDir);
      console.log(`Diretório temporário removido: ${tempDir}`);
    }
  } catch (err) {
    console.error("Erro ao limpar arquivos temporários:", err);
  }
}

module.exports = {
  processDocument,
  processDriveDocument,
  cleanupTempFiles,
};

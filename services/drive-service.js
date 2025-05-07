const { google } = require("googleapis");
const fs = require("fs-extra");
const path = require("path");

// Variável para o objeto do Drive (acessível apenas dentro deste módulo)
let drive;

/**
 * Inicializa a autenticação com o Google Drive via Service Account
 */
async function initGoogleDrive() {
  try {
    const credentialsPath = path.join(__dirname, "..", "service-account.json");
    const credentials = fs.readJSONSync(credentialsPath);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    drive = google.drive({ version: "v3", auth });
    console.log("Google Drive autenticado com Service Account");
    return true;
  } catch (error) {
    console.error("Erro ao inicializar Google Drive:", error.message);
    throw error;
  }
}

/**
 * Lista todas as pastas dentro de uma pasta específica
 * @param {string} parentFolderId - ID da pasta pai
 * @param {string} defaultFolderId - ID da pasta padrão se nenhuma for especificada
 * @returns {Promise<Array>} - Lista de pastas
 */
async function listFolders(
  parentFolderId = null,
  defaultFolderId = "11ihE_KnUKKCVBIaX7UhDzH8py36HsS3F"
) {
  try {
    if (!drive) throw new Error("Drive não inicializado.");

    // Se não for especificado um ID de pasta pai, usar a pasta raiz
    const folderId = parentFolderId || defaultFolderId;

    console.log(`Listando pastas dentro de ${folderId}`);

    // Query para buscar apenas pastas
    const query = `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder'`;

    const res = await drive.files.list({
      q: query,
      fields: "files(id, name)",
      orderBy: "name",
    });

    const folders = res.data.files || [];
    console.log(`Pastas encontradas em ${folderId}:`, folders);

    return folders;
  } catch (error) {
    console.error("Erro ao listar pastas:", error.message);
    return [];
  }
}

/**
 * Lista todos os arquivos .docx e Documentos Google dentro de uma pasta específica
 * @param {string} folderId - ID da pasta
 * @param {string} defaultFolderId - ID da pasta padrão se nenhuma for especificada
 * @returns {Promise<Array>} - Lista de arquivos
 */
async function listFiles(
  folderId = null,
  defaultFolderId = "11ihE_KnUKKCVBIaX7UhDzH8py36HsS3F"
) {
  try {
    if (!drive) throw new Error("Drive não inicializado.");

    // Se não for especificado um ID de pasta, usar a pasta raiz
    const targetFolderId = folderId || defaultFolderId;

    // Query para filtrar tanto arquivos .docx quanto Documentos Google
    const query = `'${targetFolderId}' in parents and (mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='application/vnd.google-apps.document')`;

    console.log("Executando query:", query);

    const res = await drive.files.list({
      q: query,
      fields: "files(id, name, mimeType)",
      orderBy: "name",
    });

    const files = res.data.files || [];
    console.log(`Arquivos encontrados em ${targetFolderId}:`, files);
    return files;
  } catch (error) {
    console.error("Erro ao listar arquivos:", error.message);
    return [];
  }
}

/**
 * Baixa um arquivo do Google Drive
 * @param {string} fileId - ID do arquivo
 * @param {string} destination - Caminho de destino
 * @returns {Promise<Object>} - Informações sobre o download
 */
async function downloadFile(fileId, destination) {
  try {
    if (!drive) throw new Error("Drive não inicializado.");

    // Primeiro, obter os metadados do arquivo para verificar seu tipo MIME
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: "mimeType,name",
    });

    const fileMimeType = fileMetadata.data.mimeType;
    console.log(`Tipo MIME do arquivo: ${fileMimeType}`);

    let docxBuffer;

    // Se for um Documento Google, exportá-lo como DOCX
    if (fileMimeType === "application/vnd.google-apps.document") {
      console.log("Arquivo é um Documento Google. Exportando como DOCX...");

      const response = await drive.files.export(
        {
          fileId: fileId,
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        {
          responseType: "arraybuffer",
        }
      );

      docxBuffer = Buffer.from(response.data);
    }
    // Se for um arquivo .docx normal, baixá-lo diretamente
    else if (
      fileMimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      console.log("Arquivo é um DOCX normal. Baixando diretamente...");

      const response = await drive.files.get(
        {
          fileId: fileId,
          alt: "media",
        },
        {
          responseType: "arraybuffer",
        }
      );

      docxBuffer = Buffer.from(response.data);
    }
    // Se for outro tipo, lançar um erro
    else {
      throw new Error(
        `Tipo de arquivo não suportado: ${fileMimeType}. Apenas documentos Word (.docx) e Documentos Google são suportados.`
      );
    }

    // Salvar o buffer no arquivo local
    fs.writeFileSync(destination, docxBuffer);
    console.log("Download concluído com sucesso:", destination);

    // Verificar se o arquivo existe e tem tamanho maior que zero
    const stats = fs.statSync(destination);
    if (stats.size === 0) {
      throw new Error("Arquivo baixado está vazio");
    }

    console.log(`Arquivo baixado com sucesso: ${stats.size} bytes`);

    return {
      success: true,
      filePath: destination,
      fileSize: stats.size,
      mimeType: fileMimeType,
    };
  } catch (error) {
    console.error("Erro durante o download do arquivo:", error);
    throw error;
  }
}

module.exports = {
  initGoogleDrive,
  listFolders,
  listFiles,
  downloadFile,
};

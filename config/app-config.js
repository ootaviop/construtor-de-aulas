/**
 * Configurações da aplicação
 */

// ID da pasta raiz no Google Drive
const ROOT_FOLDER_ID = "11ihE_KnUKKCVBIaX7UhDzH8py36HsS3F";

// Tipos MIME suportados
const SUPPORTED_MIME_TYPES = {
  GOOGLE_DOC: "application/vnd.google-apps.document",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  FOLDER: "application/vnd.google-apps.folder",
};

module.exports = {
  ROOT_FOLDER_ID,
  SUPPORTED_MIME_TYPES,
};

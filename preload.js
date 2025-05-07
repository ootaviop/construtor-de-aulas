const { contextBridge, ipcRenderer } = require("electron");

// Expor API para a camada de renderização
contextBridge.exposeInMainWorld("electronAPI", {
  // Navegação entre páginas
  navigate: (page) => ipcRenderer.send("navigate", page),

  // Manter APIs existentes do sistema explorador
  listFiles: (folderId) => ipcRenderer.invoke("get-files", folderId),
  listFolders: (parentFolderId) =>
    ipcRenderer.invoke("get-folders", parentFolderId),
  downloadFile: (fileId) => ipcRenderer.send("download-resource", fileId),

  // Google Drive API
  listarPastas: (folderId) => ipcRenderer.invoke("listar-pastas", folderId),
  listarArquivos: (folderId) => ipcRenderer.invoke("listar-arquivos", folderId),
  getFileContent: (fileId) => ipcRenderer.invoke("get-file-content", fileId),
  getResourceStatus: (resourceId) =>
    ipcRenderer.invoke("get-resource-status", resourceId),

  // HTML Processing API
  processarDocumento: (fileContent) =>
    ipcRenderer.invoke("processar-documento", fileContent),
  baixarHTMLZip: (zipPath, saveAs) =>
    ipcRenderer.invoke("baixar-html-zip", zipPath, saveAs),
  limparArquivosTemp: (tempDir) =>
    ipcRenderer.invoke("limpar-arquivos-temp", tempDir),

  // New method
  openDevTools: () => ipcRenderer.invoke("open-dev-tools"),
});

// Repassar eventos do main process para o renderer
ipcRenderer.on("download-complete", (event, data) => {
  document.dispatchEvent(
    new CustomEvent("download-complete", { detail: data })
  );
});

ipcRenderer.on("download-error", (event, data) => {
  document.dispatchEvent(new CustomEvent("download-error", { detail: data }));
});

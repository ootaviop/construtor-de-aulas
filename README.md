# Construtor de Aulas

Aplicativo desktop desenvolvido com Electron para integração com o Google Drive, permitindo a visualização e gerenciamento de documentos.

## Funcionalidades

- Autenticação com Google Drive via Service Account
- Listagem de arquivos e pastas
- Download de documentos
- Interface moderna e responsiva

## Requisitos

- Node.js 14 ou superior
- NPM 6 ou superior
- Conta Google com acesso ao Drive API

## Instalação

1. Clone o repositório:

```bash
git clone https://github.com/otavioperes/construtor-de-aulas.git
cd construtor-de-aulas
```

2. Instale as dependências:

```bash
npm install
```

3. Configure as credenciais do Google Drive:

   - Crie um projeto no Google Cloud Console
   - Ative a API do Google Drive
   - Crie uma Service Account
   - Baixe o arquivo de credenciais e renomeie para `service-account.json`
   - Coloque o arquivo na raiz do projeto

4. Inicie a aplicação:

```bash
npm start
```

## Estrutura do Projeto

```
├── config/             # Arquivos de configuração
├── handlers/           # Handlers IPC do Electron
├── services/          # Serviços da aplicação
├── utils/             # Utilitários
├── main.js            # Processo principal do Electron
├── index.html         # Interface do usuário
└── style.css          # Estilos da aplicação
```

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

// services/html/template-manager.js

/**
 * Escapa texto para uso seguro em HTML.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escapa URI para uso em atributos data-link.
 */
function escapeUri(uri) {
  return encodeURI(uri);
}

/**
 * Gera ID aleatório alfanumérico de 4 dígitos.
 */
function randomId(len = 4) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < len; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
+  * renderNodes
+  * -----------
+  * Recebe um array de nós AST e, para cada um, invoca o renderer
+  * específico se existir, ou usa fallback para parágrafos e listas.
+  */
function renderNodes(nodes) {
  // 1) Se for string simples, devolve direto
  if (typeof nodes === "string") {
    return nodes;
  }

  // 2) Se não for um array, nada a renderizar
  if (!Array.isArray(nodes)) {
    return "";
  }

  // 3) Agora sim, itere com segurança
  return nodes
    .map((item) => {
      // componente customizado ou oficial
      if (registry.renderers[item.name]) {
        return registry.render(item.name, item);
      }

      // fallback genérico para parágrafos
      if (item.name === "paragrafo") {
        return `<p>${item.content}</p>`;
      }

      // fallback genérico para listas
      if (item.name === "lista") {
        const tag = item.type === "numerada" ? "ol" : "ul";
        const lis = item.content.map((li) => `<li>${li.content}</li>`).join("");
        return `<${tag} class="lista-check">${lis}</${tag}>`;
      }

      // fallback genérico para outras coisas
      const inner = item.content ? renderNodes(item.content) : "";
      return `
        <div class="desconhecida">
          <h1>{{${item.name}}}</h1>
          ${inner}
        </div>`;
    })
    .join("");
}

/**
 * Registry de renderers.
 */
const registry = {
  renderers: {},

  register(key, fn) {
    this.renderers[key] = fn;
  },

  get(key) {
    const fn = this.renderers[key];
    if (!fn) throw new Error(`Renderer não encontrado para key '${key}'`);
    return fn;
  },

  render(key, node) {
    return this.get(key)(node);
  },
};

// ── HEAD ─────────────────────────────────────────────────────────────────────
registry.register(
  "head",
  () => `<!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><!--PAGE_TITLE--></title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css" crossorigin="anonymous">
    <link href="https://use.typekit.net/bbo1gxr.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous">
    <link href="https://recursos-moodle.caeddigital.net/projetos/2024/municipios/css/municipios-2024.css" rel="stylesheet">
  </head>
  <body>`
);

// ── CABEÇALHO ────────────────────────────────────────────────────────────────
registry.register("secao:cabecalho", (node) => {
  const topico = escapeHtml(node.titulo_topico);
  const aula = escapeHtml(node.titulo_aula);
  return `
    <div class="container c-aula-container curso secao1">
      <div class="row">
        <div class="col">
          <div class="separador-menor"></div>
          <div class="d-center">
            <img class="img-topo-aula"
              src="https://recursos-moodle.caeddigital.net/projetos/2024/caed/selo-aplicador/img/topo.svg"
              alt="Logo Topo">
          </div>
          <div class="separador-menor"></div>
          <div class="titulo-topico-box"><h5>${topico}</h5></div>
          <div class="separador-menor"></div>
          <div class="row row-topo-titulo">
            <div class="col-sm-12 col-md-10 col-lg-8 col-xl-8">
              <h1>${aula}</h1>
              <div class="separador-medio"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
});

// ── VÍDEO ────────────────────────────────────────────────────────────────────
registry.register("video", (node) => {
  const bodyHtml = renderNodes(node.content);
  return `
      <div class="embed-responsive embed-responsive-16by9" style="border: 2px solid var(--cor-primaria);">
        <div></div>
      </div>
        `;
});

// ── REFERÊNCIAS ────────────────────────────────────────────────────────────────────
registry.register("referencias", (node) => {
  const bodyHtml = renderNodes(node.content);
  return `
    <div class="d-center referencias" style="flex-direction: column;margin-top: 2rem;">
    <span class="dica-navegacao">Dica de navegação</span>
      <div class="btn-referencias" data-toggle="modal" data-target="#referencias">
        <i class="far fa-file" style="font-size: 2rem;"></i><span>Referências</span>
      </div>
    </div>
      <div class="modal fade" role="dialog" tabindex="-1" id="referencias">
    <div class="modal-dialog modal-lg" role="document">
      <div class="modal-content">
        <div class="modal-header c-aula-container curso">
          <h4 class="modal-title">Referências</h4>
          <button class="close" type="button" aria-label="Close" data-dismiss="modal">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div class="modal-body c-aula-container curso secao1">
          ${bodyHtml}
        </div>
        <div class="modal-footer c-aula-container curso">
          <button class="btn btn-light" type="button" data-dismiss="modal">Fechar</button>
        </div>
      </div>
    </div>
  </div>
      `;
});

// ── MODAL ────────────────────────────────────────────────────────────────────
registry.register("modal", (node) => {
  const id = `modal-${randomId()}`;
  const bodyHtml = renderNodes(node.content);
  return `
  <div class="modal fade" role="dialog" tabindex="-1" id="${id}">
    <div class="modal-dialog modal-lg" role="document">
      <div class="modal-content">
        <div class="modal-header c-aula-container curso">
          <h4 class="modal-title">${id}</h4>
          <button class="close" type="button" aria-label="Close" data-dismiss="modal">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div class="modal-body c-aula-container curso secao1">
          ${bodyHtml}
        </div>
        <div class="modal-footer c-aula-container curso">
          <button class="btn btn-light" type="button" data-dismiss="modal">Fechar</button>
        </div>
      </div>
    </div>
  </div>`;
});

// ── DESTAQUE ────────────────────────────────────────────────────────────────────
registry.register("destaque", (node) => {
  const bodyHtml = renderNodes(node.content);
  return `
                    <div class="destaque-atencao">
                <div class="cabecalho">
                    <div class="container-imagem"><svg width="57" height="57" viewBox="0 0 57 57" fill="none"
                            xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M27.1642 9.4601C27.7211 8.36999 29.2789 8.36999 29.8358 9.46011L39.8047 28.9738L50.0682 49.0639C50.578 50.062 49.8531 51.2463 48.7324 51.2463H8.26761C7.14686 51.2463 6.42195 50.062 6.93183 49.0639L27.1642 9.4601Z"
                                stroke="var(--cor-primaria)" stroke-linejoin="round"></path>
                            <path
                                d="M29.5 45.7463C31.433 45.7463 33 44.1793 33 42.2463C33 40.3133 31.433 38.7463 29.5 38.7463C27.567 38.7463 26 40.3133 26 42.2463C26 44.1793 27.567 45.7463 29.5 45.7463Z"
                                fill="var(--cor-secundaria)"></path>
                            <path
                                d="M31.5 40.7463C31.5 42.6793 29.933 44.2463 28 44.2463C26.067 44.2463 24.5 42.6793 24.5 40.7463C24.5 38.8133 26.067 37.2463 28 37.2463C29.933 37.2463 31.5 38.8133 31.5 40.7463Z"
                                stroke="var(--cor-primaria)" stroke-linejoin="round"></path>
                            <path d="M28 34.7463L28 21.7463" stroke="var(--cor-primaria)" stroke-linejoin="round">
                            </path>
                            <path d="M28 34.7463L28 21.7463" stroke="var(--cor-primaria)" stroke-opacity="0.2"
                                stroke-linejoin="round"></path>
                            <path d="M10 48.7463H47.3737" stroke="var(--cor-primaria)" stroke-linecap="round"
                                stroke-linejoin="round"></path>
                            <path d="M27 14.7463L13 42.7463" stroke="var(--cor-primaria)" stroke-linecap="round"
                                stroke-linejoin="round"></path>
                            <path d="M35 24.1936L44 42.7463" stroke="var(--cor-primaria)" stroke-linecap="round"
                                stroke-linejoin="round"></path>
                        </svg></div>
                    <h4 style="margin-left: .5rem;">Atenção</h4>
                </div>
                <div class="corpo">
                ${bodyHtml}    
                </div>
            </div>
    `;
});

// ── CITACAO ────────────────────────────────────────────────────────────────────
registry.register("citacao", (node) => {
  // 1) percorre apenas os filhos de 'citacao'
  const bodyHtml = node.content
    .map((item) => {
      // parágrafos recebem a classe extra
      if (item.name === "paragrafo") {
        return `<p class="p-citacao">${item.content}</p>`;
      }
      // quaisquer outros nós (listas, modais, carrossel etc.)
      // são renderizados com o renderer padrão
      return renderNodes([item]);
    })
    .join("");
  return `
            <div>
                <div class="citacao-texto">
                    ${bodyHtml}   
                </div>
            </div>
    `;
});

// ── CARROSSEL ────────────────────────────────────────────────────────────────
registry.register("carrossel", (node) => {
  const id = `carousel-${randomId()}`;

  // Para cada slide, renderiza recursivamente se for AST, ou usa string pura
  const items = node.slides
    .map((slide, i) => {
      let contentHtml = "";
      // 1) string pura
      if (typeof slide === "string") {
        contentHtml = slide;
      }
      // 2) AST como array de nós
      else if (Array.isArray(slide)) {
        contentHtml = renderNodes(slide);
      }
      // 3) objeto com conteúdo aninhado (somente se content for array)
      else if (slide.content && Array.isArray(slide.content)) {
        contentHtml = renderNodes(slide.content);
      }
      // 4) conteúdo simples como string (fallback)
      else if (slide.content) {
        contentHtml = slide.content;
      }

      return `
      <div class="carousel-item${i === 0 ? " active" : ""}">
        <div class="content">
          <div class="d-center area-util">
            <p>${contentHtml}</p>
          </div>
        </div>
      </div>`;
    })
    .join("");

  const indicators = node.slides
    .map(
      (_, i) => `
      <li data-target="#${id}" data-slide-to="${i}"${
        i === 0 ? ' class="active"' : ""
      }></li>`
    )
    .join("");

  return `
    <div><p class="dica-navegacao">Use as setas para navegar</p></div>
    <div>
      <div class="carousel slide" data-ride="carousel" data-interval="false" id="${id}">
        <div class="carousel-inner">
          ${items}
        </div>
        <div>
          <a class="carousel-control-prev" href="#${id}" role="button" data-slide="prev">
            <span class="carousel-control-prev-icon"></span><span class="sr-only">Previous</span>
          </a>
          <a class="carousel-control-next" href="#${id}" role="button" data-slide="next">
            <span class="carousel-control-next-icon"></span><span class="sr-only">Next</span>
          </a>
        </div>
        <ol class="carousel-indicators">
          ${indicators}
        </ol>
      </div>
    </div>`;
});

// ── CORPO (recursivo) ─────────────────────────────────────────────────────────
registry.register("secao:corpo", ({ content, index }) => {
  // renderiza qualquer nó aninhado em content
  const innerHtml = renderNodes(content);
  return `
   <div class="container c-aula-container curso secao1">
       <div class="row row-txt">
         <div class="col-sm-12 col-md-10 col-lg-8 col-xl-8">
         ${innerHtml}
         </div>
       </div>
       <div class="separador-medio"></div>
   </div>`;
});

// ── RODAPÉ ───────────────────────────────────────────────────────────────────
registry.register("secao:rodape", (node) => {
  return `
    <div class="container c-aula-container curso secao1"> <!-- Navegação Footer -->
      <div class="row">
        <div class="col">
          <div style="display: flex;gap: 30px;justify-content: space-between;">
            ${
              node.anterior
                ? `
            <div class="topico-anterior">
              <span data-link="${escapeUri(
                node.anterior
              )}">Tópico Anterior</span>
              <svg width="20" height="20" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.028 0.97199C6.833 0.97199 1.00031 6.80468 1.00031 13.9997C1.00031 21.1947 6.833 27.0273 14.028 27.0273C21.223 27.0273 27.0557 21.1947 27.0557 13.9997C27.0557 6.80468 21.223 0.971989 14.028 0.97199Z" stroke="var(--cor-primaria)" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M14.0283 8.7888L8.81725 13.9999L14.0283 19.2109" stroke="var(--cor-primaria)" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M19.2393 13.9995L8.81712 13.9995" stroke="var(--cor-primaria)" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </div>`
                : ""
            }
            ${
              node.proximo
                ? `
            <div class="proximo-topico">
              <span data-link="${escapeUri(node.proximo)}">Próximo Tópico</span>
              <svg width="20" height="20" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.0277 27.0275C21.2227 27.0275 27.0554 21.1948 27.0554 13.9998C27.0554 6.80486 21.2227 0.972168 14.0277 0.972168C6.83269 0.972168 1 6.80486 1 13.9998C1 21.1948 6.83269 27.0275 14.0277 27.0275Z" stroke="var(--cor-primaria)" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M14.0273 19.2107L19.2384 13.9996L14.0273 8.78857" stroke="var(--cor-primaria)" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M8.81641 14H19.2385" stroke="var(--cor-primaria)" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </div>`
                : ""
            }
          </div>
          <div class="separador-medio"></div>
        </div>
      </div>
    </div>`;
});

// ── SCRIPTS ───────────────────────────────────────────────────────────────────
registry.register(
  "scripts",
  () => `
    <script src="https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.slim.min.js" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.min.js" crossorigin="anonymous"></script>
    <script src="https://recursos-moodle.caeddigital.net/projetos/2024/municipios/js/municipios.js"></script>
    <script src="https://w.soundcloud.com/player/api.js" async></script>
  </body>
  </html>`
);

/**
 * Orquestra a montagem completa da página.
 */
function renderTopic(node) {
  // Head + título
  const header = node["1"];
  const pageTitle = `${header.titulo_topico} - ${header.titulo_aula}`;
  let html = registry
    .render("head")
    .replace("<!--PAGE_TITLE-->", escapeHtml(pageTitle));

  // Seções: cabeçalho, corpo, rodapé
  const keys = Object.keys(node).sort((a, b) => Number(a) - Number(b));
  keys.forEach((k, idx) => {
    const sec = node[k];
    if (idx === 0) {
      html += registry.render("secao:cabecalho", sec);
    } else if (idx === keys.length - 1) {
      html += registry.render("secao:rodape", sec);
    } else {
      html += registry.render("secao:corpo", {
        content: sec.content,
        index: idx + 1,
      });
    }
  });

  // Scripts finais
  html += registry.render("scripts");
  return html;
}

module.exports = {
  register: registry.register.bind(registry),
  renderTopic,
};

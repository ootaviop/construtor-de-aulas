// services/html/template-manager.js

/**
 * escapeHtml(str)
 * ----------------
 * Recebe um valor qualquer (string, número, objeto etc.) e devolve uma string
 * segura para inserção em HTML, substituindo caracteres especiais pelas suas
 * entidades correspondentes, prevenindo injeção de código (XSS) e garantindo
 * que o texto seja exibido literalmente no navegador.
 *
 * Exemplo:
 *   escapeHtml('<Teste & "seguro">')
 *   => '&lt;Teste &amp; &quot;seguro&quot;&gt;'
 */
function escapeHtml(str) {
  // 1) Converte qualquer valor em string (garante que número ou objeto não quebre)
  return (
    String(str)
      // 2) Substitui '&' antes de tudo, para não escapar entidades já criadas
      .replace(/&/g, "&amp;")
      // 3) Substitui '<' para impedir abertura de tags HTML
      .replace(/</g, "&lt;")
      // 4) Substitui '>' para impedir fechamento de tags HTML
      .replace(/>/g, "&gt;")
      // 5) Substitui '"' para uso seguro dentro de atributos entre aspas duplas
      .replace(/"/g, "&quot;")
      // 6) Substitui '\'' para uso seguro dentro de atributos entre aspas simples
      .replace(/'/g, "&#39;")
  );
}

/**
 * escapeUri(uri)
 * ---------------
 * Recebe uma string que representa uma URI ou caminho de recurso (por exemplo,
 * um valor de link de navegação) e a transforma numa forma “segura” para uso
 * em atributos HTML ou redirecionamentos, escapando caracteres reservados
 * segundo as regras de URI. Isso evita que espaços, acentos ou símbolos
 * especiais quebrem o link ou causem comportamento inesperado.
 *
 * Exemplo:
 *   escapeUri('/pasta com espaços/minha página.html?x=1&y=2')
 *   => '/pasta%20com%20espa%C3%A7os/minha%20p%C3%A1gina.html?x=1&y=2'
 *
 * Passos internos:
 *  1. Trata qualquer valor não-string como string: String(uri)
 *  2. Usa encodeURI() para escapar automaticamente:
 *     - espaços (' ') → '%20'
 *     - acentos e caracteres Unicode → suas formas percent-encoded
 *     - preserva caracteres que são válidos em URIs (/:?&=#)
 *  3. Retorna a URI escapada, pronta para uso em href, src ou redirecionamentos.
 */
function escapeUri(uri) {
  // 1) Garante que o valor seja tratado como string
  const str = String(uri);
  // 2) Usa o encoder padrão de URIs do JavaScript
  return encodeURI(str);
}

/**
 * randomId(len = 4)
 * -----------------
 * Gera um identificador aleatório composto por caracteres alfanuméricos,
 * útil para atribuir IDs únicos a componentes (como modais ou carrosséis)
 * sem colisão imediata.
 *
 * Parâmetros:
 *   len (number) – número de caracteres desejados no ID; padrão = 4.
 *
 * Retorno:
 *   Uma string de comprimento `len`, formada por letras maiúsculas,
 *   minúsculas e dígitos.
 *
 * Exemplo de uso:
 *   const id1 = randomId();      // p. ex. 'A1b2'
 *   const id2 = randomId(6);     // p. ex. 'xY3Zd9'
 *
 * Passos internos:
 *  1. Define um alfabeto de caracteres válidos (`chars`).
 *  2. Inicializa `id` como string vazia.
 *  3. Em um loop de 0 até len-1:
 *     a) Gera um índice aleatório entre 0 e chars.length-1.
 *     b) Concatena o caractere correspondente em `id`.
 *  4. Retorna a string preenchida.
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
 * renderNodes(nodes)
 * ------------------
 * Recebe um valor (string ou array de nós AST) e produz a string HTML
 * correspondente, invocando renderers registrados ou aplicando fallbacks
 * para parágrafos, listas e tags desconhecidas.
 *
 * Parâmetros:
 *   nodes – pode ser:
 *     • string: HTML puro, retornado sem alterações
 *     • array: lista de objetos AST, onde cada objeto tem:
 *         - name (string): identifica o tipo de nó/componente
 *         - content (string|array): conteúdo ou filhos aninhados
 *         - type (opcional, string): usado para listas ('numerada' vs 'nao-numerada')
 *         - slides (opcional, array): usado para carrossel
 *
 * Retorna:
 *   Uma única string contendo o HTML concatenado de todos os nós.
 *
 * Fluxo de execução:
 *  1) Se nodes for string simples, devolve diretamente (sem alteração).
 *  2) Se nodes não for um array, retorna string vazia (nada a renderizar).
 *  3) Se nodes for array, itera sobre cada item:
 *     a) Se existir um renderer customizado para item.name em registry.renderers,
 *        chama registry.render(item.name, item) e retorna o HTML gerado por esse renderer.
 *     b) Caso contrário, aplica fallbacks:
 *        - 'paragrafo':  `<p>${item.content}</p>`
 *        - 'lista': escolhe 'ol' ou 'ul' conforme item.type,
 *                   mapeia cada li em `<li>${li.content}</li>`,
 *                   e envolve tudo em `<${tag} class="lista-check">…</${tag}>`.
 *     c) Se item.name não for nem 'paragrafo' nem 'lista':
 *        - chame renderNodes(item.content) recursivamente para construir inner
 *        - retorne:
 *          ```
 *          <div class="desconhecida">
 *            <h1>{{${item.name}}}</h1>
 *            ${inner}
 *          </div>
 *          ```
 *  4) Finalmente, concatena (`.join('')`) todos os fragmentos HTML num único string.
 *
 * Exemplo ilustrativo:
 *    AST de exemplo contendo parágrafo, lista e nó desconhecido 'foo'
 *   const ast = [
 *     { name: 'paragrafo', content: '<strong>Olá</strong>' },
 *     {
 *       name: 'lista',
 *       type: 'numerada',
 *       content: [
 *         { name: 'item', content: 'Primeiro item' },
 *         { name: 'item', content: 'Segundo item' }
 *       ]
 *     },
 *     {
 *       name: 'foo',
 *       content: [
 *         { name: 'paragrafo', content: 'Dentro de foo' }
 *       ]
 *     }
 *   ];
 *   const html = renderNodes(ast);
 *    html resultante:
 *    "<p><strong>Olá</strong></p>" +
 *    "<ol class=\"lista-check\"><li>Primeiro item</li><li>Segundo item</li></ol>" +
 *    "<div class=\"desconhecida\"><h1>{{foo}}</h1><p>Dentro de foo</p></div>"
 */
function renderNodes(nodes) {
  // 1) Se recebemos uma string pura, devolvemos sem modificação:
  //    Isso permite, por exemplo, que alguns renderers retornem HTML já pronto
  //    e o renderNodes apenas o passe adiante.
  if (typeof nodes === "string") {
    return nodes;
  }

  // 2) Se não for um array (ex: undefined, null, objeto simples), retornamos nada:
  //    Garante que não tentaremos fazer .map em algo inválido, evitando erros.
  if (!Array.isArray(nodes)) {
    return "";
  }

  // 3) Agora que temos um array legítimo, iteramos item a item:
  return (
    nodes
      .map((item) => {
        // 3.1) COMPONENTE CUSTOMIZADO
        // Se existir um renderer registrado para este item.name, delegamos a ele:
        // registry.renderers[item.name] é um mapa de funções definidas em template-manager.js.
        if (registry.renderers[item.name]) {
          // Exemplo: item.name === 'modal', 'carrossel', 'citacao', etc.
          // Chamamos registry.render(item.name, item) e esperamos HTML completo.
          return registry.render(item.name, item);
        }

        // 3.2) Fallback para PARÁGRAFO
        // Quando o nó AST indica name === 'paragrafo', geramos <p>content</p>.
        // content já deve vir escapado pelo parser ou pelo escapeHtml chamado antes.
        if (item.name === "paragrafo") {
          return `<p>${item.content}</p>`;
        }

        // 3.3) Fallback para LISTA
        // item.type pode ser 'numerada' (ol) ou 'nao-numerada' (ul).
        if (item.name === "lista") {
          // Monta cada <li> a partir dos itens filhos
          const tag = item.type === "numerada" ? "ol" : "ul";
          const lis = item.content
            .map((li) => `<li>${li.content}</li>`)
            .join("");
          return `<${tag} class="lista-check">${lis}</${tag}>`;
        }

        // 3.4) Fallback genérico para qualquer outra tag
        //     - renderNodes recursivamente para aninhamento de conteúdo
        const inner = item.content ? renderNodes(item.content) : "";
        return `
        <div class="desconhecida">
          <h1>{{${item.name}}}</h1>
          ${inner}
        </div>`;
      })
      // 4) Junta tudo num único HTML
      .join("")
  );
}

/**
 * registry
 * --------
 * Objeto responsável por armazenar e gerenciar funções de renderização
 * de cada tipo de nó AST. Permite registrar novos renderers, buscar um
 * renderer existente e invocá-lo para gerar o HTML correspondente.
 */
const registry = {
  /**
   * renderers
   * ---------
   * Mapa onde a chave é o nome do componente (string) e o valor é a
   * função de renderização (fn) registrada para aquele componente.
   * Inicialmente vazio; popula-se via registry.register().
   */
  renderers: {},
  /**
   * register(key, fn)
   * -----------------
   * Registra uma função de renderização para um componente específico.
   *
   * @param {string} key
   *   Nome do componente (por exemplo, 'modal', 'carrossel', 'paragrafo').
   * @param {Function} fn
   *   Função que será chamada mais tarde para produzir o HTML do componente.
   *
   * Uso:
   *   registry.register('modal', node => '<div>...</div>');
   */

  register(key, fn) {
    // Armazena a função fn sob a chave key no mapa de renderers
    this.renderers[key] = fn;
  },

  /**
   * get(key)
   * ---------
   * Retorna a função de renderização registrada para o componente key.
   *
   * @param {string} key
   *   Nome do componente cujo renderer desejamos recuperar.
   * @returns {Function}
   *   A função de renderização previamente registrada.
   * @throws {Error}
   *   Se não existir renderer para a chave fornecida, lança um erro.
   *
   * Exemplo:
   *   const renderModal = registry.get('modal');
   */
  get(key) {
    const fn = this.renderers[key];
    if (!fn) throw new Error(`Renderer não encontrado para key '${key}'`);
    // Se fn for undefined, informa que o renderer não foi encontrado
    return fn;
  },

  /**
   * render(key, node)
   * -----------------
   * Atalho para buscar e invocar o renderer de um componente em um único passo.
   *
   * @param {string} key
   *   Nome do componente a ser renderizado.
   * @param {Object} node
   *   Nó AST com as propriedades que o renderer espera (por exemplo, content,
   *   slides, type etc.).
   * @returns {string}
   *   HTML gerado pela função de renderização.
   *
   * Exemplo:
   *   const html = registry.render('paragrafo', { name:'paragrafo', content:'Olá' });
   */
  render(key, node) {
    // this.get(key) recupera o fn e, em seguida, invoca fn(node)
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
      <div class="embed-responsive embed-responsive-16by9" style="border: 2px solid var(--cor-primaria);">]
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
 * renderTopic(node)
 * -----------------
 * Recebe um objeto AST de um único tópico (construído por parseTopicAst)
 * e gera a string HTML completa, incluindo:
 *   1. Head (metadados e título da página)
 *   2. Seções em ordem: cabeçalho, corpo(s) e rodapé
 *   3. Scripts finais de carregamento
 *
 * @param {Object} node
 *   O AST do tópico, onde cada chave é um índice de seção ('1','2',...)
 *   e cada valor é um objeto com:
 *     - name: 'secao'
 *     - type: 'cabecalho' | 'corpo' | 'rodape'
 *     - título_topico, título_aula (na seção 1)
 *     - content (array de nós AST) em seções de corpo
 *     - anterior, proximo (strings) em seção de rodapé
 *
 * @returns {string} html
 *   O HTML completo do tópico, pronto para exibição ou escrita em arquivo.
 */
function renderTopic(node) {
  // 1) Monta o <head> e insere o título da página
  //    node["1"] sempre é a seção de cabeçalho
  const header = node["1"];
  //    Combina “Título do Tópico – Título da Aula” para o <title>
  const pageTitle = `${header.titulo_topico} - ${header.titulo_aula}`;
  //    Chama o renderer 'head' (template contendo <!--PAGE_TITLE-->)
  //    e substitui o placeholder pelo título escapado
  let html = registry
    .render("head")
    .replace("<!--PAGE_TITLE-->", escapeHtml(pageTitle));

  // 2) Renderiza cada seção na ordem correta
  //    - Pega todas as chaves do objeto AST (strings '1','2',...)
  //    - Converte para número e ordena crescente
  const keys = Object.keys(node).sort((a, b) => Number(a) - Number(b));
  //    Para cada chave, decide se é cabeçalho, corpo ou rodapé
  keys.forEach((k, idx) => {
    const sec = node[k];
    if (idx === 0) {
      // Seção 1 = cabeçalho
      html += registry.render("secao:cabecalho", sec);
    } else if (idx === keys.length - 1) {
      // Última seção = rodapé
      html += registry.render("secao:rodape", sec);
    } else {
      // Seções intermediárias = corpo
      // Passa um objeto com content (AST de nós) e índice (para classes/ids)
      html += registry.render("secao:corpo", {
        content: sec.content,
        index: idx + 1,
      });
    }
  });

  // 3) Adiciona o bloco de <script> e fechamentos finais
  html += registry.render("scripts");

  // 4) Retorna o HTML concatenado de head + seções + scripts
  return html;
}

module.exports = {
  register: registry.register.bind(registry),
  renderTopic,
};

// Arquivo: processor-service.js

const fs = require("fs-extra");
const path = require("path");
const archiver = require("archiver");
const cheerio = require("cheerio");

/**
 * extractTopics(html)
 * -------------------
 * Recebe todo o HTML extraído do DOCX (via Mammoth) e identifica cada
 * bloco de tópico demarcado por {{TOPICO}}...{{/TOPICO}}.
 *
 * Cada ocorrência gera uma entrada no array de retorno contendo somente
 * o conteúdo interno desse bloco (sem as tags {{TOPICO}}).
 *
 * Exemplo:
 *   html = "<p>{{TOPICO}}Parte A{{/TOPICO}}<p>Texto livre</p>{{TOPICO}}Parte B{{/TOPICO}}"
 *   => ["Parte A", "Parte B"]
 *
 * Passos:
 *  1. Prepara um array `topics` para armazenar cada conteúdo de tópico encontrado.
 *  2. Define uma expressão regular global (com flag `g`) que busca:
 *     - Abertura:  {{  TOPICO  }}
 *     - Captura (lazy): tudo entre a abertura e o fechamento (inclui quebras e tags)
 *     - Fechamento: {{  /TOPICO  }}
 *  3. Usa `regex.exec(html)` em loop para encontrar todas as ocorrências;
 *     cada vez que `exec` retorna um array `match`, o índice `match[1]`
 *     contém apenas o texto capturado dentro do bloco.
 *  4. Empurra `match[1]` (já sem as tags) para `topics`.
 *  5. Quando `exec` não encontra mais nada retorna `null` e o loop termina.
 *  6. Retorna o array `topics`.
 */
function extractTopics(html) {
  // 1) Array que irá conter o conteúdo de cada tópico encontrado
  const topics = [];

  // 2) Regex para localizar os blocos {{TOPICO}}...{{/TOPICO}}
  //    - {{\s*TOPICO\s*}}   : abre um bloco, permitindo espaços antes/depois
  //    - ([\s\S]*?)         : captura preguiçosamente qualquer caractere, inclusive quebras
  //    - {{\s*\/TOPICO\s*}} : fecha o bloco, novamente permitindo espaços
  const regex = /{{\s*TOPICO\s*}}([\s\S]*?){{\s*\/TOPICO\s*}}/gi; // Regex para encontrar os tópicos

  // 3) Loop de regex.exec para encontrar todas as ocorrências no HTML
  let match;
  while ((match = regex.exec(html)) !== null) {
    // match[1] contém somente o conteúdo interno, sem as tags {{TOPICO}}
    topics.push(match[1]);
  }

  // 4) Retorna o array com todos os conteúdos de tópicos extraídos
  return topics;
}

/**
 * extractSections(topicHtml)
 * --------------------------
 * Para um bloco único de tópico (já isolado), retorna os trechos
 * correspondentes a cada seção {{SECAO}}...{{/SECAO}}.
 *
 * Exemplo:
 *   topicHtml = "<p>{{SECAO}}A{{/SECAO}}{{SECAO}}B{{/SECAO}}"
 *   => ["A", "B"]
 */
function extractSections(topicHtml) {
  const secs = [];
  const regex = /{{\s*SECAO\s*}}([\s\S]*?){{\s*\/SECAO\s*}}/gi;
  let match;
  while ((match = regex.exec(topicHtml)) !== null) {
    secs.push(match[1]);
  }
  return secs;
}

/**
 * parseSectionNodes(secHtml)
 * ---------------------------
 * Dado o HTML bruto de uma única seção de corpo (entre {{SECAO}}…{{/SECAO}}),
 * converte-o num array de nós AST (Abstract Syntax Tree). Cada nó descreve
 * um componente detectado — parágrafo, lista, modal, carrossel, citação,
 * destaque, vídeo, referências ou qualquer tag genérica.
 *
 * Exemplo de entrada (secHtml):
 *   "<p>Olá mundo</p><p>{{modal}}</p><p>Conteúdo</p><p>{{/modal}}</p>"
 *
 * Exemplo de saída (nodes):
 *   [
 *     { name: 'paragrafo', content: 'Olá mundo' },
 *     { name: 'modal', content: [
 *         { name: 'paragrafo', content: 'Conteúdo' }
 *       ]
 *     }
 *   ]
 *
 * Passos principais:
 * 1. Envolver secHtml em <root> para permitir múltiplos irmãos no topo.
 * 2. Carregar com Cheerio: const $ = cheerio.load(`<root>…</root>`)
 * 3. Iterar sobre cada child de <root>:
 *    a) Extrair tag (p, ul, ol) e texto (trim + lowercase).
 *    b) Para cada componente específico (video, referencias, citacao,
 *       destaque, modal, carrossel) em ordem de prioridade:
 *       - Detectar abertura (ex.: text === '{{modal}}').
 *       - Coletar todo o HTML interno até a tag de fechamento correspondente.
 *       - Chamar recursivamente parseSectionNodes(innerHtml) para criar
 *         sub-AST (aninhamento).
 *       - Inserir um nó { name, content } em `nodes` e dar `continue`.
 *    c) Detector genérico para quaisquer {{tag}} desconhecidas:
 *       - Captura tag pelo regex /^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/.
 *       - Coleta até {{/tag}}, chama recursão, insere { name: tag, content }.
 *    d) Fallback de parágrafo: se for <p>, usa $(el).html().trim() e
 *       nodes.push({ name:'paragrafo', content }).
 *    e) Fallback de lista: se for <ul> ou <ol>, percorre cada <li>, monta
 *       nodes.push({ name:'lista', type, content:[{name:'item',content}] }).
 *    f) Ignora qualquer outro elemento.
 * 4. Retorna o array `nodes`, representando a AST da seção.
 */
function parseSectionNodes(secHtml) {
  /**
   * Se secHtml começar com vários <p>, <ul>, etc., sem um único container pai,
   * o Cheerio às vezes se confunde sobre quais nós são irmãos ou filhos
   * Ao colocar <root>, garantimos um elemento pai único, de onde podemos extrair
   * ordenadamente todos os filhos diretos.
   *
   * O decodeEntities: false impede que Cheerio escape ou converta entidades HTML (&amp;, <, >)
   * de volta para texto — assim preservamos exatamente o HTML que recebemos do Mammoth,
   * incluindo tags como <strong> ou <em>.
   */
  const $ = cheerio.load(`<root>${secHtml}</root>`, { decodeEntities: false });
  const root = $("root");
  const nodes = [];
  const children = root.children().toArray();
  // Exemplo: children = [<p>Olá mundo</p>, <p>{{video}}</p>, <p>Conteúdo</p>, ...]

  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    console.log(`el: ${$.html(el)}`); // Debug
    const tag = el.tagName && el.tagName.toLowerCase();
    console.log(`tag: ${tag}`); // Debug
    const text = $(el).text().trim().toLowerCase();
    console.log(`text: ${text}`); // Debug

    // ─── Vídeo ──────────────────────────────────────────────────────────────
    // if (tag === "p" && text === "{{video}}") {
    //   // 1) coleta TODO o HTML interno até {{/video}} como uma string
    //   let innerHtmlStr = "";
    //   i++;
    //   while (i < children.length) {
    //     const sib = children[i];
    //     const sTag = sib.tagName && sib.tagName.toLowerCase();
    //     const sText = $(sib).text().trim().toLowerCase();
    //     if (sTag === "p" && sText === "{{/video}}") break;

    //     // acumula o HTML bruto deste nó (para permitir aninhamentos)
    //     innerHtmlStr += $.html(sib);
    //     i++;
    //   }

    //   // 2) chama recursivamente parseSectionNodes no fragmento coletado
    //   const content = parseSectionNodes(innerHtmlStr);

    //   // 3) insere o nó video com seu conteúdo recursivo
    //   nodes.push({ name: "video", content });

    //   // 4) pula para próxima iteração, evitando fallback de parágrafo
    //   continue;
    // }

    // ─── Referências ──────────────────────────────────────────────────────────────
    if (tag === "p" && text === "{{referencias}}") {
      // 1) coleta TODO o HTML interno até {{/referencias}} como uma string
      let innerHtmlStr = "";
      i++;
      while (i < children.length) {
        const sib = children[i];
        const sTag = sib.tagName && sib.tagName.toLowerCase();
        const sText = $(sib).text().trim().toLowerCase();
        if (sTag === "p" && sText === "{{/referencias}}") break;

        // acumula o HTML bruto deste nó (para permitir aninhamentos)
        innerHtmlStr += $.html(sib);
        i++;
      }

      // 2) chama recursivamente parseSectionNodes no fragmento coletado
      const content = parseSectionNodes(innerHtmlStr);

      // 3) insere o nó referencias com seu conteúdo recursivo
      nodes.push({ name: "referencias", content });

      // 4) pula para próxima iteração, evitando fallback de parágrafo
      continue;
    }

    // ─── Citação ──────────────────────────────────────────────────────────────
    if (tag === "p" && text === "{{citacao}}") {
      // 1) coleta TODO o HTML interno até {{/citacao}} como uma string
      let innerHtmlStr = "";
      i++;
      while (i < children.length) {
        const sib = children[i];
        const sTag = sib.tagName && sib.tagName.toLowerCase();
        const sText = $(sib).text().trim().toLowerCase();
        if (sTag === "p" && sText === "{{/citacao}}") break;

        // acumula o HTML bruto deste nó (para permitir aninhamentos)
        innerHtmlStr += $.html(sib);
        i++;
      }

      // 2) chama recursivamente parseSectionNodes no fragmento coletado
      const content = parseSectionNodes(innerHtmlStr);

      // 3) insere o nó citacao com seu conteúdo recursivo
      nodes.push({ name: "citacao", content });

      // 4) pula para próxima iteração, evitando fallback de parágrafo
      continue;
    }

    // ─── Destaque ──────────────────────────────────────────────────────────────
    if (tag === "p" && text === "{{destaque}}") {
      // 1) coleta TODO o HTML interno até {{/destaque}} como uma string
      let innerHtmlStr = "";
      i++;
      while (i < children.length) {
        const sib = children[i];
        const sTag = sib.tagName && sib.tagName.toLowerCase();
        const sText = $(sib).text().trim().toLowerCase();
        if (sTag === "p" && sText === "{{/destaque}}") break;

        // acumula o HTML bruto deste nó (para permitir aninhamentos)
        innerHtmlStr += $.html(sib);
        i++;
      }

      // 2) chama recursivamente parseSectionNodes no fragmento coletado
      const content = parseSectionNodes(innerHtmlStr);

      // 3) insere o nó destaque com seu conteúdo recursivo
      nodes.push({ name: "destaque", content });

      // 4) pula para próxima iteração, evitando fallback de parágrafo
      continue;
    }

    // ─── Modal ──────────────────────────────────────────────────────────────
    if (tag === "p" && text === "{{modal}}") {
      // 1) coleta TODO o HTML interno até {{/modal}} como uma string
      let innerHtmlStr = "";
      i++;
      while (i < children.length) {
        const sib = children[i];
        const sTag = sib.tagName && sib.tagName.toLowerCase();
        const sText = $(sib).text().trim().toLowerCase();
        if (sTag === "p" && sText === "{{/modal}}") break;

        // acumula o HTML bruto deste nó (para permitir aninhamentos)
        innerHtmlStr += $.html(sib);
        i++;
      }

      // 2) chama recursivamente parseSectionNodes no fragmento coletado
      const content = parseSectionNodes(innerHtmlStr);

      // 3) insere o nó modal com seu conteúdo recursivo
      nodes.push({ name: "modal", content });

      // 4) pula para próxima iteração, evitando fallback de parágrafo
      continue;
    }

    // ─── Carrossel ───────────────────────────────────────────────────────────
    if (tag === "p" && text === "{{carrossel}}") {
      // 1) coleta TODO o HTML interno até {{/carrossel}}
      let innerHtmlStr = "";
      i++;
      while (i < children.length) {
        const sib = children[i];
        const sTag = sib.tagName && sib.tagName.toLowerCase();
        const sText = $(sib).text().trim().toLowerCase();
        if (sTag === "p" && sText === "{{/carrossel}}") break;

        // acumula o HTML bruto de cada slide (para permitir aninhamentos)
        innerHtmlStr += $.html(sib);
        i++;
      }

      // 2) chama recursivamente parseSectionNodes para montar slides aninhados
      const slides = parseSectionNodes(innerHtmlStr);

      // 3) insere o nó carrossel com seu array de nós filhos (slides)
      nodes.push({ name: "carrossel", slides });

      // 4) pula para a próxima iteração
      continue;
    }

    // ─── Link ──────────────────────────────────────────────────────────────
    if (tag === "p" && text.includes("{{link")) {
      const htmlRaw = $(el).html();

      // 1) Detectar INLINE completo no mesmo <p> (qualquer linha, mesmo com quebras)
      const inlineMatch = htmlRaw.match(
        /{{\s*link(?:\s+url=['"]?(.*?)['"]?)?\s*}}([\s\S]*?){{\s*\/link\s*}}/i
      );
      if (inlineMatch) {
        const urlRaw = inlineMatch[1] ? inlineMatch[1].trim() : "";
        const url =
          urlRaw
            .replace(/<a[^>]+href=["']?([^"'>\s]+)["']?[^>]*>.*?<\/a>/i, "$1")
            .trim() || urlRaw;
        const innerContent = inlineMatch[2].trim();

        nodes.push({
          name: "link",
          url,
          innerContent,
        });
        continue;
      }

      // 2) Detectar ABERTURA + conteúdo no mesmo <p>, mas FECHAMENTO em outro
      const openingMatch = htmlRaw.match(
        /{{\s*link(?:\s+url=['"]?(.*?)['"]?)?\s*}}([\s\S]*)/i
      );
      if (openingMatch) {
        const urlRaw = openingMatch[1] ? openingMatch[1].trim() : "";
        const url =
          urlRaw
            .replace(/<a[^>]+href=["']?([^"'>\s]+)["']?[^>]*>.*?<\/a>/i, "$1")
            .trim() || urlRaw;
        let innerContent = openingMatch[2].trim();

        i++;
        while (i < children.length) {
          const sib = children[i];
          const sibHtml = $.html(sib);
          const sText = $(sib).text().trim().toLowerCase();

          if (sibHtml.includes("{{/link}}") || sText === "{{/link}}") {
            innerContent += sibHtml.replace(/{{\s*\/link\s*}}/i, "");
            break;
          }

          innerContent += sibHtml;
          i++;
        }

        nodes.push({
          name: "link",
          url,
          innerContent,
        });
        continue;
      }

      // 3) Tradicional ({{link}} em <p>, conteúdo em outros <p>, {{/link}} em outro <p>)
      const urlMatch = text.match(/{{\s*link(?:\s+url=['"]?(.*?)['"]?)?\s*}}/i);
      const urlRaw = urlMatch && urlMatch[1] ? urlMatch[1].trim() : "";
      const url =
        urlRaw
          .replace(/<a[^>]+href=["']?([^"'>\s]+)["']?[^>]*>.*?<\/a>/i, "$1")
          .trim() || urlRaw;

      let innerContent = "";
      i++;
      while (i < children.length) {
        const sib = children[i];
        const sibHtml = $.html(sib);
        const sText = $(sib).text().trim().toLowerCase();
        if (sibHtml.includes("{{/link}}") || sText === "{{/link}}") break;

        innerContent += sibHtml;
        i++;
      }

      nodes.push({
        name: "link",
        url,
        innerContent,
      });
      continue;
    }

    // ── DETECTOR GENÉRICO DE TAG DESCONHECIDA ────────────────────────────────
    const htmlRaw = $(el).html();

    // 1) Verificar inline completo dentro do mesmo <p>
    const inlineMatch = htmlRaw.match(
      /{{\s*([a-zA-Z0-9_]+)\s*}}([\s\S]*?){{\s*\/\1\s*}}/i
    );
    if (inlineMatch) {
      const name = inlineMatch[1];
      const innerContent = inlineMatch[2].trim();
      nodes.push({
        name: "desconhecida",
        tagOriginal: name,
        content: innerContent,
      });
      continue;
    }

    // 2) Se não for inline, tenta modo clássico (abertura em <p>, conteúdo em outros <p>, fechamento em outro <p>)
    const openMatch = text.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);
    if (tag === "p" && openMatch) {
      const name = openMatch[1];
      let innerContent = "";
      i++;
      while (i < children.length) {
        const sib = children[i];
        const sibHtml = $.html(sib);
        const sText = $(sib).text().trim();
        if (sib.tagName?.toLowerCase() === "p" && sText === `{{/${name}}}`) {
          break;
        }
        innerContent += sibHtml;
        i++;
      }
      nodes.push({
        name: "desconhecida",
        tagOriginal: name,
        content: innerContent,
      });
      continue;
    }

    // ─── Parágrafo ────────────────────────────────────────────────────────────
    if (tag === "p") {
      const html = $(el).html().trim();
      if (html) nodes.push({ name: "paragrafo", content: html });
      continue;
    }

    // ─── Lista (ul / ol) ──────────────────────────────────────────────────────

    if (tag === "ul" || tag === "ol") {
      const items = [];
      $(el)
        .find("li")
        .each((_, li) => {
          const liHtml = $(li).html().trim();
          if (liHtml) items.push({ name: "item", content: liHtml });
        });
      nodes.push({
        name: "lista",
        type: tag === "ol" ? "numerada" : "nao-numerada",
        content: items,
      });
      continue;
    }

    // Qualquer outra tag é ignorada
  }
  //console.log(`parseSectionNodes: ${JSON.stringify(nodes, null, 2)}`); // Debug
  return nodes;
}

/**
 * parseTopicAst(topicHtml)
 * ------------------------
 * Recebe uma string contendo o HTML de um único tópico (tudo entre
 * {{TOPICO}} e {{/TOPICO}}) e constrói um objeto AST (Abstract Syntax Tree)
 * com as informações de cada seção (cabeçalho, corpo, rodapé).
 *
 * Retorna um objeto onde cada chave é um índice de seção (string) a partir de '1',
 * e o valor é um objeto com:
 *   - name: sempre 'secao'
 *   - type: 'cabecalho' | 'corpo' | 'rodape'
 *   - para 'cabecalho': titulo_topico e titulo_aula (strings)
 *   - para 'corpo': content (array de nós AST de parseSectionNodes)
 *   - para 'rodape': anterior e proximo (strings de URL ou vazias)
 *
 * Exemplo:
 *   topicHtml = "<p>{{SECAO}}{{TITULO_TOPICO}}T1{{/TITULO_TOPICO}}...{{/SECAO}}"
 *   => {
 *        '1': { name:'secao', type:'cabecalho', titulo_topico:'T1', titulo_aula:'' },
 *        '2': { name:'secao', type:'rodape', anterior:'', proximo:'' }
 *      }
 *
 * Passos:
 *  1. Chamar extractSections(topicHtml) para obter um array de strings,
 *     cada uma representando o HTML interno de uma seção {{SECAO}}…{{/SECAO}}.
 *  2. Criar objeto vazio `ast = {}`.
 *  3. Iterar sobre cada seção (array de secHtml) com índice idx:
 *     a) key = String(idx + 1) → converte índice 0-based em '1','2',...
 *     b) Se idx === 0: é seção de cabeçalho.
 *        - Usar duas regex para extrair {{TITULO_TOPICO}} e {{TITULO_AULA}}.
 *        - Preencher ast[key] = { name:'secao', type:'cabecalho',
 *            titulo_topico: (match[1]||''), titulo_aula: (match[1]||'') }.
 *     c) Else if idx === last index: é rodapé.
 *        - Usar regex para encontrar {{ANTERIOR link=...}} e {{PROXIMO link=...}}.
 *        - Preencher ast[key] = { name:'secao', type:'rodape',
 *            anterior: (match[1]||''), proximo: (match[1]||'') }.
 *     d) Else: é seção de corpo.
 *        - Chamar parseSectionNodes(secHtml) para obter array de nós AST.
 *        - Preencher ast[key] = { name:'secao', type:'corpo',
 *            content: [ ...parsed nodes ] }.
 *  4. Cada bloco inteiro está envolvido num try/catch:
 *     - Se algo falhar (regex, parseSectionNodes lançar), faz console.warn
 *       e **não** adiciona ast[key], ignorando essa seção.
 *  5. Retornar o objeto completo `ast`.
 */
function parseTopicAst(topicHtml) {
  // 1) Extrai o array de HTMLs de cada seção
  const sections = extractSections(topicHtml);

  // 2) Prepara o objeto AST
  const ast = {};

  // 3) Processa cada seção sequencialmente
  sections.forEach((secHtml, idx) => {
    try {
      // Converte índice 0-based para string '1','2',...
      const key = String(idx + 1);

      // Seção 1 = cabeçalho
      if (idx === 0) {
        // Regex para {{TITULO_TOPICO}}...{{/TITULO_TOPICO}}
        const tTop =
          /{{\s*TITULO_TOPICO\s*}}([\s\S]*?){{\s*\/TITULO_TOPICO\s*}}/i.exec(
            secHtml
          );
        // Regex para {{TITULO_AULA}}...{{/TITULO_AULA}}
        const tAul =
          /{{\s*TITULO_AULA\s*}}([\s\S]*?){{\s*\/TITULO_AULA\s*}}/i.exec(
            secHtml
          );

        // Guarda no AST as strings capturadas (ou vazias)
        ast[key] = {
          // key será '1'
          name: "secao",
          type: "cabecalho",
          titulo_topico: tTop ? tTop[1].trim() : "",
          titulo_aula: tAul ? tAul[1].trim() : "",
        };

        // Última seção = rodapé
      } else if (idx === sections.length - 1) {
        const ant = /{{\s*ANTERIOR\s+link=['"]?(.*?)['"]?\s*}}/i.exec(secHtml);
        const prox = /{{\s*PROXIMO\s+link=['"]?(.*?)['"]?\s*}}/i.exec(secHtml);
        ast[key] = {
          // key será a última seção, '3' se houver 3 seções
          name: "secao",
          type: "rodape",
          // ant[0] corresponde a {{ANTERIOR link=...}}
          // ant[1] corresponde ao link extraído
          // Se não houver link, ant[1] será undefined, então usamos || ""
          anterior: ant ? ant[1] : "",
          proximo: prox ? prox[1] : "",
        };

        // Seções intermediárias = corpo
      } else {
        // Guarda no AST o array de nós
        ast[key] = {
          // key será receberá valores de '2' a 'n-1'
          name: "secao",
          type: "corpo",
          content: parseSectionNodes(secHtml), // Só chama parseSectionNodes se não for cabecalho ou rodapé
        };
      }
    } catch (err) {
      // Se qualquer erro ocorrer, ignoramos essa seção
      console.warn(`Ignorando sessão ${idx + 1} por erro:`, err.message);
    }
  });
  console.log(`AST: ${JSON.stringify(ast, null, 2)}`); // Debug
  // 4) Retorna o objeto AST completo para este tópico
  return ast;
}

/**
 * parseDocument(htmlInput)
 * ------------------------
 * Recebe o HTML bruto extraído do DOCX (via Mammoth) e constrói um AST
 * (Abstract Syntax Tree) completo, onde cada chave do objeto representa
 * um tópico ({{TOPICO}}…{{/TOPICO}}) e o valor é o AST desse tópico.
 *
 * Exemplo:
 *   htmlInput = "<p>{{TOPICO}}A{{/TOPICO}}{{TOPICO}}B{{/TOPICO}}"
 *   => {
 *        '1': AST_do_tópico_A,
 *        '2': AST_do_tópico_B
 *      }
 *
 * Passos:
 *  1. Valida se a entrada é string. Se não for, lança erro.
 *  2. Usa extractTopics() para obter um array de strings, cada uma
 *     contendo o HTML interno de um bloco {{TOPICO}}.
 *  3. Se nenhum {{TOPICO}} for encontrado, trata o documento inteiro
 *     como tópico único (chave '1').
 *  4. Para cada tópico encontrado, chama parseTopicAst() para gerar
 *     o AST daquele pedaço.
 *  5. Retorna o objeto AST completo.
 */
function parseDocument(htmlInput) {
  // 1) Garantir que recebemos uma string de HTML
  if (typeof htmlInput !== "string") {
    // Se não for, interrompemos e avisamos quem chamou
    throw new Error(
      "Entrada inválida para parseDocument: esperado string de HTML"
    );
  }

  // 2) Extrair todos os blocos de tópico do HTML
  //    topics será array de strings, ex: ["<p>...</p>", "<p>...</p>"]
  const topics = extractTopics(htmlInput);

  // 3) Declaramos o objeto AST que vamos montar
  const ast = {};

  // 4) Se não encontramos nenhum {{TOPICO}}, tratamos tudo como um único tópico
  if (topics.length === 0) {
    // parseTopicAst recebe o HTML inteiro e retorna um AST desse único tópico
    ast["1"] = parseTopicAst(htmlInput);
  } else {
    // 5) Para cada string de tópico extraída...
    topics.forEach((tpHtml, index) => {
      // index começa em 0, mas queremos chaves iniciando em '1'
      const key = String(index + 1);
      // parseTopicAst constrói o AST só daquele fragmento tpHtml
      ast[key] = parseTopicAst(tpHtml);
    });
  }

  // 6) Devolve o AST completo:
  //    { '1': AST_tópico1, '2': AST_tópico2, ... }
  return ast;
}

/**
 * processarAula(htmlInput)
 * ------------------------
 * Recebe o HTML bruto extraído do DOCX (via Mammoth) e produz dois arrays:
 *   1. htmls: cada elemento é uma string contendo o HTML completo de um tópico
 *   2. titles: cada elemento é o título da aula correspondente, usado para nomear
 *      arquivos ou para exibir em interfaces
 *
 * Exemplo de fluxo:
 *   htmlInput = "<p>{{TOPICO}}...{{/TOPICO}}"
 *   parseDocument(htmlInput) retorna:
 *     {
 *       '1': {   // nó AST do tópico 1
 *         name: 'secao', type:'cabecalho', titulo_aula:'Minha Aula', ...
 *          demais seções de corpo e rodapé aninhadas...
 *       }
 *     }
 *   processarAula(htmlInput) retorna:
 *     {
 *       htmls: ["<!DOCTYPE html><html>...Minha Aula...</html>"],
 *       titles: ["Minha Aula"]
 *     }
 *
 * Passos:
 *  1. Chama parseDocument(htmlInput) para converter todo o HTML em um AST
 *  2. Extrai as chaves (strings '1', '2', ...) do AST e as ordena numericamente
 *  3. Prepara dois arrays vazios: htmls e titles
 *  4. Importa o Template Manager dinamicamente para renderizar cada nó AST
 *  5. Para cada chave ordenada:
 *     a) Recupera node = ast[key] (AST do tópico)
 *     b) Chama TemplateMgr.renderTopic(node) para gerar o HTML completo
 *     c) Adiciona o HTML gerado em htmls
 *     d) Tenta extrair node['1'].titulo_aula (título da primeira seção)
 *        — se existir, usa como título; senão, usa um fallback "Tópico_<key>"
 *     e) Adiciona esse título em titles
 *  6. Retorna um objeto contendo os dois arrays: { htmls, titles }
 */
function processarAula(htmlInput) {
  // 1) Converte HTML bruto em AST de tópicos
  const ast = parseDocument(htmlInput);
  //    ast = { '1': AST_tópico1, '2': AST_tópico2, ... }
  //    Cada chave é um índice de tópico, e o valor é o AST desse tópico
  //    Exemplo: { '1': { name: 'secao', type: 'cabecalho', ... } }
  // 2) Ordena as chaves ('1','2',...) para garantir sequência correta
  const keys = Object.keys(ast).sort((a, b) => Number(a) - Number(b));
  //    Exemplo: keys = ['1', '2', ...] (array de strings representando os índices)
  // 3) Prepara arrays de saída
  const htmls = [];
  const titles = [];
  // 4) Importa o módulo de template para renderizar AST em HTML
  const TemplateMgr = require("./template-manager");

  // 5) Para cada tópico no AST...
  for (const key of keys) {
    // 5a) Obtém o nó AST daquele tópico
    const node = ast[key];
    //    Exemplo: node = { '1': { name: 'secao', type: 'cabecalho', ... } }
    //    node['1'] corresponde à seção 1 (cabecalho) do tópico
    //    node['2'] corresponde à seção 2 (corpo) do tópico
    //    node['3'] corresponde à seção 3 (rodape) do tópico
    // 5b) Renderiza todo o tópico em uma string HTML completa
    const html = TemplateMgr.renderTopic(node);
    htmls.push(html);

    // 5c) Extrai o título da aula a partir da seção de cabeçalho:
    //     node['1'] corresponde à seção 1 (cabecalho)
    //     .titulo_aula foi definido em parseTopicAst
    const header = node["1"];
    const title =
      header && header.titulo_aula ? header.titulo_aula : `Tópico_${key}`; // fallback caso não exista titulo_aula

    titles.push(title);
  }

  // 6) Devolve os arrays de HTML e títulos, prontos para uso
  return { htmls, titles };
}

/**
 * Cria ZIP de múltiplos HTMLs.
 */
async function createZipFromHTMLs(htmls, titles, outputDir, baseName = "aula") {
  const zipName = `${baseName}_${Date.now()}.zip`;
  const dest = outputDir || require("os").tmpdir();
  const zipPath = path.join(dest, zipName);
  await fs.ensureDir(dest);

  return new Promise((res, rej) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => res(zipPath));
    archive.on("error", (err) => rej(err));
    archive.pipe(output);
    htmls.forEach((h, i) => {
      const safe =
        titles[i].replace(/[^a-z0-9_\\-]/gi, "_").slice(0, 50) ||
        `topico_${i + 1}`;
      archive.append(Buffer.from(h, "utf8"), { name: `${safe}.html` });
    });
    archive.finalize();
  });
}

/**
 * Processa e salva arquivos no disco.
 */
async function processAndSave(htmlInput, outputDir, baseName = "aula") {
  const { htmls, titles } = processarAula(htmlInput);
  const savedHtmlPaths = [];
  await fs.ensureDir(outputDir);

  for (let i = 0; i < htmls.length; i++) {
    const fileName = `${baseName}_${i + 1}.html`;
    const fullPath = path.join(outputDir, fileName);
    await fs.writeFile(fullPath, htmls[i], "utf8");
    savedHtmlPaths.push(fullPath);
  }
  if (htmls.length > 1) {
    const zipPath = await createZipFromHTMLs(
      htmls,
      titles,
      outputDir,
      baseName
    );
    return { htmlPaths: savedHtmlPaths, zipPath };
  }
  return { htmlPaths: savedHtmlPaths };
}

module.exports = {
  parseDocument,
  processarAula,
  createZipFromHTMLs,
  processAndSave,
};

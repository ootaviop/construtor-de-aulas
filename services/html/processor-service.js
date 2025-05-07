const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver');
const cheerio = require('cheerio');

/**
 * Extrai blocos {{TOPICO}}...{{/TOPICO}} do HTML de entrada.
 */
function extractTopics(html) {
  const topics = [];
  const regex = /{{\s*TOPICO\s*}}([\s\S]*?){{\s*\/TOPICO\s*}}/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    topics.push(match[1]);
  }
  return topics;
}

/**
 * Extrai blocos {{SECAO}}...{{/SECAO}} dentro de um tópico.
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
 * Converte conteúdo de uma seção de corpo em nós AST,
 * detectando parágrafos, listas e carrossel.
 */
function parseSectionNodes(secHtml) {
  const $ = cheerio.load(`<root>${secHtml}</root>`, { decodeEntities: false });
  const root     = $('root');
  const nodes    = [];
  const children = root.children().toArray();

  for (let i = 0; i < children.length; i++) {
    const el   = children[i];
    const tag  = el.tagName && el.tagName.toLowerCase();
    const text = $(el).text().trim().toLowerCase();

    // ─── Citação ──────────────────────────────────────────────────────────────
    if (tag === 'p' && text === '{{citacao}}') {
      // 1) coleta TODO o HTML interno até {{/citacao}} como uma string
      let innerHtmlStr = '';
      i++;
      while (i < children.length) {
        const sib   = children[i];
        const sTag  = sib.tagName && sib.tagName.toLowerCase();
        const sText = $(sib).text().trim().toLowerCase();
        if (sTag === 'p' && sText === '{{/citacao}}') break;

        // acumula o HTML bruto deste nó (para permitir aninhamentos)
        innerHtmlStr += $.html(sib);
        i++;
      }

      // 2) chama recursivamente parseSectionNodes no fragmento coletado
      const content = parseSectionNodes(innerHtmlStr);

      // 3) insere o nó citacao com seu conteúdo recursivo
      nodes.push({ name: 'citacao', content });

      // 4) pula para próxima iteração, evitando fallback de parágrafo
      continue;
    }


    // ─── Destaque ──────────────────────────────────────────────────────────────
    if (tag === 'p' && text === '{{destaque}}') {
      // 1) coleta TODO o HTML interno até {{/destaque}} como uma string
      let innerHtmlStr = '';
      i++;
      while (i < children.length) {
        const sib   = children[i];
        const sTag  = sib.tagName && sib.tagName.toLowerCase();
        const sText = $(sib).text().trim().toLowerCase();
        if (sTag === 'p' && sText === '{{/destaque}}') break;

        // acumula o HTML bruto deste nó (para permitir aninhamentos)
        innerHtmlStr += $.html(sib);
        i++;
      }

      // 2) chama recursivamente parseSectionNodes no fragmento coletado
      const content = parseSectionNodes(innerHtmlStr);

      // 3) insere o nó destaque com seu conteúdo recursivo
      nodes.push({ name: 'destaque', content });

      // 4) pula para próxima iteração, evitando fallback de parágrafo
      continue;
    }

    // ─── Modal ──────────────────────────────────────────────────────────────
        if (tag === 'p' && text === '{{modal}}') {
            // 1) coleta TODO o HTML interno até {{/modal}} como uma string
            let innerHtmlStr = '';
            i++;
            while (i < children.length) {
              const sib   = children[i];
              const sTag  = sib.tagName && sib.tagName.toLowerCase();
              const sText = $(sib).text().trim().toLowerCase();
              if (sTag === 'p' && sText === '{{/modal}}') break;
      
              // acumula o HTML bruto deste nó (para permitir aninhamentos)
              innerHtmlStr += $.html(sib);
              i++;
            }
      
            // 2) chama recursivamente parseSectionNodes no fragmento coletado
            const content = parseSectionNodes(innerHtmlStr);
      
            // 3) insere o nó modal com seu conteúdo recursivo
            nodes.push({ name: 'modal', content });
      
            // 4) pula para próxima iteração, evitando fallback de parágrafo
            continue;
          }

    // ─── Carrossel ───────────────────────────────────────────────────────────
    if (tag === 'p' && text === '{{carrossel}}') {
        // 1) coleta TODO o HTML interno até {{/carrossel}}
        let innerHtmlStr = '';
        i++;
        while (i < children.length) {
          const sib   = children[i];
          const sTag  = sib.tagName && sib.tagName.toLowerCase();
          const sText = $(sib).text().trim().toLowerCase();
          if (sTag === 'p' && sText === '{{/carrossel}}') break;
  
          // acumula o HTML bruto de cada slide (para permitir aninhamentos)
          innerHtmlStr += $.html(sib);
          i++;
        }
  
        // 2) chama recursivamente parseSectionNodes para montar slides aninhados
        const slides = parseSectionNodes(innerHtmlStr);
  
        // 3) insere o nó carrossel com seu array de nós filhos (slides)
        nodes.push({ name: 'carrossel', slides });
  
        // 4) pula para a próxima iteração
        continue;
      }

      // ── DETECTOR GENÉRICO DE TAG DESCONHECIDA ────────────────────────────────
    // Se viermos um <p>{{qualquerCoisa}}</p> que NÃO seja modal ou carrossel,
    // criamos um nó AST { name: 'qualquerCoisa', content: [...] }.
    const openMatch = text.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);
    if (tag === 'p' && openMatch) {
      const name = openMatch[1];           // e.g. 'citacao'
      const innerHtml = [];
      i++;
      // acumula tudo até encontrar {{/name}}
      while (i < children.length) {
        const sib   = children[i];
        const sText = $(sib).text().trim();
        if (sib.tagName?.toLowerCase() === 'p' && sText === `{{/${name}}}`) {
          break;
        }
        // mantém o HTML bruto para parsing recursivo
        innerHtml.push($.html(sib));
        i++;
      }
      // chama recursivamente para gerar AST interno
      const content = parseSectionNodes(innerHtml.join(''));
      nodes.push({ name, content });
      continue;
    }

    // ─── Parágrafo ────────────────────────────────────────────────────────────
    if (tag === 'p') {
      const html = $(el).html().trim();
      if (html) nodes.push({ name: 'paragrafo', content: html });
      continue;
    }

    // ─── Lista (ul / ol) ──────────────────────────────────────────────────────

    if (tag === 'ul' || tag === 'ol') {
      const items = [];
      $(el).find('li').each((_, li) => {
        const liHtml = $(li).html().trim();
        if (liHtml) items.push({ name: 'item', content: liHtml });
      });
      nodes.push({
        name: 'lista',
        type: tag === 'ol' ? 'numerada' : 'nao-numerada',
        content: items
      });
      continue;
    }

    // Qualquer outra tag é ignorada


  }
  //console.log(`parseSectionNodes: ${JSON.stringify(nodes, null, 2)}`); // Debug
  return nodes;
}
/**
 * Constrói o AST JSON para um único tópico.
 */
function parseTopicAst(topicHtml) {
  const sections = extractSections(topicHtml);
  const ast = {};

  sections.forEach((secHtml, idx) => {
    try{
    const key = String(idx + 1);

    if (idx === 0) {
      // Cabeçalho
      const tTop = /{{\s*TITULO_TOPICO\s*}}([\s\S]*?){{\s*\/TITULO_TOPICO\s*}}/i.exec(secHtml);
      const tAul = /{{\s*TITULO_AULA\s*}}([\s\S]*?){{\s*\/TITULO_AULA\s*}}/i.exec(secHtml);
      ast[key] = {
        name: 'secao',
        type: 'cabecalho',
        titulo_topico: tTop ? tTop[1].trim() : '',
        titulo_aula:   tAul ? tAul[1].trim() : ''
      };

    } else if (idx === sections.length - 1) {
      // Rodapé
      const ant  = /{{\s*ANTERIOR\s+link=['"]?(.*?)['"]?\s*}}/i.exec(secHtml);
      const prox = /{{\s*PROXIMO\s+link=['"]?(.*?)['"]?\s*}}/i.exec(secHtml);
      ast[key] = {
        name: 'secao',
        type: 'rodape',
        anterior: ant   ? ant[1] : '',
        proximo:  prox  ? prox[1]: ''
      };

    } else {
      // Corpo: parágrafos, listas e carrossel
      ast[key] = {
        name: 'secao',
        type: 'corpo',
        content: parseSectionNodes(secHtml)
      };
    }
  } catch(err) {
    console.warn(`Ignorando sessão ${idx+1} por erro:`, err.message);
  }
  });
  //console.log(`AST: ${JSON.stringify(ast, null, 2)}`); // Debug
  return ast;

}

/**
 * Parseia HTML de entrada em AST.
 */
function parseDocument(htmlInput) {
  if (typeof htmlInput !== 'string')
    throw new Error('Entrada inválida para parseDocument.');
  const topics = extractTopics(htmlInput);
  const ast = {};

  if (topics.length === 0) {
    ast['1'] = parseTopicAst(htmlInput);
  } else {
    topics.forEach((tp, i) => {
      ast[String(i+1)] = parseTopicAst(tp);
    });
  }
  return ast;
}

/**
 * Gera arrays de HTML e titles a partir do AST.
 */
function processarAula(htmlInput) {
  const ast = parseDocument(htmlInput);
  const keys = Object.keys(ast).sort();
  const htmls = [];
  const titles = [];
  const TemplateMgr = require('./template-manager');

  for (const key of keys) {
    const node = ast[key];
    const html = TemplateMgr.renderTopic(node);
    htmls.push(html);
    titles.push(node['1']?.titulo_aula || `Topico_${key}`);
  }

  return { htmls, titles };
}

/**
 * Cria ZIP de múltiplos HTMLs.
 */
async function createZipFromHTMLs(htmls, titles, outputDir, baseName = 'aula') {
  const zipName = `${baseName}_${Date.now()}.zip`;
  const dest = outputDir || require('os').tmpdir();
  const zipPath = path.join(dest, zipName);
  await fs.ensureDir(dest);

  return new Promise((res, rej) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => res(zipPath));
    archive.on('error', err => rej(err));
    archive.pipe(output);
    htmls.forEach((h, i) => {
      const safe = titles[i]
        .replace(/[^a-z0-9_\\-]/gi, '_')
        .slice(0, 50) || `topico_${i+1}`;
      archive.append(Buffer.from(h, 'utf8'), { name: `${safe}.html` });
    });
    archive.finalize();
  });
}

/**
 * Processa e salva arquivos no disco.
 */
async function processAndSave(htmlInput, outputDir, baseName = 'aula') {
  const { htmls, titles } = processarAula(htmlInput);
  const savedHtmlPaths = [];
  await fs.ensureDir(outputDir);

  for (let i = 0; i < htmls.length; i++) {
    const fileName = `${baseName}_${i+1}.html`;
    const fullPath = path.join(outputDir, fileName);
    await fs.writeFile(fullPath, htmls[i], 'utf8');
    savedHtmlPaths.push(fullPath);
  }
  if (htmls.length > 1) {
    const zipPath = await createZipFromHTMLs(htmls, titles, outputDir, baseName);
    return { htmlPaths: savedHtmlPaths, zipPath };
  }
  return { htmlPaths: savedHtmlPaths };
}

module.exports = {
  parseDocument,
  processarAula,
  createZipFromHTMLs,
  processAndSave
};
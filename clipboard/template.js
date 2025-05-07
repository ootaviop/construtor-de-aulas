let template = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aula Interativa</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css">
  <link href="https://use.typekit.net/bbo1gxr.css" rel="stylesheet" type="text/css">
  <link rel="stylesheet" type="text/css" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
  <link href="https://recursos-moodle.caeddigital.net/projetos/2024/municipios/css/municipios-2024.css" rel="stylesheet" type="text/css">
</head>
<body>
  <div class="container c-aula-container curso secao1">
    <div class="row">
      <div class="col">
        <div class="separador-menor"></div>
        <div class="d-center">
          <img class="img-topo-aula" src="https://recursos-moodle.caeddigital.net/projetos/2024/caed/selo-aplicador/img/topo.svg">
        </div>
        <div class="separador-menor"></div>
        <div class="titulo-topico-box">
          ${this.titulos.topico}
        </div>
        <div class="separador-menor"></div>
        <div class="row row-topo-titulo">
          <div class="col-sm-12 col-md-10 col-lg-8 col-xl-8">
            ${this.titulos.aula}
            <div class="separador-medio"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  ${content}

  <script src="https://cdn.jsdelivr.net/npm/jquery@3.5.1/dist/jquery.slim.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/popper.js@1.16.1/dist/umd/popper.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.min.js"></script>
  <script src="https://recursos-moodle.caeddigital.net/projetos/2024/municipios/js/municipios.js"></script>
</body>
</html>`;

<div class="container c-aula-container curso secao1">
  <section>
    <div class="row row-txt">
      <div class="col-sm-12 col-md-10 col-lg-8 col-xl-8">
        <div>{{ content }}</div>
        <div class="separador-menor"></div>
      </div>
    </div>
  </section>
</div>;

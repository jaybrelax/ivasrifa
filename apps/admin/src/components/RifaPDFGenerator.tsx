import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface RifaPDFGeneratorProps {
  rifaId: string;
  rifaTitulo: string;
  totalNumeros: number;
}

export function RifaPDFGenerator({ rifaId, rifaTitulo, totalNumeros }: RifaPDFGeneratorProps) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data: numeros, error } = await supabase
        .from("numeros_rifa")
        .select(`
          numero,
          status,
          pedido:pedidos (
            cliente:clientes (
              nome_completo
            )
          )
        `)
        .eq("rifa_id", rifaId)
        .order("numero", { ascending: true });

      if (error) throw error;

      const mapaNumeros: Record<number, string> = {};
      numeros?.forEach((n: any) => {
        let nome = "";
        if (n.status === "vendido" && n.pedido?.cliente?.nome_completo) {
          const partes = n.pedido.cliente.nome_completo.trim().split(/\s+/);
          nome = partes.length >= 2 ? `${partes[0]} ${partes[partes.length - 1]}` : partes[0];
        } else if (n.status === "reservado") {
          nome = "Reservado";
        }
        mapaNumeros[n.numero] = nome;
      });

      const todos = Array.from({ length: totalNumeros }, (_, i) => ({
        numero: i + 1,
        nome: mapaNumeros[i + 1] || "",
      }));

      abrirJanelaImpressao(rifaTitulo, todos);
    } catch (err: any) {
      toast.error("Erro ao gerar PDF: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
      onClick={handleGenerate}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileText className="mr-2 h-4 w-4" />
      )}
      {loading ? "Gerando PDF..." : "Gerar PDF dos Numeros"}
    </Button>
  );
}

function abrirJanelaImpressao(titulo: string, numeros: { numero: number; nome: string }[]) {
  const COLS = 10;
  const ROWS_PER_PAGE = 10; // 10 linhas x 10 colunas = 100 celulas por pagina para caber na vertical

  const linhas: { numero: number; nome: string }[][] = [];
  for (let i = 0; i < numeros.length; i += COLS) {
    linhas.push(numeros.slice(i, i + COLS));
  }

  const paginas: (typeof linhas)[] = [];
  for (let i = 0; i < linhas.length; i += ROWS_PER_PAGE) {
    paginas.push(linhas.slice(i, i + ROWS_PER_PAGE));
  }

  const tabelasPorPagina = paginas
    .map((paginaLinhas, pIdx) => {
      const rows = paginaLinhas
        .map((linha) => {
          const tds = linha
            .map(({ numero, nome }) => {
              const nomeExibido = nome ? nome.toUpperCase() : "&nbsp;";
              return `<td>
                <div class="celula">
                  <div class="conteudo-rotacionado">
                    <div class="numero">${String(numero).padStart(3, "0")}</div>
                    <div class="nome">${nomeExibido}</div>
                  </div>
                </div>
              </td>`;
            })
            .join("");

          const faltam = COLS - linha.length;
          const vazias = Array(faltam)
            .fill(`<td><div class="celula"><div class="conteudo-rotacionado"><div class="numero">&nbsp;</div><div class="nome">&nbsp;</div></div></div></td>`)
            .join("");

          return `<tr>${tds}${vazias}</tr>`;
        })
        .join("\n");

      const isUltima = pIdx === paginas.length - 1;
      const classe = isUltima ? "grid" : "grid page-break";
      return `<table class="${classe}"><tbody>${rows}</tbody></table>`;
    })
    .join("\n");

  const dataGeracao = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalPaginas = paginas.length;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Cartela de Numeros - ${titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #fff;
      color: #111;
      padding: 10mm 10mm;
    }

    .cabecalho {
      text-align: center;
      margin-bottom: 6mm;
      padding-bottom: 4mm;
      border-bottom: 2px solid #333;
    }
    .cabecalho h1 {
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .cabecalho p {
      font-size: 7.5pt;
      color: #555;
      margin-top: 2px;
    }

    .grid {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .grid td {
      width: 10%;
      border: 1.5px dashed #bbb;
      padding: 0;
      vertical-align: top;
    }

    /*
      Celula vertical: 26mm de altura x ~19mm de largura (10% de A4).
    */
    .celula {
      width: 100%;
      height: 26mm;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    /*
      Conteiner rotacionado.
      -90deg significa que o texto comeca em baixo e vai pra cima.
      Ao rotacionar, o que era a esquerda (numero) fica na base,
      e a direita (nome) fica no topo.
    */
    .conteudo-rotacionado {
      width: 26mm;  /* LARGURA do conteudo rotacionado = ALTURA da celula vertical */
      height: 19mm; /* ALTURA do conteudo rotacionado = LARGURA da celula vertical */
      display: flex;
      flex-direction: column; /* Numero em cima, Nome embaixo na orientacao correta */
      align-items: center;
      justify-content: center;
      transform: rotate(-90deg);
      gap: 1.5mm;
      padding: 0 1mm;
    }

    .numero {
      font-size: 13pt;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #1a1a1a;
      line-height: 1;
      flex-shrink: 0;
    }

    .nome {
      font-size: 5.5pt;
      font-weight: 700;
      color: #333;
      text-align: center;
      line-height: 1.2;
      word-break: break-word;
      white-space: normal;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      width: 100%;
      max-width: 26mm;
      max-height: 2.4em;
    }

    .tesoura-hint {
      font-size: 7pt;
      color: #999;
      text-align: right;
      margin-top: 3mm;
    }

    .page-break {
      page-break-after: always;
      break-after: page;
      margin-bottom: 0;
    }

    @media print {
      body { padding: 8mm 8mm; }
      @page { size: A4 portrait; margin: 8mm; }
      .cabecalho { display: none; }
    }
  </style>
</head>
<body>
  <div class="cabecalho">
    <h1>&#9986; ${titulo}</h1>
    <p>Cartela de Numeros Completa &nbsp;|&nbsp; ${numeros.length} numeros &nbsp;|&nbsp; ${totalPaginas} pagina(s) &nbsp;|&nbsp; Gerada em ${dataGeracao}</p>
  </div>

  ${tabelasPorPagina}

  <p class="tesoura-hint">&#9986; Recorte pelas linhas tracejadas</p>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

  const janela = window.open("", "_blank", "width=900,height=700");
  if (!janela) {
    alert("Seu navegador bloqueou a abertura da janela. Permita pop-ups para este site.");
    return;
  }
  janela.document.write(html);
  janela.document.close();
}

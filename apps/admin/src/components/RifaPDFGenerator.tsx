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
      // Buscar todos os números com info do pedido e cliente
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

      // Montar mapa numero -> nome do comprador
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

      // Gerar array de 0 até totalNumeros - 1
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
      {loading ? "Gerando PDF..." : "Gerar PDF dos Números"}
    </Button>
  );
}

function abrirJanelaImpressao(titulo: string, numeros: { numero: number; nome: string }[]) {
  const COLS = 10;

  // Dividir em linhas de 10
  const linhas: { numero: number; nome: string }[][] = [];
  for (let i = 0; i < numeros.length; i += COLS) {
    linhas.push(numeros.slice(i, i + COLS));
  }

  // Estilos inline para a página de impressão
  const cells = linhas
    .map((linha) => {
      const cells = linha
        .map(
          ({ numero, nome }) => `
          <div class="celula">
            <div class="numero">${String(numero).padStart(3, "0")}</div>
            <div class="nome">${nome || "&nbsp;"}</div>
          </div>`
        )
        .join("");
      return `<div class="linha">${cells}</div>`;
    })
    .join("");

  const dataGeracao = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Cartela de Números – ${titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #fff;
      color: #111;
      padding: 12mm 10mm;
    }

    .cabecalho {
      text-align: center;
      margin-bottom: 8mm;
      padding-bottom: 4mm;
      border-bottom: 2px solid #333;
    }
    .cabecalho h1 {
      font-size: 18pt;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .cabecalho p {
      font-size: 8pt;
      color: #555;
      margin-top: 2px;
    }

    .grid {
      width: 100%;
    }

    .linha {
      display: flex;
      width: 100%;
      border-left: 1.5px dashed #aaa;
      border-top: 1.5px dashed #aaa;
    }

    .linha:last-child {
      border-bottom: 1.5px dashed #aaa;
    }

    .celula {
      flex: 1;
      border-right: 1.5px dashed #aaa;
      padding: 3px 2px 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 16mm;
      gap: 2px;
    }

    .numero {
      font-size: 14pt;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #1a1a1a;
      line-height: 1;
    }

    .nome {
      font-size: 6pt;
      font-weight: 600;
      color: #444;
      text-align: center;
      line-height: 1.2;
      word-break: break-word;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 90%;
    }

    /* Ícone tesoura no canto */
    .tesoura-hint {
      font-size: 7pt;
      color: #999;
      text-align: right;
      margin-top: 3mm;
    }

    @media print {
      body { padding: 8mm 8mm; }
      @page { size: A4 portrait; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="cabecalho">
    <h1>✂ ${titulo}</h1>
    <p>Cartela de Números Completa &nbsp;|&nbsp; ${numeros.length} números &nbsp;|&nbsp; Gerada em ${dataGeracao}</p>
  </div>

  <div class="grid">
    ${cells}
  </div>

  <p class="tesoura-hint">✂ Recorte pelas linhas tracejadas</p>

  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

  const janela = window.open("", "_blank", "width=900,height=700");
  if (!janela) {
    toast.error("Seu navegador bloqueou a abertura da janela. Permita pop-ups para este site.");
    return;
  }
  janela.document.write(html);
  janela.document.close();
}

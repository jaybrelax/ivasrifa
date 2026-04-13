import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, Payment } from "mercadopago";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Rota de Teste Health (Para saber se o servidor está vivo)
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    mode: process.env.VERCEL ? "serverless" : "local",
    time: new Date().toISOString()
  });
});

// --- INJEÇÃO DE SEO PARA CRAWLERS (Chamado pelo Middleware) ---
// Esta rota agora é focada APENAS em bots. O Middleware garante que humanos não cheguem aqui.
app.get("/api-seo/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).send("Configuração ausente.");
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // 1. Buscar dados da Rifa
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let query = supabaseAdmin.from("rifas").select("*");
    query = isUuid ? query.eq("id", id) : query.eq("slug", id);
    const { data: rifa } = await query.single();
    
    if (!rifa) {
      return res.status(404).send("Rifa não encontrada.");
    }

    // 2. Buscar Configurações
    const { data: config } = await supabaseAdmin.from("vw_configuracoes_publicas").select("*").eq("id", 1).single();

    const title = `${rifa.titulo} - ${config?.nome_sistema || "Sorteios Online"}`;
    const description = (rifa.descricao || "").substring(0, 160).replace(/["']/g, "");
    const image = rifa.imagem_url || "";
    const siteUrl = `https://${req.get('host')}/${rifa.slug || rifa.id}`;

    // Para BOTs, não precisamos do index.html real com JS. 
    // Basta um HTML minimalista com as Meta Tags que eles precisam.
    const botHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="${image}" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="${siteUrl}" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:image" content="${image}" />
      </head>
      <body>
        <h1>${title}</h1>
        <p>${description}</p>
        <img src="${image}" alt="${title}" />
        <script>window.location.href = "/${id}";</script>
      </body>
      </html>
    `.trim();

    res.send(botHtml);
  } catch (error) {
    console.error("[SEO] Erro:", error);
    res.status(500).send("Erro interno.");
  }
});

// Checkout Unificado (Lida com Cliente, Pedido e Pix)
app.post("/api/pagamento/pix", async (req, res) => {
  try {
    const { rifa_id, cliente, numeros } = req.body;
    
    // 1. Validar Configuração
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "Configuração do Supabase ausente no servidor." });
    }

    if (!rifa_id || !cliente || !numeros) {
      return res.status(400).json({ error: "Dados incompletos para o checkout." });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Identificar ou Criar Cliente (Bypass RLS)
    const cpfLimpo = cliente.cpf.replace(/\D/g, "");
    let clienteId;

    const { data: existingCliente } = await supabaseAdmin
      .from("clientes")
      .select("id")
      .eq("cpf", cpfLimpo)
      .maybeSingle();

    if (existingCliente) {
      clienteId = existingCliente.id;
    } else {
      const { data: newCliente, error: clientError } = await supabaseAdmin
        .from("clientes")
        .insert({
          nome_completo: cliente.nome,
          cpf: cpfLimpo,
          email: cliente.email,
          telefone: cliente.telefone
        })
        .select()
        .single();
      if (clientError) throw clientError;
      clienteId = newCliente.id;
    }

    // 3. Buscar Dados da Rifa e Criar Pedido
    const { data: rifa } = await supabaseAdmin
      .from("rifas")
      .select("valor_numero, timeout_reserva")
      .eq("id", rifa_id)
      .single();
    
    const valorTotal = numeros.length * (rifa?.valor_numero || 0);
    const timeout = rifa?.timeout_reserva || 15; // Padrão 15 min
    const expiraEm = new Date();
    expiraEm.setMinutes(expiraEm.getMinutes() + timeout);

    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from("pedidos")
      .insert({
        rifa_id,
        cliente_id: clienteId,
        numeros,
        quantidade: numeros.length,
        valor_total: valorTotal,
        status: "pendente",
        expira_em: expiraEm.toISOString()
      })
      .select()
      .single();
    
    if (pedidoError) throw pedidoError;

    // 4. Reservar Números (UPSERT para garantir que o registro exista)
    const numerosParaReservar = numeros.map((num: number) => ({
      rifa_id,
      numero: num,
      status: "reservado",
      pedido_id: pedido.id
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("numeros_rifa")
      .upsert(numerosParaReservar, { onConflict: "rifa_id,numero" });

    if (upsertError) throw upsertError;

    // 5. Mercado Pago Checkout
    const { data: config } = await supabaseAdmin.from("configuracoes").select("mp_access_token").eq("id", 1).single();
    if (!config?.mp_access_token) throw new Error("Mercado Pago não configurado no banco.");

    const mpClient = new MercadoPagoConfig({ accessToken: config.mp_access_token });
    const payment = new Payment(mpClient);
    
    const mpResponse = await payment.create({
      body: {
        transaction_amount: valorTotal,
        description: `Rifa - Pedido ${pedido.id.substring(0, 8)}`,
        payment_method_id: "pix",
        payer: {
          email: cliente.email,
          first_name: cliente.nome.split(" ")[0],
          last_name: cliente.nome.split(" ").slice(1).join(" "),
          identification: { type: "CPF", number: cpfLimpo }
        }
      }
    });

    // 6. Atualizar Pedido com Pix
    await supabaseAdmin.from("pedidos").update({
      mp_payment_id: mpResponse.id?.toString(),
      mp_qr_code: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64,
      mp_pix_copy_paste: mpResponse.point_of_interaction?.transaction_data?.qr_code
    }).eq("id", pedido.id);

    res.json({
      qr_code_base64: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64,
      qr_code: mpResponse.point_of_interaction?.transaction_data?.qr_code,
      payment_id: mpResponse.id,
      pedido_id: pedido.id
    });

  } catch (error: any) {
    console.error("ERRO CRITICO NO CHECKOUT:", error);
    res.status(500).json({ error: error.message || "Erro interno" });
  }
});

// STATUS WEBHOOKS
app.get("/api/pagamento/status/:pedido_id", async (req, res) => {
  try {
    const { pedido_id } = req.params;
    const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await supabaseAdmin.from("pedidos").select("status").eq("id", pedido_id).single();
    res.json({ status: data?.status });
  } catch (error) { res.status(500).json({ error: "Erro" }); }
});

app.post("/api/webhooks/mercadopago", async (req, res) => {
  try {
    const { action, data } = req.body;
    console.log(`[WEBHOOK] Evento: ${action} | ID: ${data?.id}`);

    if (action === "payment.updated" || action === "payment.created") {
      const paymentId = data?.id;
      const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      
      const { data: config } = await supabaseAdmin.from("configuracoes").select("mp_access_token").single();
      const payment = new Payment(new MercadoPagoConfig({ accessToken: config!.mp_access_token }));
      const info = await payment.get({ id: paymentId });

      if (info.status === "approved") {
        console.log(`[WEBHOOK] Pagamento ${paymentId} APROVADO. Atualizando banco...`);
        const { data: p } = await supabaseAdmin.from("pedidos").select("id").eq("mp_payment_id", paymentId.toString()).single();
        
        if (p) {
          // 1. Marcar pedido como pago e salvar o ID do comprovante
          const updateData: any = { 
            status: "pago", 
            pago_em: new Date().toISOString(),
            mp_payment_id: paymentId.toString()
          };

          await supabaseAdmin.from("pedidos").update(updateData).eq("id", p.id);
          
          // 2. Marcar números como vendidos
          const { error: numErr } = await supabaseAdmin.from("numeros_rifa").update({ status: "vendido" }).eq("pedido_id", p.id);
          
          if (!numErr) {
            console.log(`[WEBHOOK] Sucesso! Pedido ${p.id} pago e números VENDIDOS.`);
          } else {
          }
        }
      }
    }
  } catch (e) {
    console.error(`[WEBHOOK] Falha crítica:`, e);
  }
  res.send("OK");
});

// INICIALIZAÇÃO LOCAL (Vite somente aqui)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  
  // Importação dinâmica do Vite para não quebrar o Vercel
  const { createServer: createViteServer } = await import("vite");
  
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  
  app.use(vite.middlewares);
  
  app.listen(PORT, () => {
    console.log(`[LOCAL] Servidor rodando em http://localhost:${PORT}`);
  });
}

export default app;

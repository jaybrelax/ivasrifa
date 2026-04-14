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

// Rota de Teste Health
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    mode: process.env.VERCEL ? "serverless" : "local",
    time: new Date().toISOString()
  });
});

// --- INJEÇÃO DE SEO PARA CRAWLERS (Chamado pelo Middleware) ---
app.get("/api-seo/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).send("Configuração ausente.");
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let query = supabaseAdmin.from("rifas").select("*");
    query = isUuid ? query.eq("id", id) : query.eq("slug", id);
    const { data: rifa } = await query.single();
    
    if (!rifa) {
      return res.status(404).send("Rifa não encontrada.");
    }

    const { data: config } = await supabaseAdmin.from("vw_configuracoes_publicas").select("*").eq("id", 1).single();

    const title = `${rifa.titulo} - ${config?.nome_sistema || "Sorteios Online"}`;
    const description = (rifa.descricao || "").substring(0, 160).replace(/["']/g, "");
    const image = rifa.imagem_url || "";
    const siteUrl = `https://${req.get('host')}/${rifa.slug || rifa.id}`;

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

// Checkout Unificado
app.post("/api/pagamento/pix", async (req, res) => {
  try {
    const { rifa_id, cliente, numeros, vendedor_ref } = req.body;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: "Configuração do Supabase ausente." });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

    const { data: rifa } = await supabaseAdmin
      .from("rifas")
      .select("valor_numero, timeout_reserva")
      .eq("id", rifa_id)
      .single();
    
    const valorTotal = numeros.length * (rifa?.valor_numero || 0);
    const timeout = rifa?.timeout_reserva || 15;
    const expiraEm = new Date();
    expiraEm.setMinutes(expiraEm.getMinutes() + timeout);

    let vendedorIdDB = null;
    if (vendedor_ref) {
      // Buscar o Guardião (Vendedor) dono desse Ref Code
      const { data: vInfo } = await supabaseAdmin
        .from('vendedores')
        .select('id')
        .eq('codigo_ref', vendedor_ref)
        .maybeSingle();
      if (vInfo) vendedorIdDB = vInfo.id;
    }

    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from("pedidos")
      .insert({
        rifa_id,
        cliente_id: clienteId,
        vendedor_id: vendedorIdDB,
        numeros,
        quantidade: numeros.length,
        valor_total: valorTotal,
        status: "pendente",
        expira_em: expiraEm.toISOString()
      })
      .select()
      .single();
    
    if (pedidoError) throw pedidoError;

    const numerosParaReservar = numeros.map((num: number) => ({
      rifa_id,
      numero: num,
      status: "reservado",
      pedido_id: pedido.id
    }));

    await supabaseAdmin
      .from("numeros_rifa")
      .upsert(numerosParaReservar, { onConflict: "rifa_id,numero" });

    const { data: config } = await supabaseAdmin.from("configuracoes").select("mp_access_token").eq("id", 1).single();
    if (!config?.mp_access_token) throw new Error("Mercado Pago não configurado.");

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
    console.error("ERRO CRITICO:", error);
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
    if (action === "payment.updated" || action === "payment.created") {
      const paymentId = data?.id;
      const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data: config } = await supabaseAdmin.from("configuracoes").select("mp_access_token").single();
      const payment = new Payment(new MercadoPagoConfig({ accessToken: config!.mp_access_token }));
      const info = await payment.get({ id: paymentId });

      if (info.status === "approved") {
        const { data: p } = await supabaseAdmin.from("pedidos").select("id").eq("mp_payment_id", paymentId.toString()).single();
        if (p) {
          await supabaseAdmin.from("pedidos").update({ 
            status: "pago", 
            pago_em: new Date().toISOString() 
          }).eq("id", p.id);
          await supabaseAdmin.from("numeros_rifa").update({ status: "vendido" }).eq("pedido_id", p.id);
        }
      }
    }
  } catch (e) {
    console.error(`[WEBHOOK] Erro:`, e);
  }
  res.send("OK");
});

// ── AUXILIARES ──
const BOT_USER_AGENTS = ['googlebot', 'bingbot', 'facebookexternalhit', 'whatsapp', 'twitterbot', 'discordapp.com'];
function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

// ── CONFIGURAÇÃO DE AMBIENTE ──

// 1. Estáticos do Build (Apenas em Produção Vercel)
if (process.env.VERCEL) {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath, { index: false }));
}

// 2. Vite Middleware (Apenas Local)
if (!process.env.VERCEL) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

// ── CATCH-ALL (SPA + SEO) ──
// Deve ficar por último para não interceptar arquivos estáticos ou rotas de API
app.get("*", async (req, res) => {
  const reqPath = req.path;
  const userAgent = req.headers["user-agent"] || "";

  // Se for um pedido de arquivo (contém ponto) e chegou aqui, é 404
  if (reqPath.includes(".") && !reqPath.endsWith(".html")) {
    return res.status(404).send("Not found");
  }

  // SEO para Bots em rotas de rifa
  const isRifaRoute = reqPath !== "/" && !reqPath.startsWith("/admin") && !reqPath.startsWith("/minhas-compras") && !reqPath.startsWith("/api");
  if (isBot(userAgent) && isRifaRoute) {
    try {
      const slug = reqPath.substring(1).split("/")[0];
      const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      let query = supabaseAdmin.from("rifas").select("*");
      query = isUuid ? query.eq("id", slug) : query.eq("slug", slug);
      const { data: rifa } = await query.single();

      if (rifa) {
        const { data: config } = await supabaseAdmin.from("vw_configuracoes_publicas").select("*").eq("id", 1).single();
        const title = `${rifa.titulo} - ${config?.nome_sistema || "Sorteios Online"}`;
        const description = (rifa.descricao || "").substring(0, 160).replace(/["']/g, "");
        const image = rifa.imagem_url || "";
        return res.send(`<!DOCTYPE html><html><head><title>${title}</title><meta property="og:image" content="${image}"></head><body><h1>${title}</h1></body></html>`);
      }
    } catch (e) {}
  }

  // Fallback para index.html
  const distIndex = path.join(process.cwd(), "dist", "index.html");
  const rootIndex = path.join(process.cwd(), "index.html");
  
  if (fs.existsSync(distIndex)) return res.sendFile(distIndex);
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  
  res.status(404).send("Página não encontrada");
});

// Inicialização Local
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`[LOCAL] Servidor em http://localhost:${PORT}`));
}

export default app;

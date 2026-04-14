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

// Helper para gerar ID secundário aleatório
function gerarDisplayId(tamanho: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removido I, O, 0, 1 para evitar confusão
  let result = '';
  for (let i = 0; i < tamanho; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Rota de Teste Health
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    mode: process.env.VERCEL ? "serverless" : "local",
    time: new Date().toISOString()
  });
});

// Helper Evolution API
async function enviarMensagemWhatsApp(telefone: string, texto: string) {
  try {
    const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: config } = await supabaseAdmin.from("configuracoes").select("*").eq("id", 1).single();

    if (!config?.evolution_enabled || !config?.evolution_api_url || !config?.evolution_api_key || !config?.evolution_instance) {
      console.log("[Evolution] Envio IGNORADO. Verifique se evolution_enabled está marcado e se URL, KEY e INSTANCE estão preenchidas no banco.");
      return;
    }

    const numLimpo = telefone.replace(/\D/g, "");
    if (!numLimpo.startsWith("55")) {
      // Adiciona 55 se não houver
      telefone = "55" + numLimpo;
    } else {
      telefone = numLimpo;
    }

    // Normalizar URL (remover barra final se houver)
    const baseUrl = config.evolution_api_url.endsWith('/') 
      ? config.evolution_api_url.slice(0, -1) 
      : config.evolution_api_url;

    const url = `${baseUrl}/message/sendText/${config.evolution_instance}`;
    
    console.log(`[Evolution] Tentando enviar para ${telefone} via ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.evolution_api_key
      },
      body: JSON.stringify({
        number: telefone,
        text: texto,
        linkPreview: false
      })
    });

    const resData = await response.json();

    if (response.ok) {
      console.log(`[Evolution] Mensagem enviada com sucesso para ${telefone}`);
    } else {
      console.error(`[Evolution] Erro da API (${response.status}):`, resData);
    }
  } catch (error) {
    console.error("[Evolution] Erro crítico no processo de envio:", error);
  }
}

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
      clienteId = newCliente.id;
    }

    // 0. Limpeza: Cancelar pedidos PENDENTES anteriores desse cliente para esta rifa
    // Isso evita que o cliente receba múltiplas notificações ou tenha vários pedidos "fantasmas"
    const { data: oldOrders } = await supabaseAdmin
      .from("pedidos")
      .select("id")
      .eq("cliente_id", clienteId)
      .eq("rifa_id", rifa_id)
      .eq("status", "pendente");

    if (oldOrders && oldOrders.length > 0) {
      const oldIds = oldOrders.map(o => o.id);
      await supabaseAdmin.from("pedidos").update({ status: "cancelado" }).in("id", oldIds);
      // Liberar os números vinculados a esses pedidos cancelados
      await supabaseAdmin
        .from("numeros_rifa")
        .update({ status: "disponivel", pedido_id: null })
        .in("pedido_id", oldIds);
    }

    const { data: rifa } = await supabaseAdmin
      .from("rifas")
      .select("titulo, valor_numero, timeout_reserva, off_price, qtd_off")
      .eq("id", rifa_id)
      .single();
    
    let precoUnitario = Number(rifa?.valor_numero || 0);
    
    // Aplicar preço promocional se a quantidade for atingida
    if (rifa?.off_price && rifa?.qtd_off && numeros.length >= rifa.qtd_off) {
      precoUnitario = Number(rifa.off_price);
    }
    
    const valorTotal = numeros.length * precoUnitario;
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

    const displayId = gerarDisplayId();

    // 1. Verificar se os números ainda estão disponíveis
    const { data: numCheck } = await supabaseAdmin
      .from("numeros_rifa")
      .select("numero")
      .eq("rifa_id", rifa_id)
      .in("numero", numeros)
      .not("status", "eq", "disponivel");

    if (numCheck && numCheck.length > 0) {
      return res.status(400).json({ error: "Alguns números selecionados já foram reservados." });
    }

    // 2. Tentar criar o pagamento no Mercado Pago primeiro
    const { data: config } = await supabaseAdmin.from("configuracoes").select("mp_access_token").eq("id", 1).single();
    if (!config?.mp_access_token) throw new Error("Mercado Pago não configurado.");

    const mpClient = new MercadoPagoConfig({ accessToken: config.mp_access_token });
    const payment = new Payment(mpClient);
    
    // Usamos o displayId na descrição para identificação precoce
    const mpResponse = await payment.create({
      body: {
        transaction_amount: valorTotal,
        description: `Rifa - Pedido ${displayId}`,
        payment_method_id: "pix",
        payer: {
          email: cliente.email,
          first_name: cliente.nome.split(" ")[0],
          last_name: cliente.nome.split(" ").slice(1).join(" "),
          identification: { type: "CPF", number: cpfLimpo }
        }
      }
    });

    if (!mpResponse.id) {
      throw new Error("Falha ao gerar o PIX no Mercado Pago.");
    }

    // 3. Se o PIX foi gerado, a gente CRIA o pedido e RESERVA os números
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
        expira_em: expiraEm.toISOString(),
        display_id: displayId,
        mp_payment_id: mpResponse.id.toString(),
        mp_qr_code: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64,
        mp_pix_copy_paste: mpResponse.point_of_interaction?.transaction_data?.qr_code
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

    // Envio do WhatsApp (PIX Gerado) - DUAS MENSAGENS SEPARADAS
    const pedidoIdCurto = displayId;
    const msgPix = `📌 *PEDIDO REALIZADO: #${pedidoIdCurto}*\n\nOlá *${cliente.nome}*!\n\nSua reserva para a rifa *${rifa?.titulo || 'Sorteio'}* foi gerada com sucesso.\n\n🔢 *NÚMEROS:* ${numeros.join(', ')}\n💰 *TOTAL:* R$ ${valorTotal.toFixed(2).replace('.', ',')}\n\n⚠️ _Sua reserva expira em ${timeout} minutos._\n\n*O código PIX será enviado na próxima mensagem para facilitar a cópia.*`;
    
    const pixCopiaCola = mpResponse.point_of_interaction?.transaction_data?.qr_code;

    // Helper para delay
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    console.log(`[WhatsApp] Enviando mensagem de resumo para #${pedidoIdCurto}...`);
    await enviarMensagemWhatsApp(cliente.telefone, msgPix);
    
    if (pixCopiaCola) {
      console.log(`[WhatsApp] Aguardando 2s para enviar o código PIX isolado...`);
      await wait(2000); // Aumentado para 2 segundos para garantir a separação total
      console.log(`[WhatsApp] Enviando código PIX Copia e Cola...`);
      await enviarMensagemWhatsApp(cliente.telefone, pixCopiaCola.trim());
    }

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

          // Buscar dados do pedido para enviar WhatsApp de confirmação
          const { data: pedidoFull } = await supabaseAdmin
            .from("pedidos")
            .select("*, cliente:clientes(nome_completo, telefone), rifa:rifas(titulo)")
            .eq("id", p.id)
            .single();

          if (pedidoFull?.cliente) {
            const pedidoIdCurto = pedidoFull.display_id || pedidoFull.id.substring(0, 8).toUpperCase();
            const msgConfirm = `✅ *PAGAMENTO CONFIRMADO!*\n\nOlá *${pedidoFull.cliente.nome_completo}*!\n\nConfirmamos o pagamento do seu pedido *#${pedidoIdCurto}*.\n\n🎉 *RIFA:* ${pedidoFull.rifa?.titulo}\n🎫 *SEUS NÚMEROS:* ${pedidoFull.numeros.join(', ')}\n\nBoa sorte! Agora é só torcer! 🍀`;
            await enviarMensagemWhatsApp(pedidoFull.cliente.telefone, msgConfirm);
          }
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
  const isDev = !process.env.VERCEL && process.env.NODE_ENV !== 'production';
  const rootIndex = path.join(process.cwd(), "index.html");
  const distIndex = path.join(process.cwd(), "dist", "index.html");

  if (isDev) {
    if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  } else {
    if (fs.existsSync(distIndex)) return res.sendFile(distIndex);
    if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  }
  
  res.status(404).send("Página não encontrada");
});

// Inicialização Local
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`[LOCAL] Servidor em http://localhost:${PORT}`));
}

export default app;

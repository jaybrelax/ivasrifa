import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, Payment } from "mercadopago";
import dotenv from "dotenv";
import fs from "node:fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Proxy para testar webhook (evitar CORS no front)
app.post("/api/webhook-test-proxy", async (req, res) => {
  console.log("[DEBUG] Proxy Webhook disparado para:", req.body.url);
  try {
    const { url, payload } = req.body;
    if (!url) return res.status(400).json({ error: "URL ausente" });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      res.json({ success: true });
    } else {
      const status = response.status;
      res.status(status).json({ error: `Erro no Webhook: Status ${status}` });
    }
  } catch (error: any) {
    console.error("[DEBUG] Erro no Proxy:", error);
    res.status(500).json({ error: error.message });
  }
});

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
      telefone = "55" + numLimpo;
    } else {
      telefone = numLimpo;
    }

    const baseUrl = config.evolution_api_url.endsWith('/') 
      ? config.evolution_api_url.slice(0, -1) 
      : config.evolution_api_url;

    const url = `${baseUrl}/message/sendText/${config.evolution_instance}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.evolution_api_key
      },
      body: JSON.stringify({
        number: telefone,
        text: texto,
        linkPreview: false,
        delay: 1500
      })
    });

    if (!response.ok) {
      const resData = await response.json();
      console.error(`[Evolution] Erro da API (${response.status}) para ${telefone}:`, JSON.stringify(resData));
    }
  } catch (error) {
    console.error("[Evolution] Erro crítico no processo de envio para " + telefone + ":", error);
  }
}

// --- API ROUTES ---

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

    // 0. Limpeza: Cancelar pedidos PENDENTES anteriores desse cliente para esta rifa
    const { data: oldOrders } = await supabaseAdmin
      .from("pedidos")
      .select("id")
      .eq("cliente_id", clienteId)
      .eq("rifa_id", rifa_id)
      .eq("status", "pendente");

    if (oldOrders && oldOrders.length > 0) {
      const oldIds = oldOrders.map(o => o.id);
      await supabaseAdmin.from("pedidos").update({ status: "cancelado" }).in("id", oldIds);
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
    if (rifa?.off_price && rifa?.qtd_off && numeros.length >= rifa.qtd_off) {
      precoUnitario = Number(rifa.off_price);
    }
    
    const valorTotal = numeros.length * precoUnitario;
    const timeout = rifa?.timeout_reserva || 15;
    const expiraEm = new Date();
    expiraEm.setMinutes(expiraEm.getMinutes() + timeout);

    let vendedorIdDB = null;
    let vendaDireta = false;
    
    if (vendedor_ref) {
      const { data: vInfo } = await supabaseAdmin.from('vendedores').select('id').eq('codigo_ref', vendedor_ref).maybeSingle();
      if (vInfo) vendedorIdDB = vInfo.id;
    } else {
      vendaDireta = true;
      // Checa se a distribuição aleatória está ligada
      const { data: configDist } = await supabaseAdmin.from("configuracoes").select("distribuicao_aleatoria_guardiao").eq("id", 1).single();
      
      if (configDist?.distribuicao_aleatoria_guardiao) {
        // Busca todos os vendedores ativos
        const { data: vendedoresAtivos } = await supabaseAdmin.from('vendedores').select('id').eq('ativo', true);
        if (vendedoresAtivos && vendedoresAtivos.length > 0) {
          const randomIndex = Math.floor(Math.random() * vendedoresAtivos.length);
          vendedorIdDB = vendedoresAtivos[randomIndex].id;
        }
      }
    }

    const displayId = gerarDisplayId();

    const { data: numCheck } = await supabaseAdmin
      .from("numeros_rifa")
      .select("numero")
      .eq("rifa_id", rifa_id)
      .in("numero", numeros)
      .not("status", "eq", "disponivel");

    if (numCheck && numCheck.length > 0) {
      return res.status(400).json({ error: "Alguns números selecionados já foram reservados segundos antes, volte para selecionar outros números." });
    }

    const { data: config } = await supabaseAdmin.from("configuracoes").select("mp_access_token").eq("id", 1).single();
    if (!config?.mp_access_token) throw new Error("Mercado Pago não configurado.");

    const mpClient = new MercadoPagoConfig({ accessToken: config.mp_access_token });
    const payment = new Payment(mpClient);
    
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

    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from("pedidos")
      .insert({
        rifa_id,
        cliente_id: clienteId,
        vendedor_id: vendedorIdDB,
        venda_direta: vendaDireta,
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

    // ✅ Responde IMEDIATAMENTE com o QR Code — não espera o WhatsApp
    res.json({
      qr_code_base64: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64,
      qr_code: mpResponse.point_of_interaction?.transaction_data?.qr_code,
      payment_id: mpResponse.id,
      pedido_id: pedido.id
    });

    // 📲 Envia WhatsApp em background (não bloqueia a resposta)
    const pixCode = mpResponse.point_of_interaction?.transaction_data?.qr_code;
    const msgPix = `📌 *PEDIDO REALIZADO: #${displayId}*\n\nOlá *${cliente.nome}*!\n\nSua reserva para a rifa *${rifa?.titulo || 'Sorteio'}* foi gerada com sucesso.\n\n🔢 *NÚMEROS:* ${numeros.join(', ')}\n💰 *TOTAL:* R$ ${valorTotal.toFixed(2).replace('.', ',')}\n\n⚠️ _Sua reserva expira em ${timeout} minutos._\n\n*💸 CÓDIGO PIX COPIA E COLA:* 👇`;

    enviarMensagemWhatsApp(cliente.telefone, msgPix).then(async () => {
      if (pixCode) {
        await new Promise(r => setTimeout(r, 2000));
        await enviarMensagemWhatsApp(cliente.telefone, pixCode.trim());
      }
    }).catch(err => console.error("[WhatsApp Background] Erro:", err));
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
    const paymentId = data?.id;
    console.log(`[MP Webhook] Recebido: ${action} | ID: ${paymentId}`);

    if (action === "payment.updated" || action === "payment.created") {
      const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data: config } = await supabaseAdmin.from("configuracoes").select("mp_access_token, webhook_pago").single();
      const payment = new Payment(new MercadoPagoConfig({ accessToken: config!.mp_access_token }));
      const info = await payment.get({ id: paymentId });

      console.log(`[MP Webhook] Status MP para ${paymentId}: ${info.status}`);
      
      if (info.status === "approved") {
        const { data: p } = await supabaseAdmin.from("pedidos").select("id").eq("mp_payment_id", paymentId.toString()).single();
        console.log(`[MP Webhook] Pedido no DB encontrado:`, p ? "SIM" : "NÃO");
        
        if (p) {
          const pixTransactionId = (info as any).point_of_interaction?.transaction_data?.transaction_id;
          await supabaseAdmin.from("pedidos").update({ 
            status: "pago", 
            pago_em: new Date().toISOString(),
            pix_transaction_id: pixTransactionId
          }).eq("id", p.id);
          await supabaseAdmin.from("numeros_rifa").update({ status: "vendido" }).eq("pedido_id", p.id);

          const { data: pedidoFull } = await supabaseAdmin
            .from("pedidos")
            .select("*, cliente:clientes(nome_completo, telefone, cpf, email), rifa:rifas(id, titulo), vendedor:vendedores(nome, whatsapp)")
            .eq("id", p.id)
            .single();

          if (pedidoFull) {
            const pedidoIdCurto = pedidoFull.display_id || pedidoFull.id.substring(0, 8).toUpperCase();
            
            // 1. O POST para o Webhook Pago agora é feito via Supabase Edge Function e Database Trigger.
            // Isso garante entrega instantânea e zero timeouts da Vercel.

            // 2. Envio de WhatsApp de Confirmação (Se houver telefone)
            if (pedidoFull.cliente?.telefone) {
              const msgConfirm = `✅ *PAGAMENTO CONFIRMADO!*\n\nOlá *${pedidoFull.cliente.nome_completo}*!\n\nConfirmamos o pagamento do seu pedido *#${pedidoIdCurto}*.\n\n🎉 *RIFA:* ${pedidoFull.rifa?.titulo}\n🎫 *SEUS NÚMEROS:* ${pedidoFull.numeros.join(', ')}\n\nBoa sorte!🍀`;
              await enviarMensagemWhatsApp(pedidoFull.cliente.telefone, msgConfirm);

              // Bônus
              const { data: bonusPremios } = await supabaseAdmin.from("premios").select("titulo, link_bonus").eq("rifa_id", pedidoFull.rifa_id).eq("is_bonus", true).not("link_bonus", "is", null);
              if (bonusPremios) {
                for (const bonus of bonusPremios) {
                  if (bonus.link_bonus) {
                    await new Promise(r => setTimeout(r, 3000));
                    await enviarMensagemWhatsApp(pedidoFull.cliente.telefone, `🎁 *SEU BÔNUS:*\n\n🚀 *${bonus.titulo}:*\n${bonus.link_bonus}`);
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (e) { console.error(`[WEBHOOK] Erro:`, e); }
  res.send("OK");
});

// ── CONFIGURAÇÃO DE AMBIENTE ──

if (process.env.VERCEL) {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath, { index: false }));
}

if (!process.env.VERCEL) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

// Catch-all para SPA
app.get("*", async (req, res) => {
  const isDev = !process.env.VERCEL && process.env.NODE_ENV !== 'production';
  const rootIndex = path.join(process.cwd(), "index.html");
  const distIndex = path.join(process.cwd(), "dist", "index.html");

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (isDev) {
    if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  } else {
    if (fs.existsSync(distIndex)) return res.sendFile(distIndex);
    if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  }
  
  res.status(404).send("Página não encontrada");
});

// Inicialização
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`[ADMIN API] Servidor em http://localhost:${PORT}`));
}

export default app;

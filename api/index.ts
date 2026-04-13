import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, Payment } from "mercadopago";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

async function startServer() {
  const PORT = process.env.PORT || 3000;

  console.log("Configurando servidor (Plano B)...");
  
  app.use(express.json());

  // Rota de Teste Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: "serverless", env: process.env.NODE_ENV });
  });

  // API Routes
  // Nova Rota de Checkout Completa (Resolve problemas de RLS)
  app.post("/api/pagamento/pix", async (req, res) => {
    try {
      const { rifa_id, cliente, numeros } = req.body;
      
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ 
          error: "Variáveis de ambiente do Supabase não configuradas no Vercel.",
          detalhes: "Verifique VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY"
        });
      }

      if (!rifa_id || !cliente || !numeros) {
        return res.status(400).json({ error: "Dados incompletos para o checkout" });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // 1. Identificar ou Criar Cliente (Bypassing RLS)
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

      // 2. Buscar dados da Rifa para cálculo de valor
      const { data: rifa } = await supabaseAdmin.from("rifas").select("valor_numero").eq("id", rifa_id).single();
      const valorTotal = numeros.length * (rifa?.valor_numero || 0);

      // 3. Criar Pedido (Bypassing RLS)
      const { data: pedido, error: pedidoError } = await supabaseAdmin
        .from("pedidos")
        .insert({
          rifa_id,
          cliente_id: clienteId,
          numeros,
          quantidade: numeros.length,
          valor_total: valorTotal,
          status: "pendente"
        })
        .select()
        .single();
      
      if (pedidoError) throw pedidoError;

      // 4. Reservar Números (Bypassing RLS)
      await supabaseAdmin
        .from("numeros_rifa")
        .update({ status: "reservado", pedido_id: pedido.id })
        .eq("rifa_id", rifa_id)
        .in("numero", numeros);

      // 5. Buscar Token Mercado Pago
      const { data: config } = await supabaseAdmin.from("configuracoes").select("mp_access_token").eq("id", 1).single();
      if (!config?.mp_access_token) throw new Error("Mercado Pago não configurado");

      // 6. Gerar Pix no Mercado Pago
      const mpClient = new MercadoPagoConfig({ accessToken: config.mp_access_token });
      const payment = new Payment(mpClient);
      const paymentData = {
        transaction_amount: valorTotal,
        description: `Compra de Rifa - Pedido ${pedido.id.substring(0, 8)}`,
        payment_method_id: "pix",
        payer: {
          email: cliente.email,
          first_name: cliente.nome.split(" ")[0],
          last_name: cliente.nome.split(" ").slice(1).join(" "),
          identification: { type: "CPF", number: cpfLimpo }
        }
      };

      const mpResponse = await payment.create({ body: paymentData });

      // 7. Salvar IDs de pagamento no pedido
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
      console.error("Erro no Checkout:", error);
      res.status(500).json({ error: error.message || "Erro interno no checkout" });
    }
  });

  // Rota de Status
  app.get("/api/pagamento/status/:pedido_id", async (req, res) => {
    try {
      const { pedido_id } = req.params;
      const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const { data: pedido } = await supabaseAdmin.from("pedidos").select("status").eq("id", pedido_id).single();
      res.json({ status: pedido?.status });
    } catch (error) {
      res.status(500).json({ error: "Erro ao consultar status" });
    }
  });

  // Webhook
  app.post("/api/webhooks/mercadopago", async (req, res) => {
    try {
      const { action, data } = req.body;
      if (action === "payment.updated" || action === "payment.created") {
        const paymentId = data?.id;
        const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        const { data: config } = await supabaseAdmin.from("configuracoes").select("mp_access_token").eq("id", 1).single();
        
        const client = new MercadoPagoConfig({ accessToken: config!.mp_access_token });
        const payment = new Payment(client);
        const paymentInfo = await payment.get({ id: paymentId });

        if (paymentInfo.status === "approved") {
          const { data: pedidoExistente } = await supabaseAdmin.from("pedidos").select("id, status").eq("mp_payment_id", paymentId.toString()).single();
          if (pedidoExistente && pedidoExistente.status !== 'pago') {
            await supabaseAdmin.from("pedidos").update({ status: "pago", pago_em: new Date().toISOString() }).eq("id", pedidoExistente.id);
            await supabaseAdmin.from("numeros_rifa").update({ status: "vendido" }).eq("pedido_id", pedidoExistente.id);
          }
        }
      }
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).send("Internal Error");
    }
  });

  // Somente roda o listen se não estiver no Vercel (Development local)
  if (!process.env.VERCEL) {
    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server development running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;

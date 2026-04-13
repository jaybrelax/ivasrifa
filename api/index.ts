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
  app.post("/api/pagamento/pix", async (req, res) => {
    try {
      const { pedido_id } = req.body;
      if (!pedido_id) return res.status(400).json({ error: "pedido_id é obrigatório" });

      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ error: "Erro de configuração do servidor" });

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: config } = await supabaseAdmin.from("configuracoes").select("mp_access_token").eq("id", 1).single();
      if (!config?.mp_access_token) return res.status(500).json({ error: "Token do Mercado Pago não configurado" });

      const { data: pedido } = await supabaseAdmin.from("pedidos").select(`*, cliente:clientes (nome_completo, email, cpf)`).eq("id", pedido_id).single();
      if (!pedido) return res.status(404).json({ error: "Pedido não encontrado" });

      const client = new MercadoPagoConfig({ accessToken: config.mp_access_token });
      const payment = new Payment(client);
      const paymentData = {
        transaction_amount: Number(pedido.valor_total),
        description: `Rifa Online - Pedido ${pedido.id.substring(0, 8)}`,
        payment_method_id: "pix",
        payer: {
          email: pedido.cliente.email,
          first_name: pedido.cliente.nome_completo.split(" ")[0],
          last_name: pedido.cliente.nome_completo.split(" ").slice(1).join(" "),
          identification: { type: "CPF", number: pedido.cliente.cpf.replace(/\D/g, "") }
        }
      };

      const mpResponse = await payment.create({ body: paymentData });
      await supabaseAdmin.from("pedidos").update({
        mp_payment_id: mpResponse.id?.toString(),
        mp_qr_code: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64,
        mp_pix_copy_paste: mpResponse.point_of_interaction?.transaction_data?.qr_code
      }).eq("id", pedido_id);

      res.json({
        qr_code_base64: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64,
        qr_code: mpResponse.point_of_interaction?.transaction_data?.qr_code,
        payment_id: mpResponse.id
      });
    } catch (error: any) {
      console.error("Erro no Pix:", error);
      res.status(500).json({ error: error.message });
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

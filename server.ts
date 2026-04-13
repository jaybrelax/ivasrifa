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

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("Configurando servidor...");
  console.log("Variáveis de ambiente carregadas:", {
    supabaseUrl: !!process.env.VITE_SUPABASE_URL,
    supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });

  app.use(express.json());

  // API Routes
  app.post("/api/pagamento/pix", async (req, res) => {
    try {
      const { pedido_id } = req.body;

      if (!pedido_id) {
        return res.status(400).json({ error: "pedido_id é obrigatório" });
      }

      // 1. Initialize Supabase Admin Client
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Variáveis de ambiente do Supabase ausentes no servidor.");
        return res.status(500).json({ error: "Erro de configuração do servidor" });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // 2. Fetch Configurações (Mercado Pago Token)
      const { data: config, error: configError } = await supabaseAdmin
        .from("configuracoes")
        .select("mp_access_token")
        .eq("id", 1)
        .single();

      if (configError || !config?.mp_access_token) {
        console.error("Erro ao buscar token do Mercado Pago:", configError);
        return res.status(500).json({ error: "Token do Mercado Pago não configurado" });
      }

      // 3. Fetch Pedido and Cliente Details
      const { data: pedido, error: pedidoError } = await supabaseAdmin
        .from("pedidos")
        .select(`
          *,
          cliente:clientes (
            nome_completo,
            email,
            cpf
          )
        `)
        .eq("id", pedido_id)
        .single();

      if (pedidoError || !pedido) {
        console.error("Erro ao buscar pedido:", pedidoError);
        return res.status(404).json({ error: "Pedido não encontrado" });
      }

      // Verificação de segurança: Pedido já pago?
      if (pedido.status === 'pago') {
        return res.status(400).json({ error: "Este pedido já foi pago." });
      }

      // Se já tem um PIX gerado e não expirou, podemos retornar o mesmo (Opcional, mas aqui vamos gerar um novo para simplificar ou atualizar)

      // 4. Initialize Mercado Pago
      const client = new MercadoPagoConfig({ accessToken: config.mp_access_token });
      const payment = new Payment(client);

      // 5. Create PIX Payment
      const paymentData = {
        transaction_amount: Number(pedido.valor_total),
        description: `Rifa Online - Pedido ${pedido.id.substring(0, 8)}`,
        payment_method_id: "pix",
        payer: {
          email: pedido.cliente.email,
          first_name: pedido.cliente.nome_completo.split(" ")[0],
          last_name: pedido.cliente.nome_completo.split(" ").slice(1).join(" "),
          identification: {
            type: "CPF",
            number: pedido.cliente.cpf.replace(/\D/g, "")
          }
        }
      };

      const mpResponse = await payment.create({ body: paymentData });

      // 6. Update Pedido with PIX info
      const { error: updateError } = await supabaseAdmin
        .from("pedidos")
        .update({
          mp_payment_id: mpResponse.id?.toString(),
          mp_qr_code: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64,
          mp_pix_copy_paste: mpResponse.point_of_interaction?.transaction_data?.qr_code
        })
        .eq("id", pedido_id);

      if (updateError) {
        console.error("Erro ao atualizar pedido com dados do PIX:", updateError);
        // We still return the PIX data so the user can pay, even if saving failed (though ideally it shouldn't fail)
      }

      // 7. Return PIX data to frontend
      res.json({
        qr_code_base64: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64,
        qr_code: mpResponse.point_of_interaction?.transaction_data?.qr_code,
        payment_id: mpResponse.id
      });

    } catch (error: any) {
      console.error("Erro detalhado ao gerar PIX:", error);
      // Se for erro do Mercado Pago, a estrutura pode ser diferente
      const mpErrorMessage = error.response?.message || error.message;
      res.status(500).json({ error: `Erro no Mercado Pago: ${mpErrorMessage || "Erro interno"}` });
    }
  });

  // Rota para consulta manual de status (Fallback)
  app.get("/api/pagamento/status/:pedido_id", async (req, res) => {
    try {
      const { pedido_id } = req.params;
      
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);

      const { data: pedido, error } = await supabaseAdmin
        .from("pedidos")
        .select("status, mp_payment_id")
        .eq("id", pedido_id)
        .single();

      if (error || !pedido) return res.status(404).json({ error: "Pedido não encontrado" });

      res.json({ status: pedido.status });
    } catch (error) {
      res.status(500).json({ error: "Erro ao consultar status" });
    }
  });

  // Webhook Mercado Pago
  app.post("/api/webhooks/mercadopago", async (req, res) => {
    try {
      const { action, data } = req.body;
      
      // We only care about payment updates
      if (action === "payment.updated" || action === "payment.created") {
        const paymentId = data?.id;
        if (!paymentId) return res.status(400).send("No payment ID");

        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseServiceKey) {
          return res.status(500).send("Server configuration error");
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch MP Token
        const { data: config } = await supabaseAdmin
          .from("configuracoes")
          .select("mp_access_token")
          .eq("id", 1)
          .single();

        if (!config?.mp_access_token) {
          console.error("Webhook: Token MP não configurado");
          return res.status(500).send("No MP token configured");
        }

        console.log("--- NOVO WEBHOOK RECEBIDO ---");
        console.log(`Ação: ${action} | Pagamento ID: ${paymentId}`);

        // Verify Payment Status with Mercado Pago
        const client = new MercadoPagoConfig({ accessToken: config.mp_access_token });
        const payment = new Payment(client);
        const paymentInfo = await payment.get({ id: paymentId });

        if (paymentInfo.status === "approved") {
          console.log(`Pagamento ${paymentId} aprovado! Atualizando pedido...`);
          
          // Buscar o pedido pelo mp_payment_id
          const { data: pedidoExistente } = await supabaseAdmin
            .from("pedidos")
            .select("id, status")
            .eq("mp_payment_id", paymentId.toString())
            .single();

          if (pedidoExistente && pedidoExistente.status !== 'pago') {
            // Update Pedido status
            const { data: pedido, error: pedidoError } = await supabaseAdmin
              .from("pedidos")
              .update({ 
                status: "pago", 
                pago_em: new Date().toISOString() 
              })
              .eq("id", pedidoExistente.id)
              .select()
              .single();

            if (pedidoError) {
              console.error("Erro ao atualizar status do pedido:", pedidoError);
            } else if (pedido) {
              // Update Numeros status to 'vendido'
              const { error: numerosError } = await supabaseAdmin
                .from("numeros_rifa")
                .update({ status: "vendido" })
                .eq("pedido_id", pedido.id);

              if (numerosError) {
                console.error("Erro ao atualizar status dos números:", numerosError);
              } else {
                console.log(`Pedido ${pedido.id} e números atualizados com sucesso.`);
              }
            }
          } else {
            console.log(`Pedido ${paymentId} já estava pago ou não foi encontrado.`);
          }
        }
      }
      
      res.status(200).send("OK");
    } catch (error) {
      console.error("Erro no webhook do Mercado Pago:", error);
      res.status(500).send("Internal Server Error");
    }
  });

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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

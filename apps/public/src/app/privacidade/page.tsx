import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PrivacidadePage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-12 md:py-20 lg:py-24">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-[#1b5df1] transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para as rifas
        </Link>
      </div>

      <div className="prose prose-blue max-w-none bg-white p-8 md:p-12 rounded-[32px] shadow-sm border border-gray-100">
        <h1 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">Política de Privacidade</h1>
        
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">1. Introdução</h2>
          <p className="text-gray-600 leading-relaxed">A Privacidade e a Segurança dos dados de nossos usuários são prioridades fundamentais para a Rifa IVAS. Esta política descreve como coletamos, usamos e protegemos suas informações pessoais de acordo com a Lei Geral de Proteção de Dados (LGPD).</p>
        </section>
        
        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">2. Coleta de Dados</h2>
          <p className="text-gray-600 leading-relaxed">Coletamos apenas os dados necessários para o processamento de suas compras e comunicação sobre os sorteios:</p>
          <ul className="list-disc pl-5 mt-4 space-y-2 text-gray-600">
            <li><strong>Nome Completo:</strong> Para identificação do ganhador.</li>
            <li><strong>CPF:</strong> Para validação legal da compra e emissão de cobrança via PIX.</li>
            <li><strong>WhatsApp/Telefone:</strong> Para envio de comprovantes e contato prioritário em caso de sorteio.</li>
            <li><strong>E-mail (opcional):</strong> Para envio de notificações do sistema.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">3. Uso das Informações</h2>
          <p className="text-gray-600 leading-relaxed">Seus dados são utilizados exclusivamente para:</p>
          <ul className="list-disc pl-5 mt-4 space-y-2 text-gray-600">
            <li>Processar pagamentos via Mercado Pago.</li>
            <li>Garantir a integridade dos sorteios.</li>
            <li>Comunicar resultados e novidades da plataforma (podendo o usuário cancelar o recebimento a qualquer momento).</li>
            <li>Cumprir obrigações legais e regulatórias.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">4. Compartilhamento de Dados</h2>
          <p className="text-gray-600 leading-relaxed">A Rifa IVAS não comercializa seus dados pessoais. O compartilhamento ocorre apenas com parceiros essenciais:</p>
          <ul className="list-disc pl-5 mt-4 space-y-2 text-gray-600">
            <li><strong>Processadores de Pagamento (Mercado Pago):</strong> Para efetivar as transações.</li>
            <li><strong>Autoridades Governamentais:</strong> Quando exigido por lei.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">5. Segurança</h2>
          <p className="text-gray-600 leading-relaxed">Implementamos medidas de segurança técnicas e organizacionais para proteger seus dados contra acessos não autorizados e situações acidentais ou ilícitas de destruição, perda ou alteração. Utilizamos criptografia SSL em toda a navegação.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">6. Seus Direitos</h2>
          <p className="text-gray-600 leading-relaxed">Conforme a LGPD, você tem direito a confirmar a existência de tratamento, acessar seus dados, corrigir dados incompletos ou inexatos e solicitar a anonimização ou eliminação de dados desnecessários, desde que não haja obrigação legal de mantê-los.</p>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-bold text-slate-800 mb-4">7. Cookies</h2>
          <p className="text-gray-600 leading-relaxed">Utilizamos cookies apenas para melhorar a experiência do usuário e manter sessões ativas. Você pode configurar seu navegador para recusar cookies, mas algumas funcionalidades do site podem ser afetadas.</p>
        </section>

        <section className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pt-8 border-t border-gray-50">
          Última atualização: {new Date().toLocaleDateString('pt-BR')}
        </section>
      </div>
    </main>
  );
}

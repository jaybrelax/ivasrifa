import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, PartyPopper } from "lucide-react";
import { supabase } from "@/src/lib/supabase";

export default function Recrutamento() {
  const [searchParams] = useSearchParams();
  const rifaId = searchParams.get("rifa_id");
  const navigate = useNavigate();

  const [rifa, setRifa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    senha: "",
  });

  useEffect(() => {
    async function fetchRifa() {
      if (!rifaId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from("rifas").select("id, titulo").eq("id", rifaId).single();
      if (!error && data) {
        setRifa(data);
      }
      setLoading(false);
    }
    fetchRifa();
  }, [rifaId]);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rifa) return;
    setSubmitting(true);

    try {
      // 1. Criar usuário no auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.senha,
      });

      if (authError) throw authError;
      
      const userId = authData.user?.id;
      if (!userId) throw new Error("Erro ao gerar usuário de autenticação.");

      // Criar código base no CPF ou ID
      const cpfLimpo = formData.cpf.replace(/\D/g, "");
      const codigoBase = (formData.nome.split(" ")[0] + cpfLimpo.slice(-3)).toUpperCase();

      // 2. Criar ou Vincular Vendedor
      const { data: vendedorData, error: vendedorError } = await supabase
        .from('vendedores')
        .insert({
          nome: formData.nome,
          telefone: formData.telefone,
          comissao_padrao: 0, // Poderia ser configurável
          user_id: userId,
          codigo_ref: codigoBase
        })
        .select()
        .single();

      if (vendedorError) throw vendedorError;

      // 3. Vincular Guardião à Rifa
      const { error: relError } = await supabase
        .from('rifa_vendedores')
        .insert({
          rifa_id: rifa.id,
          vendedor_id: vendedorData.id
        });

      if (relError) throw relError;

      setStep(2);
    } catch (err: any) {
      alert("Erro ao cadastrar: " + (err.message || "Tente novamente."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  if (!rifa) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Rifa não encontrada</h2>
        <p className="text-gray-500 text-center max-w-md">O link de recrutamento fornecido é inválido. Peça um novo link ao organizador.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-6">
          <Shield className="h-12 w-12 text-blue-500 mx-auto mb-2" />
          <h1 className="text-3xl font-bold text-white tracking-tight">Guardiões</h1>
          <p className="text-blue-200 mt-1 uppercase text-xs font-bold tracking-widest">Plataforma de Afiliados</p>
        </div>

        <Card className="border-blue-900 bg-white shadow-2xl">
          <CardContent className="p-6">
            
            {step === 1 ? (
              <form onSubmit={handleCadastrar} className="space-y-4">
                <div className="text-center mb-5 pb-5 border-b border-gray-100">
                  <p className="text-sm text-gray-500">Você foi convidado para ser um afiliado da rifa:</p>
                  <p className="font-bold text-blue-700 text-lg mt-1">{rifa.titulo}</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Nome Completo</Label>
                  <Input required placeholder="Ex: João Silva" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>CPF</Label>
                    <Input required placeholder="000.000.000-00" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>WhatsApp</Label>
                    <Input required placeholder="(00) 00000-0000" value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1.5 pt-3 border-t">
                  <Label>E-mail de acesso</Label>
                  <Input required type="email" placeholder="Para acessar a conta" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label>Criar Senha</Label>
                  <Input required type="password" minLength={6} placeholder="No mínimo 6 caracteres" value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} />
                </div>

                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 mt-4" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Criar minha Conta"}
                </Button>
              </form>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PartyPopper className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Conta Criada!</h3>
                <p className="text-gray-500 mb-6">Você já é um guardião. Acesse seu painel administrativo para pegar seu link exclusivo!</p>
                <Button className="w-full h-12" onClick={() => navigate("/admin/login")}>
                  Acessar Painel
                </Button>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import * as React from "react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, PartyPopper } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Recrutamento() {
  const navigate = useNavigate();

  const [config, setConfig] = useState<any>(null);
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
    async function fetchConfig() {
      const { data } = await supabase.from("configuracoes").select("nome_sistema").eq("id", 1).single();
      setConfig(data);
      setLoading(false);
    }
    fetchConfig();
  }, []);

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault();
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

      // Criar código de referência baseado no primeiro nome
      const nomeLimpo = formData.nome.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(" ")[0]
        .toUpperCase();

      // 2. Criar Vendedor (acesso global a todas as rifas)
      const { error: vendedorError } = await supabase
        .from('vendedores')
        .insert({
          nome: formData.nome,
          email: formData.email,
          telefone: formData.telefone,
          comissao_padrao: 0,
          meta_numeros: 100,
          user_id: userId,
          codigo_ref: nomeLimpo
        });

      if (vendedorError) throw vendedorError;

      setStep(2);
    } catch (err: any) {
      console.error("Erro no recrutamento:", err);
      let msg = err.message || "Tente novamente.";
      
      if (err.status === 429 || err.message?.includes("rate limit")) {
        msg = "Muitas tentativas em pouco tempo. Por favor, aguarde cerca de 15 minutos e tente novamente.";
      } else if (err.message?.includes("already registered") || err.message?.includes("unique_violation")) {
        msg = "Este e-mail ou CPF já está cadastrado como guardião.";
      }
      
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-6">
          <Shield className="h-12 w-12 text-blue-500 mx-auto mb-2" />
          <h1 className="text-3xl font-bold text-white tracking-tight">{config?.nome_sistema || 'Guardiões'}</h1>
          <p className="text-blue-200 mt-1 uppercase text-xs font-bold tracking-widest">Recrutamento de Guardiões</p>
        </div>

        <Card className="border-blue-900 bg-white shadow-2xl">
          <CardContent className="p-6">
            
            {step === 1 ? (
              <form onSubmit={handleCadastrar} className="space-y-4">
                <div className="text-center mb-5 pb-5 border-b border-gray-100">
                  <p className="font-bold text-blue-700 text-lg mt-1">Cadastre-se como Guardião!</p>
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
                <Button className="w-full h-12" onClick={() => navigate("/login")}>
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

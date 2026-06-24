import * as React from "react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, PartyPopper } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    genero: "masculino",
  });

  const maskCPF = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");
  };

  const inputClass = "h-13 rounded-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-400 focus:ring-blue-450/20 transition-all";

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
          codigo_ref: nomeLimpo,
          genero: formData.genero
        });

      if (vendedorError) throw vendedorError;

      // Se o Supabase não retornar uma sessão imediatamente (mesmo com confirmação desativada),
      // forçamos o login para garantir que o usuário acesse o painel logado.
      if (!authData.session) {
        await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.senha,
        });
      }

      // Redireciona diretamente para o Dashboard logado
      navigate("/");
    } catch (err: any) {
      console.error("Erro no recrutamento:", err);
      let msg = err.message || "Tente novamente.";
      
      if (err.status === 429 || err.message?.includes("rate limit")) {
        msg = "Muitas tentativas em pouco tempo. Por favor, aguarde cerca de 15 minutos e tente novamente.";
      } else if (err.message?.includes("already registered") || err.message?.includes("unique_violation")) {
        msg = "Este e-mail ou CPF já está cadastrado como guardião.";
      }
      
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4 transition-colors duration-300">
      <div className="w-full max-w-md">
        
        <div className="text-center mb-6">
          <Shield className="h-12 w-12 text-blue-500 mx-auto mb-2" />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{config?.nome_sistema || 'Guardiões'}</h1>
          <p className="text-blue-600 dark:text-blue-400 mt-1 uppercase text-xs font-bold tracking-widest">Recrutamento de Guardiões</p>
        </div>

        <Card className="border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl overflow-hidden transition-all">
          <CardContent className="p-6">
            
            {step === 1 ? (
              <form onSubmit={handleCadastrar} className="space-y-4">
                <div className="text-center mb-5 pb-5 border-b border-slate-100 dark:border-slate-800">
                  <p className="font-bold text-blue-700 dark:text-blue-400 text-lg mt-1">Cadastre-se como Guardião!</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-700 dark:text-slate-300 ml-1">Nome e Sobrenome</Label>
                  <Input 
                    required 
                    placeholder="Ex: João Silva" 
                    className={inputClass}
                    value={formData.nome} 
                    onChange={e => setFormData({...formData, nome: e.target.value})} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 dark:text-slate-300 ml-1">CPF</Label>
                    <Input 
                      required 
                      placeholder="000.000.000-00" 
                      className={inputClass}
                      inputMode="numeric"
                      value={formData.cpf} 
                      onChange={e => setFormData({...formData, cpf: maskCPF(e.target.value)})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-slate-700 dark:text-slate-300 ml-1">WhatsApp</Label>
                    <Input 
                      required 
                      placeholder="(00) 00000-0000" 
                      className={inputClass}
                      inputMode="numeric"
                      value={formData.telefone} 
                      onChange={e => setFormData({...formData, telefone: maskPhone(e.target.value)})} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-700 dark:text-slate-300 ml-1">Gênero</Label>
                  <Select
                    value={formData.genero}
                    onValueChange={(value) => setFormData({ ...formData, genero: value })}
                  >
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Selecione o gênero" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl font-medium border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-250">
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Label className="text-slate-700 dark:text-slate-300 ml-1">E-mail de acesso</Label>
                  <Input 
                    required 
                    type="email" 
                    placeholder="Para acessar a conta" 
                    className={inputClass}
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 dark:text-slate-300 ml-1">Criar Senha</Label>
                  <Input 
                    required 
                    type="password" 
                    minLength={6} 
                    placeholder="No mínimo 6 caracteres" 
                    className={inputClass}
                    value={formData.senha} 
                    onChange={e => setFormData({...formData, senha: e.target.value})} 
                  />
                </div>

                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 mt-4" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin h-5 w-5" /> : "Criar minha Conta"}
                </Button>
              </form>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-950/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PartyPopper className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Conta Criada!</h3>
                <p className="text-slate-550 dark:text-slate-400 mb-6">Você já é um guardião. Acesse seu painel administrativo para pegar seu link exclusivo!</p>
                <Button className="w-full h-12 text-white font-bold" onClick={() => navigate("/login")}>
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

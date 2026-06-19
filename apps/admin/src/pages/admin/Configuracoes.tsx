import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, ShieldAlert, Loader2, Eye, EyeOff, Upload, Image as ImageIcon, Check, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function Configuracoes() {
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showMpToken, setShowMpToken] = useState(false);
  const [showEvoKey, setShowEvoKey] = useState(false);
  const [authError, setAuthError] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [testingEvo, setTestingEvo] = useState(false);
  const [heroAccordionOpen, setHeroAccordionOpen] = useState(false);
  const [integrationsAccordionOpen, setIntegrationsAccordionOpen] = useState(false);

  const [formData, setFormData] = useState({
    nome_sistema: "",
    logo_url: "",
    mp_access_token: "",
    evolution_api_url: "",
    evolution_api_key: "",
    evolution_instance: "",
    evolution_enabled: false,
    hero_enabled: true,
    hero_titulo: "",
    hero_descricao: "",
    hero_imagem_url: "",
    whatsapp: "",
    admin_dark_mode: false,
    webhook_pago: "",
    distribuicao_aleatoria_guardiao: false,
    surpresinha_enabled: false,
    notificacoes_compradores_enabled: true,
    ocultar_numeros_comprados: false
  });

  useEffect(() => {
    if (formData.admin_dark_mode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [formData.admin_dark_mode]);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data, error } = await supabase
          .from('configuracoes')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (error) {
          if (error.message.includes('RLS') || error.code === '42501') {
            setAuthError(true);
          }
          throw error;
        }

        if (data) {
          setFormData({
            nome_sistema: data.nome_sistema || "",
            logo_url: data.logo_url || "",
            mp_access_token: data.mp_access_token || "",
            evolution_api_url: data.evolution_api_url || "",
            evolution_api_key: data.evolution_api_key || "",
            evolution_instance: data.evolution_instance || "",
            evolution_enabled: data.evolution_enabled === true,
            hero_enabled: data.hero_enabled !== false,
            hero_titulo: data.hero_titulo || "",
            hero_descricao: data.hero_descricao || "",
            hero_imagem_url: data.hero_imagem_url || "",
            whatsapp: data.whatsapp || "",
            admin_dark_mode: data.admin_dark_mode === true,
            webhook_pago: data.webhook_pago || "",
            distribuicao_aleatoria_guardiao: data.distribuicao_aleatoria_guardiao === true,
            surpresinha_enabled: data.surpresinha_enabled === true,
            notificacoes_compradores_enabled: data.notificacoes_compradores_enabled !== false,
            ocultar_numeros_comprados: data.ocultar_numeros_comprados === true
          });
        }
      } catch (error) {
        console.error("Erro ao buscar configurações:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validações básicas
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.warning("Por favor, selecione uma imagem válida (JPG, PNG, WEBP ou SVG).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB para logo
      toast.warning("A logo é muito grande. O limite é de 2MB.");
      return;
    }

    try {
      setUploadingLogo(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);

      setFormData({ ...formData, logo_url: data.publicUrl });

    } catch (error: any) {
      console.error("Erro ao fazer upload da logo:", error);
      toast.error(`Erro no upload: ${error.message || "Erro desconhecido"}`);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.warning("Por favor, selecione uma imagem válida (JPG, PNG ou WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB para Hero
      toast.warning("A imagem é muito grande. O limite é de 5MB.");
      return;
    }

    try {
      setUploadingHero(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `hero-${Date.now()}.${fileExt}`;
      const filePath = `hero/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      setFormData({ ...formData, hero_imagem_url: data.publicUrl });

    } catch (error: any) {
      console.error("Erro ao fazer upload do banner:", error);
      toast.error(`Erro no upload: ${error.message || "Erro desconhecido"}`);
    } finally {
      setUploadingHero(false);
      if (heroInputRef.current) heroInputRef.current.value = '';
    }
  };

  const handleTestEvolution = async () => {
    if (!formData.evolution_api_url || !formData.evolution_api_key || !formData.evolution_instance) {
      toast.warning("Preencha a URL, chave API e nome da instância Evolution antes de testar.");
      return;
    }
    setTestingEvo(true);
    try {
      // Como o backend Express já tem o helper, podemos criar um endpoint de teste ou fazer direto
      // Vamos fazer um POST para o endpoint de mensagens da Evolution direto do front para teste (se CORS permitir)
      // Ou melhor, avisar o usuário para salvar antes.

      const numLimpo = formData.whatsapp.replace(/\D/g, "");
      if (!numLimpo) {
        toast.warning("Defina um WhatsApp de Suporte para receber o teste.");
        return;
      }

      const response = await fetch(`${formData.evolution_api_url}/message/sendText/${formData.evolution_instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': formData.evolution_api_key
        },
        body: JSON.stringify({
          number: numLimpo.startsWith('55') ? numLimpo : `55${numLimpo}`,
          text: "🚀 *Teste de Integração Evolution API*\n\nSeu sistema de rifas está conectado com sucesso!"
        })
      });

      if (response.ok) {
        toast.success("Mensagem de teste enviada com sucesso!");
      } else {
        const err = await response.json();
        throw new Error(err.message || "Erro na API");
      }
    } catch (err: any) {
      toast.error("Falha no teste: " + err.message);
    } finally {
      setTestingEvo(false);
    }
  };

  const [testingWebhook, setTestingWebhook] = useState(false);

  const handleTestWebhook = async () => {
    if (!formData.webhook_pago) {
      toast.warning("Defina a URL do Webhook (Pedido Pago) para testar.");
      return;
    }
    setTestingWebhook(true);
    try {
      const payload = {
        pedido: {
          id: "test-1234-5678-90ab-cdef12345678",
          display_id: "ABC123",
          codigo_transacao: "9876543210",
          valor_total: 50.00,
          status: "pago",
          numeros_escolhidos: ["01", "02", "03", "55", "155", "160", "185"]
        },
        cliente: {
          nome: "João da Silva (Teste)",
          cpf: "12345678900",
          telefone: "5511999999999",
          email: "joao@teste.com"
        },
        vendedor: {
          nome: "Maria Silva",
          whatsapp: "5511988887777"
        }
      };

      const response = await fetch('/api/webhook-test-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: formData.webhook_pago,
          payload
        })
      });

      if (response.ok) {
        toast.success("Webhook enviado com sucesso!");
      } else {
        const data = await response.json();
        throw new Error(data.error || `Status ${response.status}`);
      }
    } catch (err: any) {
      toast.error("Falha no envio para o webhook: " + err.message);
    } finally {
      setTestingWebhook(false);
    }
  };

  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setShowSuccess(false);

    try {
      const { error } = await supabase
        .from('configuracoes')
        .upsert({
          id: 1,
          ...formData
        });

      if (error) throw error;

      setShowSuccess(true);
      toast.success("Configurações salvas com sucesso!");
      setTimeout(() => setShowSuccess(false), 3000);

    } catch (error: any) {
      console.error("Erro ao salvar configurações:", error);
        toast.error("Erro ao salvar configurações. Verifique o console.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações do Sistema</h1>
        <p className="text-gray-500">Gerencie a aparência e as integrações da sua plataforma.</p>
      </div>

      {authError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 flex items-start">
          <ShieldAlert className="h-5 w-5 mr-3 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold">Acesso Negado (Extrema Segurança)</h3>
            <p className="text-sm mt-1">
              As configurações e chaves de API estão protegidas por políticas de segurança (RLS).
              Você precisa implementar o login de administrador e estar autenticado no Supabase para visualizar ou editar estes dados.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Aparência */}
        <Card className="overflow-hidden border border-slate-100 dark:border-slate-800 shadow-md bg-card">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-blue-950/20 border-b border-slate-100 dark:border-slate-800 pb-4">
            <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200">Aparência da Plataforma</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">Personalize a marca do seu sistema de rifas.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">

              {/* Coluna 1: Nome do Sistema e Logo */}
              <div className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="nome_sistema" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nome do Sistema</Label>
                  <Input
                    id="nome_sistema"
                    placeholder="Ex: Sorteios Online"
                    value={formData.nome_sistema}
                    onChange={handleChange}
                    disabled={authError}
                    className="h-10 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-400 focus:ring-blue-400/20"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Logo do Sistema</Label>
                  <div className="flex items-start gap-4">
                    {/* Preview da logo */}
                    <div className="flex-shrink-0">
                      <div className="h-20 w-20 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 overflow-hidden transition-all hover:border-blue-300 dark:hover:border-blue-700">
                        {formData.logo_url ? (
                          <img src={formData.logo_url} alt="Logo Preview" className="h-full w-full object-contain p-2" />
                        ) : (
                          <ImageIcon className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                        )}
                      </div>
                    </div>

                    <div className="flex-1 space-y-2 min-w-0">
                      <Input
                        id="logo_url"
                        placeholder="https://exemplo.com/logo.png"
                        value={formData.logo_url}
                        onChange={handleChange}
                        disabled={authError}
                        className="h-10 text-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-400"
                      />
                      <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">OU</span>
                        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={logoInputRef}
                        onChange={handleLogoUpload}
                        disabled={authError || uploadingLogo}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={authError || uploadingLogo}
                        className="w-full h-9 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:text-blue-700 dark:hover:text-blue-450 transition-all"
                      >
                        {uploadingLogo ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {uploadingLogo ? "Enviando..." : "Fazer Upload"}
                      </Button>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                        PNG transparente recomendado. Máx. 2MB.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coluna 2: Switches de Configuração */}
              <div className="p-6 space-y-2 bg-slate-50/40 dark:bg-slate-950/20">
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Funcionalidades</p>

                {/* Switch: Modo Escuro */}
                <div className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm transition-all cursor-pointer" onClick={() => !authError && setFormData({ ...formData, admin_dark_mode: !formData.admin_dark_mode })}>
                  <div className="space-y-0.5 flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-none">Modo Escuro (Admin)</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mt-1">Visual do Painel</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.admin_dark_mode}
                    disabled={authError}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${formData.admin_dark_mode ? 'bg-slate-700 dark:bg-slate-600 shadow-slate-350 dark:shadow-slate-900 shadow-inner' : 'bg-slate-200 dark:bg-slate-800'}`}
                    onClick={(e) => { e.stopPropagation(); if (!authError) setFormData({ ...formData, admin_dark_mode: !formData.admin_dark_mode }); }}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white dark:bg-slate-100 shadow-md ring-0 transition-transform duration-200 ${formData.admin_dark_mode ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Switch: Distribuir Vendas */}
                <div className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 hover:border-green-100 dark:hover:border-green-900/30 hover:shadow-sm transition-all cursor-pointer" onClick={() => !authError && setFormData({ ...formData, distribuicao_aleatoria_guardiao: !formData.distribuicao_aleatoria_guardiao })}>
                  <div className="space-y-0.5 flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400 leading-none">Distribuir Vendas Diretas</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mt-1">Para Guardião Aleatório</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.distribuicao_aleatoria_guardiao}
                    disabled={authError}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${formData.distribuicao_aleatoria_guardiao ? 'bg-green-500 dark:bg-green-600 shadow-green-200 dark:shadow-green-950 shadow-inner' : 'bg-slate-200 dark:bg-slate-800'}`}
                    onClick={(e) => { e.stopPropagation(); if (!authError) setFormData({ ...formData, distribuicao_aleatoria_guardiao: !formData.distribuicao_aleatoria_guardiao }); }}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white dark:bg-slate-100 shadow-md ring-0 transition-transform duration-200 ${formData.distribuicao_aleatoria_guardiao ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Switch: Surpresinha */}
                <div className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 hover:border-blue-100 dark:hover:border-blue-900/30 hover:shadow-sm transition-all cursor-pointer" onClick={() => !authError && setFormData({ ...formData, surpresinha_enabled: !formData.surpresinha_enabled })}>
                  <div className="space-y-0.5 flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400 leading-none">Ativar Surpresinha</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mt-1">Seleção Aleatória de Números</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.surpresinha_enabled}
                    disabled={authError}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${formData.surpresinha_enabled ? 'bg-blue-500 dark:bg-blue-600 shadow-blue-200 dark:shadow-blue-950 shadow-inner' : 'bg-slate-200 dark:bg-slate-800'}`}
                    onClick={(e) => { e.stopPropagation(); if (!authError) setFormData({ ...formData, surpresinha_enabled: !formData.surpresinha_enabled }); }}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white dark:bg-slate-100 shadow-md ring-0 transition-transform duration-200 ${formData.surpresinha_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Switch: Notificações de Compradores */}
                <div className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 hover:border-emerald-100 dark:hover:border-emerald-900/30 hover:shadow-sm transition-all cursor-pointer" onClick={() => !authError && setFormData({ ...formData, notificacoes_compradores_enabled: !formData.notificacoes_compradores_enabled })}>
                  <div className="space-y-0.5 flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 leading-none">Notificações de Compradores</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mt-1">Balões de compras recentes no site</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.notificacoes_compradores_enabled}
                    disabled={authError}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${formData.notificacoes_compradores_enabled ? 'bg-emerald-500 dark:bg-emerald-600 shadow-emerald-200 dark:shadow-emerald-950 shadow-inner' : 'bg-slate-200 dark:bg-slate-800'}`}
                    onClick={(e) => { e.stopPropagation(); if (!authError) setFormData({ ...formData, notificacoes_compradores_enabled: !formData.notificacoes_compradores_enabled }); }}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white dark:bg-slate-100 shadow-md ring-0 transition-transform duration-200 ${formData.notificacoes_compradores_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Switch: Ocultar Números Comprados */}
                <div className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 hover:border-purple-100 dark:hover:border-purple-900/30 hover:shadow-sm transition-all cursor-pointer" onClick={() => !authError && setFormData({ ...formData, ocultar_numeros_comprados: !formData.ocultar_numeros_comprados })}>
                  <div className="space-y-0.5 flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-400 leading-none">Ocultar Números Comprados</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mt-1">Exibir apenas disponíveis e reservados</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.ocultar_numeros_comprados}
                    disabled={authError}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${formData.ocultar_numeros_comprados ? 'bg-purple-500 dark:bg-purple-600 shadow-purple-200 dark:shadow-purple-950 shadow-inner' : 'bg-slate-200 dark:bg-slate-800'}`}
                    onClick={(e) => { e.stopPropagation(); if (!authError) setFormData({ ...formData, ocultar_numeros_comprados: !formData.ocultar_numeros_comprados }); }}
                  >
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white dark:bg-slate-100 shadow-md ring-0 transition-transform duration-200 ${formData.ocultar_numeros_comprados ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Configurações do Hero */}
        <Card className="overflow-hidden border border-slate-100 dark:border-slate-800 shadow-md bg-card">
          <CardHeader 
            className="bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20 border-b border-slate-100 dark:border-slate-800 cursor-pointer select-none hover:from-slate-100 dark:hover:from-slate-900 hover:to-indigo-100/30 transition-all duration-200"
            onClick={() => setHeroAccordionOpen(!heroAccordionOpen)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2.5">
                  <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200">Banner Principal (Hero)</CardTitle>
                  <div className={`transition-transform duration-200 ${heroAccordionOpen ? 'rotate-180' : 'rotate-0'}`}>
                    <ChevronDown className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                </div>
                <CardDescription className="text-slate-500 dark:text-slate-400 mt-0.5">Configure o banner de destaque da sua página inicial.</CardDescription>
              </div>
              <div className="flex items-center gap-3 ml-4" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-450 uppercase tracking-wider">Ativo</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.hero_enabled}
                  disabled={authError}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${formData.hero_enabled ? 'bg-indigo-500 dark:bg-indigo-650' : 'bg-slate-200 dark:bg-slate-800'}`}
                  onClick={() => !authError && setFormData({ ...formData, hero_enabled: !formData.hero_enabled })}
                >
                  <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white dark:bg-slate-100 shadow-md ring-0 transition-transform duration-200 ${formData.hero_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </CardHeader>
          <AnimatePresence initial={false}>
            {heroAccordionOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <CardContent className={formData.hero_enabled ? "space-y-6 opacity-100 pb-6 pt-6" : "space-y-6 opacity-40 grayscale pointer-events-none transition-all pb-6 pt-6"}>
                  <div className="space-y-2">
                    <Label htmlFor="hero_titulo" className="text-slate-700 dark:text-slate-300">Título de Destaque</Label>
                    <Input
                      id="hero_titulo"
                      placeholder="Ex: Realize seus sonhos..."
                      value={formData.hero_titulo}
                      onChange={(e) => setFormData({ ...formData, hero_titulo: e.target.value })}
                      disabled={authError}
                      className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hero_descricao" className="text-slate-700 dark:text-slate-300">Descrição Curta</Label>
                    <Input
                      id="hero_descricao"
                      placeholder="Ex: Participe de rifas seguras..."
                      value={formData.hero_descricao}
                      onChange={(e) => setFormData({ ...formData, hero_descricao: e.target.value })}
                      disabled={authError}
                      className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-400"
                    />
                  </div>

                  <div className="space-y-4">
                    <Label className="text-slate-700 dark:text-slate-300">Imagem de Fundo (Background)</Label>
                    <div className="relative h-40 w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-850 flex items-center justify-center bg-gray-50 dark:bg-slate-900/30 overflow-hidden">
                      {formData.hero_imagem_url ? (
                        <div className="w-full h-full relative">
                          <img src={formData.hero_imagem_url} alt="Hero Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <Button variant="secondary" size="sm" type="button" onClick={() => heroInputRef.current?.click()} disabled={uploadingHero}>
                              Alterar Imagem
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="h-8 w-8 text-gray-400 dark:text-slate-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">Sem imagem de fundo definida</p>
                          <Button variant="outline" size="sm" type="button" onClick={() => heroInputRef.current?.click()}>
                            Selecionar Imagem
                          </Button>
                        </div>
                      )}
                      {uploadingHero && (
                        <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 flex items-center justify-center z-10">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={heroInputRef}
                        onChange={handleHeroUpload}
                        disabled={authError || uploadingHero}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="hero_imagem_url"
                        placeholder="URL personalizada da imagem..."
                        value={formData.hero_imagem_url}
                        onChange={(e) => setFormData({ ...formData, hero_imagem_url: e.target.value })}
                        disabled={authError}
                        className="text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-400"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-500 italic">Recomendado: 1920x600px ou similar. Imagens horizontais funcionam melhor.</p>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Integrações (Chaves API) */}
        <Card className="border border-slate-100 dark:border-slate-800 shadow-md bg-card overflow-hidden">
          <CardHeader 
            className="bg-gradient-to-r from-red-50 to-rose-50/30 dark:from-red-950/10 dark:to-rose-950/5 border-b border-red-100/60 dark:border-red-900/20 cursor-pointer select-none hover:from-red-100/70 dark:hover:from-red-950/20 hover:to-rose-100/30 transition-all duration-200"
            onClick={() => setIntegrationsAccordionOpen(!integrationsAccordionOpen)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <ShieldAlert className="h-5 w-5" />
                    <CardTitle className="text-lg font-semibold text-red-800 dark:text-red-300">Integrações e Chaves API</CardTitle>
                  </div>
                  <div className={`transition-transform duration-200 ${integrationsAccordionOpen ? 'rotate-180' : 'rotate-0'}`}>
                    <ChevronDown className="h-5 w-5 text-red-450 dark:text-red-500" />
                  </div>
                </div>
                <CardDescription className="text-red-600/80 dark:text-red-400/80 mt-0.5">
                  Área de extrema segurança. Estas chaves dão acesso a serviços financeiros e de mensagens.
                </CardDescription>
              </div>
              <div className="ml-4 flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${integrationsAccordionOpen ? 'bg-red-400 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'}`} />
                <span className="text-xs font-medium text-red-500 dark:text-red-400">{integrationsAccordionOpen ? 'Aberto' : 'Oculto'}</span>
              </div>
            </div>
          </CardHeader>
          <AnimatePresence initial={false}>
            {integrationsAccordionOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <CardContent className="space-y-6 pt-6">

                  {/* Mercado Pago */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">Mercado Pago</h3>
                    <div className="space-y-2">
                      <Label htmlFor="mp_access_token" className="text-slate-700 dark:text-slate-300">Access Token (Produção)</Label>
                      <div className="relative">
                        <Input
                          id="mp_access_token"
                          type={showMpToken ? "text" : "password"}
                          placeholder="APP_USR-..."
                          value={formData.mp_access_token}
                          onChange={handleChange}
                          disabled={authError}
                          className="pr-10 font-mono border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowMpToken(!showMpToken)}
                          className="absolute right-3 top-2.5 text-gray-400 dark:text-slate-550 hover:text-gray-600 dark:hover:text-slate-350"
                          disabled={authError}
                        >
                          {showMpToken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Token usado para gerar pagamentos PIX e verificar status.</p>
                    </div>
                  </div>

                  {/* Evolution API */}
                  <div className="space-y-4 pt-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                      Evolution API (WhatsApp)
                      <div className="flex items-center space-x-2 text-sm font-normal">
                        <Label htmlFor="evolution_enabled" className="cursor-pointer text-slate-700 dark:text-slate-300">Ativado</Label>
                        <input
                          type="checkbox"
                          id="evolution_enabled"
                          className="h-4 w-4 rounded border-gray-300 dark:border-slate-800 text-blue-600 dark:text-blue-500 focus:ring-blue-600 cursor-pointer bg-white dark:bg-slate-950"
                          checked={formData.evolution_enabled}
                          onChange={(e) => setFormData({ ...formData, evolution_enabled: e.target.checked })}
                          disabled={authError}
                        />
                      </div>
                    </h3>

                    <div className={formData.evolution_enabled ? "space-y-4 opacity-100" : "space-y-4 opacity-40 grayscale pointer-events-none transition-all"}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="evolution_api_url" className="text-slate-700 dark:text-slate-300">URL da API</Label>
                          <Input
                            id="evolution_api_url"
                            placeholder="https://sua-api.com"
                            value={formData.evolution_api_url}
                            onChange={handleChange}
                            disabled={authError}
                            className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-400"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="evolution_instance" className="text-slate-700 dark:text-slate-300">Nome da Instância</Label>
                          <Input
                            id="evolution_instance"
                            placeholder="Ex: Admin"
                            value={formData.evolution_instance}
                            onChange={handleChange}
                            disabled={authError}
                            className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-400"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="evolution_api_key" className="text-slate-700 dark:text-slate-300">Global API Key</Label>
                        <div className="relative">
                          <Input
                            id="evolution_api_key"
                            type={showEvoKey ? "text" : "password"}
                            placeholder="Sua chave secreta..."
                            value={formData.evolution_api_key}
                            onChange={handleChange}
                            disabled={authError}
                            className="pr-10 font-mono border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowEvoKey(!showEvoKey)}
                            className="absolute right-3 top-2.5 text-gray-400 dark:text-slate-550 hover:text-gray-600 dark:hover:text-slate-350"
                            disabled={authError}
                          >
                            {showEvoKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Chave de autenticação para enviar mensagens automáticas.</p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-4">
                        <Label htmlFor="webhook_pago" className="text-slate-700 dark:text-slate-300">Webhook (Pedido Pago)</Label>
                        <Input
                          id="webhook_pago"
                          placeholder="https://sua-automacao.com/webhook"
                          value={formData.webhook_pago}
                          onChange={handleChange}
                          disabled={authError}
                          className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-400"
                        />
                        <p className="text-xs text-gray-500 dark:text-slate-400">URL que receberá um POST com os dados do pedido (Nome, Valor, Telefone, Guardião, etc) quando aprovado.</p>
                      </div>

                      <div className="pt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleTestEvolution}
                          disabled={testingEvo || !formData.evolution_api_url}
                          className="text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                        >
                          {testingEvo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                          Testar Conexão (Envia para o Suporte)
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleTestWebhook}
                          disabled={testingWebhook || !formData.webhook_pago}
                          className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-900/40 hover:bg-green-50 dark:hover:bg-green-950/20"
                        >
                          {testingWebhook ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                          Enviar POST de teste no Webhook
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-150">Contatos e Suporte</h3>
                    <div className="grid gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="whatsapp" className="text-slate-700 dark:text-slate-300">WhatsApp de Suporte</Label>
                        <Input
                          id="whatsapp"
                          placeholder="Ex: (11) 98888-8888"
                          value={formData.whatsapp}
                          onChange={handleChange}
                          className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:border-blue-400"
                        />
                        <p className="text-xs text-gray-500 dark:text-slate-400">Este número será usado para o link de suporte na navegação mobile.</p>
                      </div>
                    </div>
                  </div>

                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <div className="flex items-center justify-end space-x-4">
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center text-green-600 dark:text-green-400 font-medium"
              >
                <Check className="h-5 w-5 mr-2" />
                Configurações salvas!
              </motion.div>
            )}
          </AnimatePresence>
          <Button type="submit" size="lg" disabled={saving || authError || uploadingLogo} className="w-full md:w-auto">
            {saving ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            Salvar Configurações
          </Button>
        </div>
      </form>
    </div>
  );
}

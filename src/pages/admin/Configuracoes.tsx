import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, ShieldAlert, Loader2, Eye, EyeOff, Upload, Image as ImageIcon, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/src/lib/supabase";

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
    admin_dark_mode: false
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
            admin_dark_mode: data.admin_dark_mode === true
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
      alert("Por favor, selecione uma imagem válida (JPG, PNG, WEBP ou SVG).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB para logo
      alert("A logo é muito grande. O limite é de 2MB.");
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
      alert(`Erro no upload: ${error.message || "Erro desconhecido"}`);
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
      alert("Por favor, selecione uma imagem válida (JPG, PNG ou WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB para Hero
      alert("A imagem é muito grande. O limite é de 5MB.");
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
      alert(`Erro no upload: ${error.message || "Erro desconhecido"}`);
    } finally {
      setUploadingHero(false);
      if (heroInputRef.current) heroInputRef.current.value = '';
    }
  };

  const handleTestEvolution = async () => {
    if (!formData.evolution_api_url || !formData.evolution_api_key || !formData.evolution_api_instance) {
       // Note: the field id is evolution_instance but in state it might be different?
       // Let me check state names.
    }
    setTestingEvo(true);
    try {
      // Como o backend Express já tem o helper, podemos criar um endpoint de teste ou fazer direto
      // Vamos fazer um POST para o endpoint de mensagens da Evolution direto do front para teste (se CORS permitir)
      // Ou melhor, avisar o usuário para salvar antes.
      
      const numLimpo = formData.whatsapp.replace(/\D/g, "");
      if (!numLimpo) {
        alert("Defina um WhatsApp de Suporte para receber o teste.");
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
        alert("Mensagem de teste enviada com sucesso!");
      } else {
        const err = await response.json();
        throw new Error(err.message || "Erro na API");
      }
    } catch (err: any) {
      alert("Falha no teste: " + err.message);
    } finally {
      setTestingEvo(false);
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
      setTimeout(() => setShowSuccess(false), 3000);
      
    } catch (error: any) {
      console.error("Erro ao salvar configurações:", error);
      if (error.message?.includes('RLS') || error.code === '42501') {
        alert("Erro de Permissão: Você precisa estar autenticado como administrador para salvar configurações de extrema segurança.");
      } else {
        alert("Erro ao salvar configurações. Verifique o console.");
      }
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
        <Card>
          <CardHeader>
            <CardTitle>Aparência da Plataforma</CardTitle>
            <CardDescription>Personalize a marca do seu sistema de rifas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome_sistema">Nome do Sistema</Label>
                <Input 
                  id="nome_sistema" 
                  placeholder="Ex: Sorteios Online" 
                  value={formData.nome_sistema}
                  onChange={handleChange}
                  disabled={authError}
                />
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label htmlFor="admin_dark_mode" className="text-sm font-medium">Modo Escuro (Admin)</Label>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Visual do Painel</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.admin_dark_mode}
                    onClick={() => setFormData({...formData, admin_dark_mode: !formData.admin_dark_mode})}
                    disabled={authError}
                    className={`
                      relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50
                      ${formData.admin_dark_mode ? 'bg-primary' : 'bg-muted'}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform
                        ${formData.admin_dark_mode ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <Label>Logo do Sistema</Label>
              
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="h-24 w-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                    {formData.logo_url ? (
                      <img src={formData.logo_url} alt="Logo Preview" className="h-full w-full object-contain p-2" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                </div>
                
                <div className="flex-1 space-y-4">
                  <div className="flex items-center space-x-2">
                    <Input 
                      id="logo_url" 
                      placeholder="https://exemplo.com/logo.png" 
                      value={formData.logo_url}
                      onChange={handleChange}
                      disabled={authError}
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-500 font-medium">OU</span>
                    <div>
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
                        onClick={() => logoInputRef.current?.click()}
                        disabled={authError || uploadingLogo}
                      >
                        {uploadingLogo ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Fazer Upload
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Insira uma URL direta para a imagem ou faça o upload de um arquivo do seu computador (recomendado PNG transparente).
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configurações do Hero */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Banner Principal (Hero)</CardTitle>
                <CardDescription>Configure o banner de destaque da sua página inicial.</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="hero_enabled" className="cursor-pointer">Ativado</Label>
                <input 
                  type="checkbox" 
                  id="hero_enabled"
                  className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                  checked={formData.hero_enabled}
                  onChange={(e) => setFormData({...formData, hero_enabled: e.target.checked})}
                  disabled={authError}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className={formData.hero_enabled ? "space-y-6 opacity-100" : "space-y-6 opacity-40 grayscale pointer-events-none transition-all"}>
            <div className="space-y-2">
              <Label htmlFor="hero_titulo">Título de Destaque</Label>
              <Input 
                id="hero_titulo" 
                placeholder="Ex: Realize seus sonhos..." 
                value={formData.hero_titulo}
                onChange={(e) => setFormData({...formData, hero_titulo: e.target.value})}
                disabled={authError}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero_descricao">Descrição Curta</Label>
              <Input 
                id="hero_descricao" 
                placeholder="Ex: Participe de rifas seguras..." 
                value={formData.hero_descricao}
                onChange={(e) => setFormData({...formData, hero_descricao: e.target.value})}
                disabled={authError}
              />
            </div>

            <div className="space-y-4">
              <Label>Imagem de Fundo (Background)</Label>
              <div className="relative h-40 w-full rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
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
                     <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                     <p className="text-sm text-gray-500 mb-2">Sem imagem de fundo definida</p>
                     <Button variant="outline" size="sm" type="button" onClick={() => heroInputRef.current?.click()}>
                       Selecionar Imagem
                     </Button>
                  </div>
                )}
                {uploadingHero && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
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
                  onChange={(e) => setFormData({...formData, hero_imagem_url: e.target.value})}
                  disabled={authError}
                  className="text-xs"
                />
              </div>
              <p className="text-xs text-gray-500 italic">Recomendado: 1920x600px ou similar. Imagens horizontais funcionam melhor.</p>
            </div>
          </CardContent>
        </Card>

        {/* Integrações (Chaves API) */}
        <Card className="border-red-100 shadow-sm">
          <CardHeader className="bg-red-50/50 border-b border-red-100 pb-4">
            <div className="flex items-center text-red-700 mb-1">
              <ShieldAlert className="h-5 w-5 mr-2" />
              <CardTitle>Integrações e Chaves API</CardTitle>
            </div>
            <CardDescription className="text-red-600/80">
              Área de extrema segurança. Estas chaves dão acesso a serviços financeiros e de mensagens.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            
            {/* Mercado Pago */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Mercado Pago</h3>
              <div className="space-y-2">
                <Label htmlFor="mp_access_token">Access Token (Produção)</Label>
                <div className="relative">
                  <Input 
                    id="mp_access_token" 
                    type={showMpToken ? "text" : "password"}
                    placeholder="APP_USR-..." 
                    value={formData.mp_access_token}
                    onChange={handleChange}
                    disabled={authError}
                    className="pr-10 font-mono"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowMpToken(!showMpToken)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    disabled={authError}
                  >
                    {showMpToken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500">Token usado para gerar pagamentos PIX e verificar status.</p>
              </div>
            </div>

            {/* Evolution API */}
              <div className="space-y-4 pt-4">
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2 flex items-center justify-between">
                  Evolution API (WhatsApp)
                  <div className="flex items-center space-x-2 text-sm font-normal">
                    <Label htmlFor="evolution_enabled" className="cursor-pointer">Ativado</Label>
                    <input 
                      type="checkbox" 
                      id="evolution_enabled"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                      checked={formData.evolution_enabled}
                      onChange={(e) => setFormData({...formData, evolution_enabled: e.target.checked})}
                      disabled={authError}
                    />
                  </div>
                </h3>
                
                <div className={formData.evolution_enabled ? "space-y-4 opacity-100" : "space-y-4 opacity-40 grayscale pointer-events-none transition-all"}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="evolution_api_url">URL da API</Label>
                      <Input 
                        id="evolution_api_url" 
                        placeholder="https://sua-api.com" 
                        value={formData.evolution_api_url}
                        onChange={handleChange}
                        disabled={authError}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="evolution_instance">Nome da Instância</Label>
                      <Input 
                        id="evolution_instance" 
                        placeholder="Ex: Admin" 
                        value={formData.evolution_instance}
                        onChange={handleChange}
                        disabled={authError}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="evolution_api_key">Global API Key</Label>
                    <div className="relative">
                      <Input 
                        id="evolution_api_key" 
                        type={showEvoKey ? "text" : "password"}
                        placeholder="Sua chave secreta..." 
                        value={formData.evolution_api_key}
                        onChange={handleChange}
                        disabled={authError}
                        className="pr-10 font-mono"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowEvoKey(!showEvoKey)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                        disabled={authError}
                      >
                        {showEvoKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">Chave de autenticação para enviar mensagens automáticas.</p>
                  </div>

                  <div className="pt-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={handleTestEvolution}
                      disabled={testingEvo || !formData.evolution_api_url}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      {testingEvo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                      Testar Conexão (Envia para o Suporte)
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-medium text-gray-900">Contatos e Suporte</h3>
                <div className="grid gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="whatsapp">WhatsApp de Suporte</Label>
                    <Input 
                      id="whatsapp" 
                      placeholder="Ex: (11) 98888-8888" 
                      value={formData.whatsapp} 
                      onChange={handleChange} 
                    />
                    <p className="text-xs text-gray-500">Este número será usado para o link de suporte na navegação mobile.</p>
                  </div>
                </div>
              </div>

          </CardContent>
        </Card>

        <div className="flex items-center justify-end space-x-4">
          <AnimatePresence>
            {showSuccess && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center text-green-600 font-medium"
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

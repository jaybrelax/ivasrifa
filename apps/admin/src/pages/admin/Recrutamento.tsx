import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Loader2, PartyPopper, Camera, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export default function Recrutamento() {
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    senha: "",
    genero: "masculino",
  });

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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.warning("Selecione uma imagem válida (JPG, PNG ou WEBP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.warning("A imagem é muito grande. Limite: 2MB.");
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!avatarFile) return null;
    setUploadingAvatar(true);
    try {
      const fileExt = avatarFile.name.split(".").pop();
      const fileName = `avatar-${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, avatarFile, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("images").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      console.error("Erro ao fazer upload do avatar:", err);
      toast.error(`Erro ao enviar foto: ${err.message || "Erro desconhecido"}`);
      return null;
    } finally {
      setUploadingAvatar(false);
    }
  };

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

      // 2. Upload do avatar (se houver)
      const avatarUrl = await uploadAvatar(userId);

      // Criar código de referência baseado no primeiro nome
      const nomeLimpo = formData.nome.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(" ")[0]
        .toUpperCase();

      // 3. Criar Vendedor
      const { error: vendedorError } = await supabase
        .from("vendedores")
        .insert({
          nome: formData.nome,
          email: formData.email,
          telefone: formData.telefone,
          comissao_padrao: 0,
          meta_numeros: 100,
          user_id: userId,
          codigo_ref: nomeLimpo,
          genero: formData.genero,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        });

      if (vendedorError) throw vendedorError;

      // 4. Garantir sessão ativa
      if (!authData.session) {
        await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.senha,
        });
      }

      navigate("/");
    } catch (err: any) {
      console.error("Erro no recrutamento:", err);
      let msg = err.message || "Tente novamente.";

      if (err.status === 429 || err.message?.includes("rate limit")) {
        msg = "Muitas tentativas em pouco tempo. Por favor, aguarde cerca de 15 minutos e tente novamente.";
      } else if (err.message?.includes("already registered") || err.message?.includes("unique_violation")) {
        msg = "Este e-mail já está cadastrado como guardião.";
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

                {/* ── Upload de foto de perfil ── */}
                <div className="flex flex-col items-center gap-2 pb-2">
                  <input
                    type="file"
                    ref={avatarInputRef}
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarChange}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="relative group focus:outline-none"
                    title="Clique para adicionar foto de perfil"
                  >
                    <div className="h-24 w-24 rounded-full border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-500">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-10 w-10 text-blue-300 dark:text-blue-700" />
                      )}
                    </div>
                    <div className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-1.5 shadow-md border-2 border-white dark:border-slate-900 group-hover:bg-blue-700 transition-colors">
                      <Camera className="h-3.5 w-3.5 text-white" />
                    </div>
                  </button>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {avatarPreview ? "Foto selecionada ✓" : "Adicionar foto de perfil (opcional)"}
                  </p>
                </div>

                {/* ── Nome ── */}
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

                {/* ── WhatsApp ── */}
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

                {/* ── Gênero ── */}
                <div className="space-y-1.5">
                  <Label className="text-slate-700 dark:text-slate-300 ml-1">Gênero</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, genero: "masculino" })}
                      className={`flex items-center justify-center gap-2 h-11 rounded-lg border-2 font-semibold text-sm transition-all focus:outline-none
                        ${formData.genero === "masculino"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700"
                        }`}
                    >
                      <span>♂️</span> Masculino
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, genero: "feminino" })}
                      className={`flex items-center justify-center gap-2 h-11 rounded-lg border-2 font-semibold text-sm transition-all focus:outline-none
                        ${formData.genero === "feminino"
                          ? "border-pink-500 bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:border-pink-300 dark:hover:border-pink-700"
                        }`}
                    >
                      <span>♀️</span> Feminino
                    </button>
                  </div>
                </div>

                {/* ── E-mail e Senha ── */}
                <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-1.5">
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
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 mt-4"
                  disabled={submitting || uploadingAvatar}
                >
                  {submitting || uploadingAvatar
                    ? <Loader2 className="animate-spin h-5 w-5" />
                    : "Criar minha Conta"
                  }
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

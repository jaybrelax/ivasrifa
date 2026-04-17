import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Camera, UserCircle, Save, Key } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function PerfilVendedor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vendedor, setVendedor] = useState<any>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    email: ""
  });
  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: ""
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchVendedor();
  }, []);

  async function fetchVendedor() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('vendedores')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setVendedor(data);
        setFormData({
          nome: data.nome || "",
          telefone: data.telefone || "",
          email: session.user.email || ""
        });
      } else {
        // Para Admin sem registro na tabela vendedores
        setVendedor({ user_id: session.user.id }); 
        setFormData({
          nome: session.user.user_metadata?.nome || "Administrador",
          telefone: session.user.user_metadata?.telefone || "",
          email: session.user.email || ""
        });
      }
    } catch (err) {
      console.error("Erro ao buscar vendedor:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert("Por favor, selecione uma imagem válida (JPG, PNG ou WEBP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem é muito grande. O limite é de 2MB.");
      return;
    }

    try {
      setUploadingAvatar(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${session.user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, { 
          cacheControl: '3600',
          upsert: true 
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      // Atualizar no banco de dados usando upsert para garantir que funcione para Admin
      const { data: updatedVendedor, error: updateError } = await supabase
        .from('vendedores')
        .upsert({ 
          user_id: session.user.id,
          avatar_url: publicUrl 
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (updateError) throw updateError;

      setVendedor(updatedVendedor);
      alert("Foto de perfil atualizada!");
      
    } catch (error: any) {
      console.error("Erro ao fazer upload do avatar:", error);
      alert(`Erro no upload: ${error.message || "Erro desconhecido"}`);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Usar upsert para garantir que crie o registro se não existir (caso do Admin)
      const { data: savedData, error } = await supabase
        .from('vendedores')
        .upsert({
          user_id: vendedor.user_id,
          nome: formData.nome,
          telefone: formData.telefone
        }, { onConflict: 'user_id' })
        .select()
        .single();
      
      if (error) throw error;
      setVendedor(savedData);
      alert("Perfil atualizado com sucesso!");
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password !== passwordData.confirmPassword) {
      alert("As senhas não coincidem!");
      return;
    }
    if (passwordData.password.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.password
      });
      if (error) throw error;
      alert("Senha alterada com sucesso!");
      setPasswordData({ password: "", confirmPassword: "" });
    } catch (err: any) {
      alert("Erro ao alterar senha: " + err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="text-gray-500">Gerencie suas informações de Guardião.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Banner de Referência */}
        <Card className="bg-blue-600 text-white overflow-hidden border-none">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                <Key className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-1">Meu Código de Referência</p>
                <p className="text-3xl font-black tracking-tighter">{vendedor?.codigo_ref || '---'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-gray-400" /> Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex flex-col items-center mb-6">
                <input 
                  type="file" 
                  ref={avatarInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                />
                <div 
                  className="relative group cursor-pointer"
                  onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
                >
                  <Avatar className="h-24 w-24 ring-4 ring-gray-100 dark:ring-slate-800">
                    <AvatarImage src={vendedor?.avatar_url} />
                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-2xl font-bold uppercase">
                      {formData.nome.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`absolute inset-0 bg-black/40 rounded-full flex items-center justify-center transition-opacity ${uploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {uploadingAvatar ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Clique para mudar a foto</p>
              </div>

              <div className="space-y-1.5">
                <Label>Nome Completo</Label>
                <Input value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>E-mail (Acesso)</Label>
                  <Input disabled value={formData.email} className="bg-gray-50" />
                  <p className="text-[10px] text-gray-400 italic">O e-mail não pode ser alterado.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>WhatsApp</Label>
                  <Input value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} />
                </div>
              </div>

              <hr className="my-6 border-gray-100" />

              <div className="flex justify-end">
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                  {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Segurança / Troca de Senha */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5 text-gray-400" /> Segurança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nova Senha</Label>
                  <Input 
                    type="password" 
                    placeholder="Mínimo 6 caracteres"
                    value={passwordData.password}
                    onChange={e => setPasswordData({...passwordData, password: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirmar Nova Senha</Label>
                  <Input 
                    type="password" 
                    placeholder="Repita a nova senha"
                    value={passwordData.confirmPassword}
                    onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={changingPassword || !passwordData.password} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                  {changingPassword ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Key className="h-4 w-4 mr-2" />}
                  Atualizar Senha
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

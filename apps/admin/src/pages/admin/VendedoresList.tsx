import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableBody
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Search, MoreHorizontal, Trash, Copy, Loader2, Shield, CheckCircle2, ExternalLink, Users, User, Camera } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function VendedoresList() {
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);

  // ── Modal de detalhes ──
  const [selectedVendedor, setSelectedVendedor] = useState<any>(null);
  const [vendasVendedor, setVendasVendedor] = useState<any[]>([]);
  const [loadingVendas, setLoadingVendas] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editGenero, setEditGenero] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchVendedores();
  }, []);

  async function fetchVendedores() {
    setLoading(true);
    try {
      const { data: vData, error: vError } = await supabase
        .from('vendedores')
        .select('*')
        .order('created_at', { ascending: false });

      if (vError) throw vError;

      const { data: pData } = await supabase
        .from('pedidos')
        .select('vendedor_id, quantidade')
        .eq('status', 'pago')
        .not('vendedor_id', 'is', null);

      const vendedoresComVendas = vData?.map(vend => {
        const totalCotas = pData?.filter(p => p.vendedor_id === vend.id)
          .reduce((acc, curr) => acc + (curr.quantidade || 0), 0) || 0;
        return { ...vend, totalCotas };
      });

      setVendedores(vendedoresComVendas || []);
    } catch (error) {
      console.error("Erro ao buscar guardiões:", error);
    } finally {
      setLoading(false);
    }
  }

  // ── Abrir modal ao clicar na linha ──
  const handleRowClick = async (vendedor: any, e: React.MouseEvent) => {
    // Impedir que cliques em botões dentro da linha abram o modal
    if ((e.target as HTMLElement).closest('button, [role="combobox"], [data-radix-collection-item]')) return;

    setSelectedVendedor(vendedor);
    setEditNome(vendedor.nome || "");
    setEditTelefone(vendedor.telefone || "");
    setEditEmail(vendedor.email || "");
    setEditGenero(vendedor.genero || "");
    setEditAvatarUrl(vendedor.avatar_url || "");
    setIsEditing(false);
    setLoadingVendas(true);

    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id,
          quantidade,
          valor_total,
          cliente:clientes (
            nome_completo
          )
        `)
        .eq('vendedor_id', vendedor.id)
        .eq('status', 'pago')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendasVendedor(data || []);
    } catch (err) {
      console.error("Erro ao buscar vendas:", err);
      toast.error("Erro ao carregar vendas.");
    } finally {
      setLoadingVendas(false);
    }
  };

  // ── Salvar edição ──
  const handleSaveVendedor = async () => {
    if (!selectedVendedor) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('vendedores')
        .update({
          nome: editNome,
          telefone: editTelefone,
          email: editEmail,
          genero: editGenero,
          avatar_url: editAvatarUrl,
        })
        .eq('id', selectedVendedor.id);

      if (error) throw error;

      toast.success("Dados do guardião atualizados com sucesso!");

      setVendedores(prev => prev.map(v =>
        v.id === selectedVendedor.id
          ? { ...v, nome: editNome, telefone: editTelefone, email: editEmail, genero: editGenero, avatar_url: editAvatarUrl }
          : v
      ));

      setSelectedVendedor((prev: any) => ({
        ...prev,
        nome: editNome,
        telefone: editTelefone,
        email: editEmail,
        genero: editGenero,
        avatar_url: editAvatarUrl,
      }));

      setIsEditing(false);
    } catch (err: any) {
      toast.error("Erro ao atualizar dados: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Upload de avatar ──
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedVendedor) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.warning("Selecione uma imagem válida (JPG, PNG ou WEBP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.warning("A imagem é muito grande. Limite: 2MB.");
      return;
    }

    try {
      setUploadingAvatar(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${selectedVendedor.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      setEditAvatarUrl(data.publicUrl);
      toast.success("Foto carregada! Clique em Salvar para confirmar.");
    } catch (err: any) {
      toast.error(`Erro no upload: ${err.message || "Erro desconhecido"}`);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const formatCompradorName = (fullName: string) => {
    if (!fullName) return "Sem nome";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return fullName;
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o guardião "${nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const { error } = await supabase.from('vendedores').delete().eq('id', id);
      if (error) throw error;
      setVendedores(vendedores.filter(v => v.id !== id));
      if (selectedVendedor?.id === id) setSelectedVendedor(null);
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const handleCopiarLink = () => {
    const link = `https://rifa.virtudes.net.br/recrutamento`;
    navigator.clipboard.writeText(link);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  };

  const handleToggleAdmin = async (vendedor: any) => {
    const isCurrentlyAdmin = vendedor.is_admin === true;
    const action = isCurrentlyAdmin ? 'remover o acesso de Administrador de' : 'tornar Administrador o';
    if (!window.confirm(`Tem certeza que deseja ${action} "${vendedor.nome}"? Ela(e) terá controle total sobre o sistema.`)) return;

    try {
      const { error } = await supabase
        .from('vendedores')
        .update({ is_admin: !isCurrentlyAdmin })
        .eq('id', vendedor.id);

      if (error) throw error;

      setVendedores(vendedores.map(v =>
        v.id === vendedor.id ? { ...v, is_admin: !isCurrentlyAdmin } : v
      ));
    } catch (err: any) {
      toast.error("Erro ao atualizar cargo: " + err.message);
    }
  };

  const handleUpdateGenero = async (id: string, genero: string) => {
    try {
      const { error } = await supabase
        .from('vendedores')
        .update({ genero })
        .eq('id', id);

      if (error) throw error;

      setVendedores(vendedores.map(v =>
        v.id === id ? { ...v, genero } : v
      ));
      toast.success("Gênero atualizado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao atualizar gênero: " + err.message);
    }
  };

  const vendedoresFiltrados = vendedores.filter(v =>
    v.nome?.toLowerCase().includes(search.toLowerCase()) ||
    v.email?.toLowerCase().includes(search.toLowerCase()) ||
    v.codigo_ref?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" /> Guardiões
          </h1>
          <p className="text-gray-500 dark:text-slate-400">Gerencie sua equipe de vendas e compare desempenhos.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            onClick={handleCopiarLink}
          >
            {linkCopiado
              ? <><CheckCircle2 className="h-4 w-4 mr-2 text-green-600" /> Copiado!</>
              : <><Copy className="h-4 w-4 mr-2" /> Copiar Link</>
            }
          </Button>
          <Button
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white"
            render={<Link to="/recrutamento" />}
            nativeButton={false}
          >
            <ExternalLink className="h-4 w-4 mr-2" /> Abrir Recrutamento
          </Button>
        </div>
      </div>

      {/* Tabela de Guardiões */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-400 dark:text-slate-500" />
              Lista de Guardiões
              {!loading && (
                <Badge variant="secondary" className="ml-2 font-bold">{vendedores.length}</Badge>
              )}
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-slate-400" />
              <Input
                type="search"
                placeholder="Buscar guardião..."
                className="pl-8 w-full"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : vendedoresFiltrados.length === 0 ? (
            <div className="text-center py-14 text-gray-400 dark:text-slate-550">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-gray-500 dark:text-slate-400">
                {search ? "Nenhum guardião encontrado para esta busca." : "Nenhum guardião cadastrado ainda."}
              </p>
              {!search && (
                <Button
                  size="sm"
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                  render={<Link to="/recrutamento" />}
                  nativeButton={false}
                >
                  <ExternalLink className="h-4 w-4 mr-2" /> Recrutar primeiro guardião
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cotas Vendidas</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Código Ref</TableHead>
                  <TableHead>Gênero</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendedoresFiltrados.map((vendedor) => {
                  const totalCotas = vendedor.totalCotas || 0;
                  const metaReal = vendedor.meta_numeros || 50;
                  const progresso = Math.min((totalCotas / metaReal) * 100, 100);
                  const atingiuMeta = totalCotas >= metaReal;

                  return (
                    <TableRow
                      key={vendedor.id}
                      onClick={(e) => handleRowClick(vendedor, e)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 ring-2 ring-white shadow-sm">
                            <AvatarImage src={vendedor.avatar_url} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white text-xs font-bold">
                              {vendedor.nome ? vendedor.nome.charAt(0).toUpperCase() : 'G'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              {vendedor.nome}
                              {vendedor.is_admin === true && (
                                <Badge className="h-4 px-1 text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-950/50">Admin</Badge>
                              )}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5 min-w-[120px]">
                          <div className="flex justify-between text-xs">
                            <span className="font-bold text-gray-700 dark:text-slate-350">{totalCotas} cotas</span>
                            <span className={atingiuMeta ? "text-green-600 dark:text-green-400 font-bold" : "text-gray-400 dark:text-slate-500"}>
                              meta: {metaReal}
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${atingiuMeta ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${progresso}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{vendedor.email}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">{vendedor.telefone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="font-mono bg-gray-50 dark:bg-slate-900/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/50">
                            {vendedor.codigo_ref}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(`https://rifa.virtudes.net.br?ref=${vendedor.codigo_ref}`);
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Select
                          value={vendedor.genero || ""}
                          onValueChange={(value) => handleUpdateGenero(vendedor.id, value)}
                        >
                          <SelectTrigger className="w-[120px] h-8 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                            <SelectValue placeholder="Não definido" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl font-medium border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-250">
                            <SelectItem value="masculino">Masculino</SelectItem>
                            <SelectItem value="feminino">Feminino</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {vendedor.ativo !== false ? (
                          <Badge className="bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/30">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => {
                                const tel = vendedor.telefone?.replace(/\D/g, '');
                                if (tel) window.open(`https://wa.me/55${tel}`, '_blank');
                              }}>
                                📱 WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                navigator.clipboard.writeText(`https://rifa.virtudes.net.br?ref=${vendedor.codigo_ref}`);
                              }}>
                                <Copy className="mr-2 h-4 w-4" /> Copiar Link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleAdmin(vendedor)}>
                                <Shield className={cn("mr-2 h-4 w-4", vendedor.is_admin === true ? "text-slate-400" : "text-blue-600")} />
                                {vendedor.is_admin === true ? "Remover Admin" : "Tornar Admin"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(vendedor.id, vendedor.nome)}>
                                <Trash className="mr-2 h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Modal de Detalhes do Guardião ── */}
      <Dialog open={!!selectedVendedor} onOpenChange={(open) => { if (!open) setSelectedVendedor(null); }}>
        <DialogContent className="sm:max-w-[550px] dark:bg-slate-900 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <input
                type="file"
                ref={avatarInputRef}
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
              <div
                className="relative group cursor-pointer shrink-0"
                onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
                title="Clique para mudar a foto de perfil"
              >
                <Avatar className="h-12 w-12 border-2 border-white dark:border-slate-800 shadow-sm">
                  <AvatarImage src={editAvatarUrl || selectedVendedor?.avatar_url} />
                  <AvatarFallback className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold">
                    {selectedVendedor?.nome?.charAt(0).toUpperCase() || <User size={20} />}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute inset-0 bg-black/50 rounded-full flex items-center justify-center transition-opacity ${uploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {uploadingAvatar
                    ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                    : <Camera className="h-4 w-4 text-white" />}
                </div>
              </div>
              <div className="text-left">
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  {selectedVendedor?.nome}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-450">
                  Código Ref: @{selectedVendedor?.codigo_ref}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedVendedor && (
            <div className="space-y-6 py-4">
              {/* Informações / Edição */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-4">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Informações do Guardião</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    {isEditing ? "Cancelar" : "Editar"}
                  </Button>
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-650 dark:text-slate-400">Nome</label>
                        <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-9 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-650 dark:text-slate-400">Telefone</label>
                        <Input value={editTelefone} onChange={e => setEditTelefone(e.target.value)} className="h-9 text-xs" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-650 dark:text-slate-400">E-mail</label>
                        <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="h-9 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-650 dark:text-slate-400">Gênero</label>
                        <Select value={editGenero} onValueChange={v => setEditGenero(v)}>
                          <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-900">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-950 text-xs">
                            <SelectItem value="masculino">Masculino</SelectItem>
                            <SelectItem value="feminino">Feminino</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                        onClick={handleSaveVendedor}
                        disabled={isSaving}
                      >
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Salvar Alterações
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Nome Completo</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedVendedor.nome || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Gênero</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 capitalize">{selectedVendedor.genero || "Não definido"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">E-mail</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">{selectedVendedor.email || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Telefone</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedVendedor.telefone || "-"}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Vendas */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Vendas Realizadas</span>
                  <Badge variant="secondary" className="font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                    {vendasVendedor.length} {vendasVendedor.length === 1 ? "venda" : "vendas"}
                  </Badge>
                </h4>

                {loadingVendas ? (
                  <div className="flex justify-center items-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : vendasVendedor.length === 0 ? (
                  <div className="text-center py-8 text-slate-450 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    Nenhuma venda paga realizada por este guardião.
                  </div>
                ) : (
                  <div className="border border-slate-150 dark:border-slate-800/80 rounded-xl overflow-hidden divide-y divide-slate-150 dark:divide-slate-800 bg-white dark:bg-slate-950">
                    {vendasVendedor.map((venda) => (
                      <div key={venda.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                            {formatCompradorName(venda.cliente?.nome_completo)}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                            Comprador
                          </p>
                        </div>
                        <div className="flex items-center gap-6 text-right">
                          <div>
                            <p className="font-bold text-slate-700 dark:text-slate-350 text-sm">{venda.quantidade}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Cotas</p>
                          </div>
                          <div>
                            <p className="font-bold text-green-600 dark:text-green-400 text-sm">
                              R$ {Number(venda.valor_total).toFixed(2)}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Valor</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

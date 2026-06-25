import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Trophy, Medal, Loader2, User, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function RankingList() {
  const [ranking, setRanking] = useState<any[]>([]);
  const [rifas, setRifas] = useState<any[]>([]);
  const [selectedRifa, setSelectedRifa] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [rankingMode, setRankingMode] = useState<'valor' | 'quantidade' | 'pedidos' | 'top10'>('pedidos');
  const [selectedGender, setSelectedGender] = useState<'geral' | 'masculino' | 'feminino'>('geral');
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedVendedor, setSelectedVendedor] = useState<any>(null);
  const [vendasVendedor, setVendasVendedor] = useState<any[]>([]);
  const [loadingVendas, setLoadingVendas] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Estados locais para edição
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editGenero, setEditGenero] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchRifas();
  }, []);

  useEffect(() => {
    fetchRanking();
  }, [selectedRifa]);

  async function fetchRifas() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Verificar Role
      const { data: vData } = await supabase
        .from('vendedores')
        .select('id, is_admin')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      const isGuardiao = !!vData;
      setIsAdmin(!vData || vData.is_admin === true);

      let query = supabase.from('rifas').select('id, titulo');
      if (isGuardiao && (!vData || vData.is_admin === false)) {
        query = query.neq('status', 'rascunho');
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) {
        setRifas(data);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const handleVendedorClick = async (vendedor: any) => {
    if (!isAdmin) return;
    
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
      console.error("Erro ao buscar vendas do vendedor:", err);
      toast.error("Erro ao carregar vendas.");
    } finally {
      setLoadingVendas(false);
    }
  };

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
          avatar_url: editAvatarUrl
        })
        .eq('id', selectedVendedor.id);

      if (error) throw error;

      toast.success("Dados do guardião atualizados com sucesso!");
      
      setRanking(prev => prev.map(v => 
        v.id === selectedVendedor.id 
          ? { ...v, nome: editNome, telefone: editTelefone, email: editEmail, genero: editGenero, avatar_url: editAvatarUrl }
          : v
      ));

      setSelectedVendedor(prev => ({
        ...prev,
        nome: editNome,
        telefone: editTelefone,
        email: editEmail,
        genero: editGenero,
        avatar_url: editAvatarUrl
      }));

      setIsEditing(false);
    } catch (err: any) {
      console.error("Erro ao salvar dados do vendedor:", err);
      toast.error("Erro ao atualizar dados: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCompradorName = (fullName: string) => {
    if (!fullName) return "Sem nome";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return fullName;
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

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
      console.error("Erro ao fazer upload do avatar:", err);
      toast.error(`Erro no upload: ${err.message || "Erro desconhecido"}`);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  async function fetchRanking() {
    setLoading(true);
    try {
      // 1. Buscar todos os vendedores
      const { data: vendedores, error: vError } = await supabase
        .from('vendedores')
        .select('*');
      
      if (vError) throw vError;

      // 2. Buscar pedidos pagos com vendedor_id e quantidade de cotas
      let query = supabase.from('pedidos').select('vendedor_id, quantidade, valor_total').eq('status', 'pago').not('vendedor_id', 'is', null);
      if (selectedRifa !== "all") {
        query = query.eq('rifa_id', selectedRifa);
      }
      
      const { data: pedidos, error: pError } = await query;
      
      if (pError) throw pError;

      // 3. Processar ranking por cotas vendidas, valor total e número de pedidos
      const rankingData = (vendedores || []).map(v => {
        const ped = (pedidos || []).filter(p => p.vendedor_id === v.id);
        const cotas = ped.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);
        const valor = ped.reduce((acc, curr) => acc + Number(curr.valor_total || 0), 0);
        const qtdPedidos = ped.length;
        return {
          ...v,
          vendas: cotas,
          valor: valor,
          pedidos: qtdPedidos
        };
      });

      setRanking(rankingData);
    } catch (error) {
      console.error("Erro ao buscar ranking:", error);
    } finally {
      setLoading(false);
    }
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 1: return <Medal className="h-6 w-6 text-slate-400 dark:text-slate-550" />;
      case 2: return <Medal className="h-6 w-6 text-amber-600" />;
      default: return <span className="text-sm font-bold text-slate-400 dark:text-slate-500">#{index + 1}</span>;
    }
  };

  const formatShortName = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

  const renderTop10List = (title: string, data: any[], mode: 'vendas' | 'pedidos') => {
    return (
      <Card className="border border-slate-100 dark:border-slate-800 bg-card shadow-sm overflow-hidden w-full">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 py-3">
          <CardTitle className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold text-center">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.length > 0 ? (
              data.map((vendedor, index) => (
                <div 
                  key={vendedor.id} 
                  onClick={() => handleVendedorClick(vendedor)}
                  className={`flex items-center justify-between p-3 transition-colors ${isAdmin ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-6 flex justify-center shrink-0">
                      {getRankIcon(index)}
                    </div>
                    <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                      <AvatarImage src={vendedor.avatar_url} />
                      <AvatarFallback className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold text-xs">
                        {vendedor.nome?.charAt(0).toUpperCase() || <User size={12} />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{formatShortName(vendedor.nome)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-base font-black text-blue-600 dark:text-blue-400">
                      {mode === 'pedidos' ? vendedor.pedidos : vendedor.vendas}
                    </p>
                    <p className="text-[9px] uppercase font-bold text-slate-450 dark:text-slate-500">
                      {mode === 'pedidos' ? 'Vendas' : 'Cotas'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
               <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-450">Nenhum vendedor</div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center md:justify-start gap-2">
             <Trophy className="text-yellow-500" /> Ranking de Vendas
          </h1>
          <p className="hidden md:block text-slate-500 dark:text-slate-400 text-sm mt-1">Confira o engajamento dos maiores vendedores.</p>
        </div>
        
        <div className="w-full md:w-auto flex flex-col md:flex-row items-center gap-4">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full md:w-auto justify-center">
            <button
              onClick={() => setRankingMode('pedidos')}
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${rankingMode === 'pedidos' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Vendas
            </button>
            <button
              onClick={() => setRankingMode('quantidade')}
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${rankingMode === 'quantidade' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Cotas
            </button>
            <button
              onClick={() => setRankingMode('valor')}
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${rankingMode === 'valor' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Valor
            </button>
            <button
              onClick={() => setRankingMode('top10')}
              className={`flex-1 md:flex-none px-2 py-2 text-xs font-bold uppercase rounded-lg transition-all flex items-center justify-center ${
                rankingMode === 'top10' 
                  ? 'bg-amber-200 dark:bg-amber-300 text-black shadow-sm' 
                  : 'text-orange-500 dark:text-orange-400 bg-yellow-50 dark:bg-yellow-900/10 hover:bg-yellow-100 dark:hover:bg-yellow-900/20'
              }`}
            >
              TOP 10
            </button>
          </div>



          <div className="hidden md:flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-150 dark:border-slate-850 w-full md:w-64">
            <div className="bg-white dark:bg-slate-900 p-2 text-blue-600 dark:text-blue-400 rounded-lg shadow-sm border border-slate-150 dark:border-slate-800">
              <Trophy className="h-5 w-5" />
            </div>
            <Select value={selectedRifa} onValueChange={setSelectedRifa}>
              <SelectTrigger className="bg-transparent border-0 shadow-none focus:ring-0 font-bold text-slate-700 dark:text-slate-200 h-auto p-1 flex-1 text-left text-base line-clamp-1 truncate">
                <SelectValue>
                  {selectedRifa === "all" 
                    ? "Global" 
                    : rifas.find(r => r.id.toString() === selectedRifa)?.titulo || "Rifa"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl font-medium border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-250">
                <SelectItem value="all">🏆 Global</SelectItem>
                {rifas.map(r => (
                  <SelectItem key={r.id} value={r.id.toString()}>{r.titulo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : rankingMode === 'top10' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {renderTop10List("Feminino (Cotas)", [...ranking].filter(v => v.genero === 'feminino' && v.vendas > 0).sort((a, b) => b.vendas - a.vendas).slice(0, 10), 'vendas')}
          {renderTop10List("Masculino (Cotas)", [...ranking].filter(v => v.genero === 'masculino' && v.vendas > 0).sort((a, b) => b.vendas - a.vendas).slice(0, 10), 'vendas')}
          {renderTop10List("Geral (Vendas)", [...ranking].filter(v => v.pedidos > 0).sort((a, b) => b.pedidos - a.pedidos).slice(0, 10), 'pedidos')}
        </div>
      ) : (
        <Card className="border border-slate-100 dark:border-slate-800 bg-card shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between py-3 pl-4 !pr-0">
            <CardTitle className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Top Vendedores</CardTitle>
            <div className="w-44">
              <Select value={selectedGender} onValueChange={(value: any) => setSelectedGender(value)}>
                <SelectTrigger className="h-9 text-xs font-bold uppercase tracking-wider rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-sm">
                  <SelectValue placeholder="GÊNERO" />
                </SelectTrigger>
                <SelectContent align="end" className="rounded-xl font-bold uppercase tracking-wider border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-250 text-xs">
                  <SelectItem value="geral">👥 GERAL</SelectItem>
                  <SelectItem value="masculino">♂️ MASCULINO</SelectItem>
                  <SelectItem value="feminino">♀️ FEMININO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {ranking.length > 0 && ranking.some(v => v.vendas > 0 || v.valor > 0 || v.pedidos > 0) ? (
                [...ranking]
                .sort((a, b) => {
                  if (rankingMode === 'valor') return b.valor - a.valor;
                  if (rankingMode === 'pedidos') return b.pedidos - a.pedidos;
                  return b.vendas - a.vendas;
                })
                .filter(v => {
                  if (selectedGender !== 'geral' && v.genero !== selectedGender) return false;
                  if (rankingMode === 'valor') return v.valor > 0;
                  if (rankingMode === 'pedidos') return v.pedidos > 0;
                  return v.vendas > 0;
                })
                .map((vendedor, index) => (
                  <div 
                    key={vendedor.id} 
                    onClick={() => handleVendedorClick(vendedor)}
                    className={`flex items-center justify-between p-4 transition-colors ${isAdmin ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 flex justify-center shrink-0">
                        {getRankIcon(index)}
                      </div>
                      
                      <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                        <AvatarImage src={vendedor.avatar_url} />
                        <AvatarFallback className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold">
                          {vendedor.nome?.charAt(0).toUpperCase() || <User size={16} />}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{formatShortName(vendedor.nome)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-450 truncate">@{vendedor.codigo_ref}</p>
                      </div>
                    </div>

                    <div className="text-right">
                       {rankingMode === 'valor' ? (
                         <>
                           <p className="text-lg font-black text-blue-600 dark:text-blue-400">R$ {vendedor.valor.toFixed(2)}</p>
                           <p className="text-[10px] uppercase font-bold text-slate-450 dark:text-slate-500">Valor</p>
                         </>
                       ) : rankingMode === 'pedidos' ? (
                         <>
                           <p className="text-lg font-black text-blue-600 dark:text-blue-400">{vendedor.pedidos}</p>
                           <p className="text-[10px] uppercase font-bold text-slate-450 dark:text-slate-500">Vendas</p>
                         </>
                       ) : (
                         <>
                           <p className="text-lg font-black text-blue-600 dark:text-blue-400">{vendedor.vendas}</p>
                           <p className="text-[10px] uppercase font-bold text-slate-450 dark:text-slate-500">Cotas</p>
                         </>
                       )}
                    </div>
                  </div>
                ))
              ) : (
                 <div className="p-8 text-center text-slate-500 dark:text-slate-450">Nenhum vendedor encontrado no ranking.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Modal de Detalhes do Vendedor */}
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
              {/* Seção de Informações / Edição */}
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
                        <Input 
                          value={editNome} 
                          onChange={e => setEditNome(e.target.value)} 
                          className="h-9 text-xs" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-650 dark:text-slate-400">Telefone</label>
                        <Input 
                          value={editTelefone} 
                          onChange={e => setEditTelefone(e.target.value)} 
                          className="h-9 text-xs" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-650 dark:text-slate-400">E-mail</label>
                        <Input 
                          value={editEmail} 
                          onChange={e => setEditEmail(e.target.value)} 
                          className="h-9 text-xs" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-650 dark:text-slate-400">Gênero</label>
                        <Select value={editGenero} onValueChange={editGenero => setEditGenero(editGenero)}>
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

              {/* Seção de Vendas */}
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
                      <div key={venda.id} className="flex justify-between items-center p-3 hover:bg-slate-550/10 dark:hover:bg-slate-900/40 transition-colors">
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
                            <p className="font-bold text-slate-700 dark:text-slate-350 text-sm">
                              {venda.quantidade}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                              Cotas
                            </p>
                          </div>
                          <div>
                            <p className="font-bold text-green-600 dark:text-green-400 text-sm">
                              R$ {Number(venda.valor_total).toFixed(2)}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">
                              Valor
                            </p>
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

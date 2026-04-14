import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Image as ImageIcon, Plus, Trash2, Loader2, Upload, Trash, Trophy } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/src/lib/supabase";

export default function RifaForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [premios, setPremios] = useState<any[]>([{ id: 1, posicao: 1, titulo: "", descricao: "", valorEstimado: "", imagem_url: "" }]);
  const [deletedPremios, setDeletedPremios] = useState<string[]>([]);
  const [uploadingPremioId, setUploadingPremioId] = useState<number | string | null>(null);
  const [rifaToDelete, setRifaToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const premioFileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    totalNumeros: "",
    valorNumero: "",
    dataSorteio: "",
    timeoutReserva: "10",
    imagemUrl: "",
    slug: "",
    metaGuardiao: "50",
    status: "ativa",
    offPrice: "",
    qtdOff: ""
  });

  const [hasSoldNumbers, setHasSoldNumbers] = useState(false);
  const [initialTotalNumeros, setInitialTotalNumeros] = useState<number>(0);

  useEffect(() => {
    if (isEditing) {
      fetchRifa();
    }
  }, [id]);

  async function fetchRifa() {
    try {
      const { data: rifa, error: rifaError } = await supabase
        .from('rifas')
        .select(`
          *,
          numeros_rifa(status)
        `)
        .eq('id', id)
        .single();
        
      if (rifaError) throw rifaError;

      // Verificar se existem números vendidos
      const vendidos = rifa.numeros_rifa?.filter((n: any) => n.status === 'vendido').length || 0;
      setHasSoldNumbers(vendidos > 0);

      const { data: premiosData, error: premiosError } = await supabase
        .from('premios')
        .select('*')
        .eq('rifa_id', id)
        .order('posicao');
        
      if (premiosError) throw premiosError;

      // Format date for datetime-local input (YYYY-MM-DDThh:mm)
      let formattedDate = "";
      if (rifa.data_sorteio) {
        const dateObj = new Date(rifa.data_sorteio);
        formattedDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      }

      setFormData({
        titulo: rifa.titulo,
        descricao: rifa.descricao || "",
        totalNumeros: rifa.total_numeros.toString(),
        valorNumero: rifa.valor_numero.toString(),
        dataSorteio: formattedDate,
        timeoutReserva: rifa.timeout_reserva.toString(),
        imagemUrl: rifa.imagem_url || "",
        slug: rifa.slug || "",
        metaGuardiao: rifa.meta_guardiao ? rifa.meta_guardiao.toString() : "50",
        status: rifa.status,
        offPrice: rifa.off_price ? rifa.off_price.toString() : "",
        qtdOff: rifa.qtd_off ? rifa.qtd_off.toString() : ""
      });
      setInitialTotalNumeros(rifa.total_numeros);

      if (premiosData && premiosData.length > 0) {
        setPremios(premiosData.map(p => ({
          id: p.id,
          posicao: p.posicao,
          titulo: p.titulo,
          descricao: p.descricao || "",
          valorEstimado: p.valor_estimado ? p.valor_estimado.toString() : "",
          imagem_url: p.imagem_url || ""
        })));
      }
    } catch (error) {
      console.error("Erro ao buscar rifa:", error);
      alert("Erro ao carregar dados da rifa.");
      navigate("/admin/rifas");
    } finally {
      setInitialLoading(false);
    }
  }

  const addPremio = () => {
    const newPosicao = premios.length + 1;
    setPremios([...premios, { id: Date.now(), posicao: newPosicao, titulo: "", descricao: "", valorEstimado: "", imagem_url: "" }]);
  };

  const removePremio = (idToRemove: any) => {
    if (premios.length === 1) return;
    
    if (typeof idToRemove === 'string') {
      setDeletedPremios([...deletedPremios, idToRemove]);
    }
    
    const newPremios = premios.filter(p => p.id !== idToRemove).map((p, index) => ({ ...p, posicao: index + 1 }));
    setPremios(newPremios);
  };

  const updatePremio = (id: number | string, field: string, value: string) => {
    setPremios(premios.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .replace(/[\s-]+/g, '-') // Substitui espaços por hífens
      .replace(/^-+|-+$/g, ''); // Remove hífens no início e fim
  };

  const handleTituloChange = (titulo: string) => {
    const newSlug = generateSlug(titulo);
    setFormData({
      ...formData,
      titulo,
      slug: isEditing ? formData.slug : newSlug // Apenas gera slug automático se for novo
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validações básicas
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert("Por favor, selecione uma imagem válida (JPG, PNG, WEBP ou GIF).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      alert("A imagem é muito grande. O limite é de 5MB.");
      return;
    }

    try {
      setUploadingImage(true);
      
      const fileExt = file.name.split('.').pop();
      // Usar UUID ou timestamp + nome limpo para evitar conflitos e caracteres especiais
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = `rifas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, { 
          cacheControl: '3600',
          upsert: false 
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      
      setFormData({ ...formData, imagemUrl: data.publicUrl });
      
    } catch (error: any) {
      console.error("Erro ao fazer upload da imagem:", error);
      alert(`Erro no upload: ${error.message || "Erro desconhecido"}`);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePremioImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, premioId: number | string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem do prêmio é muito grande. O limite é de 2MB.");
      return;
    }

    try {
      setUploadingPremioId(premioId);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `premios/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      
      updatePremio(premioId, 'imagem_url', data.publicUrl);
      
    } catch (error: any) {
      console.error("Erro ao fazer upload da imagem do prêmio:", error);
      alert(`Erro no upload: ${error.message}`);
    } finally {
      setUploadingPremioId(null);
      if (premioFileInputRef.current) premioFileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação de Preço Promocional
    if (formData.offPrice && formData.valorNumero) {
      if (parseFloat(formData.offPrice) >= parseFloat(formData.valorNumero)) {
        alert("O preço promocional deve ser menor que o preço normal da cota.");
        return;
      }
    }

    setLoading(true);

    try {
      let rifaId = id;

      const rifaPayload: any = {
        titulo: formData.titulo,
        descricao: formData.descricao,
        total_numeros: parseInt(formData.totalNumeros),
        valor_numero: parseFloat(formData.valorNumero),
        data_sorteio: new Date(formData.dataSorteio).toISOString(),
        timeout_reserva: parseInt(formData.timeoutReserva),
        imagem_url: formData.imagemUrl || null,
        qtd_sorteios: premios.length,
        slug: formData.slug || null,
        meta_guardiao: parseInt(formData.metaGuardiao) || 50,
        status: formData.status,
        off_price: formData.offPrice ? parseFloat(formData.offPrice) : null,
        qtd_off: formData.qtdOff ? parseInt(formData.qtdOff) : null
      };

      if (isEditing) {
        // Update existing
        const { error: rifaError } = await supabase
          .from('rifas')
          .update(rifaPayload)
          .eq('id', id);
          
        if (rifaError) throw rifaError;
      } else {
        // Insert new
        rifaPayload.status = formData.status || 'ativa';
        const { data: rifaData, error: rifaError } = await supabase
          .from('rifas')
          .insert(rifaPayload)
          .select()
          .single();

        if (rifaError) throw rifaError;
        rifaId = rifaData.id;
      }

      // Handle deleted premios
      if (deletedPremios.length > 0) {
        const { error: deleteError } = await supabase
          .from('premios')
          .delete()
          .in('id', deletedPremios);
        if (deleteError) throw deleteError;
      }

      // Handle upsert premios
      const premiosToUpsert = premios.map(p => {
        const payload: any = {
          rifa_id: rifaId,
          posicao: p.posicao,
          titulo: p.titulo,
          descricao: p.descricao || null,
          valor_estimado: p.valorEstimado ? parseFloat(p.valorEstimado) : null,
          imagem_url: p.imagem_url || null
        };
        if (typeof p.id === 'string') {
          payload.id = p.id;
        }
        return payload;
      });

      const { error: premiosError } = await supabase
        .from('premios')
        .upsert(premiosToUpsert);

      if (premiosError) throw premiosError;

      navigate("/admin/rifas");
    } catch (error) {
      console.error("Erro ao salvar rifa:", error);
      alert("Erro ao salvar a rifa. Verifique o console para mais detalhes.");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('rifas').delete().eq('id', id);
      if (error) throw error;
      navigate("/admin/rifas");
    } catch (error) {
      console.error("Erro ao excluir rifa:", error);
      alert("Erro ao excluir a rifa.");
    } finally {
      setIsDeleting(false);
      setRifaToDelete(null);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" render={<Link to="/admin/rifas" />} nativeButton={false}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEditing ? "Editar Rifa" : "Nova Rifa"}</h1>
          <p className="text-gray-500">{isEditing ? "Altere os dados da rifa existente." : "Preencha os dados para criar uma nova rifa."}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="titulo">Título da Rifa</Label>
                  <Input 
                    id="titulo" 
                    placeholder="Ex: iPhone 15 Pro Max" 
                    required 
                    value={formData.titulo}
                    onChange={e => handleTituloChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug da Rifa (URL amigável)</Label>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400 text-sm">/rifa/</span>
                    <Input 
                      id="slug" 
                      placeholder="ex-vif-iphone-15" 
                      required 
                      value={formData.slug}
                      onChange={e => setFormData({...formData, slug: generateSlug(e.target.value)})}
                    />
                  </div>
                  <p className="text-xs text-gray-500">Este será o link da sua rifa: sua-url.com/rifa/<strong>{formData.slug || "titulo-da-rifa"}</strong></p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea 
                    id="descricao" 
                    placeholder="Descreva os detalhes do prêmio e regras..." 
                    className="min-h-[120px]"
                    value={formData.descricao}
                    onChange={e => setFormData({...formData, descricao: e.target.value})}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configurações de Venda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalNumeros">Total de Números</Label>
                    <Input 
                      id="totalNumeros" 
                      type="number" 
                      placeholder="Ex: 1000" 
                      required 
                      min={hasSoldNumbers ? initialTotalNumeros : "1"}
                      value={formData.totalNumeros}
                      onChange={e => setFormData({...formData, totalNumeros: e.target.value})}
                    />
                    {hasSoldNumbers && (
                      <p className="text-xs text-yellow-600 font-medium leading-tight">
                        ⚠️ Atenção: Como já existem vendas, você <b>só pode aumentar</b> a quantidade de números (mínimo de {initialTotalNumeros}).
                      </p>
                    )}
                    {isEditing && !hasSoldNumbers && (
                      <p className="text-xs text-green-600 font-medium">
                        ✓ Liberado: Nenhuma venda detectada, você pode ajustar as cotas livremente.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valorNumero">Valor por Número (R$)</Label>
                    <Input 
                      id="valorNumero" 
                      type="number" 
                      step="0.01" 
                      placeholder="Ex: 50.00" 
                      required 
                      min="0"
                      value={formData.valorNumero}
                      onChange={e => setFormData({...formData, valorNumero: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataSorteio">Data do Sorteio</Label>
                    <Input 
                      id="dataSorteio" 
                      type="datetime-local" 
                      required 
                      value={formData.dataSorteio}
                      onChange={e => setFormData({...formData, dataSorteio: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeoutReserva">Tempo de Reserva (minutos)</Label>
                    <Input 
                      id="timeoutReserva" 
                      type="number" 
                      required 
                      min="1"
                      value={formData.timeoutReserva}
                      onChange={e => setFormData({...formData, timeoutReserva: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="metaGuardiao">Meta de Vendas p/ Guardião (Cotas)</Label>
                    <Input 
                      id="metaGuardiao" 
                      type="number" 
                      required 
                      min="1"
                      value={formData.metaGuardiao}
                      onChange={e => setFormData({...formData, metaGuardiao: e.target.value})}
                    />
                    <p className="text-[10px] text-gray-500 italic">Meta universal para todos os vendedores desta rifa.</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
                    <Trophy className="h-4 w-4 mr-2" /> Preço Promocional (Opcional)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="offPrice">Preço Promocional (R$)</Label>
                      <Input 
                        id="offPrice" 
                        type="number" 
                        step="0.01" 
                        placeholder="Ex: 45.00" 
                        value={formData.offPrice}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData({...formData, offPrice: val});
                        }}
                      />
                      <p className="text-[10px] text-gray-500">Valor da cota se atingir a quantidade mínima.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qtdOff">Qtd Mínima para Promoção</Label>
                      <Input 
                        id="qtdOff" 
                        type="number" 
                        placeholder="Ex: 5" 
                        min="2"
                        value={formData.qtdOff}
                        onChange={e => setFormData({...formData, qtdOff: e.target.value})}
                      />
                      <p className="text-[10px] text-gray-500">A partir de quantos números o desconto se aplica.</p>
                    </div>
                  </div>
                  {formData.offPrice && formData.valorNumero && parseFloat(formData.offPrice) >= parseFloat(formData.valorNumero) && (
                    <p className="text-xs text-red-500 mt-2 font-medium">⚠️ Atenção: O preço promocional deve ser menor que o preço normal.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Gerenciamento de Prêmios</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addPremio}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Prêmio
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {premios.map((premio) => (
                  <div key={premio.id} className="p-4 border rounded-lg bg-gray-50 relative">
                    {premios.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removePremio(premio.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <h4 className="font-semibold mb-4 text-gray-700">{premio.posicao}º Prêmio</h4>
                    
                    <div className="flex flex-col md:flex-row gap-6 mb-4">
                      {/* Lado da Imagem */}
                      <div className="md:w-32 flex-shrink-0">
                        <Label className="mb-2 block text-xs">Imagem</Label>
                        <div className="h-32 w-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white relative overflow-hidden group">
                          {premio.imagem_url ? (
                            <>
                              <img src={premio.imagem_url} alt={`Prêmio ${premio.posicao}`} className="h-full w-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  size="sm" 
                                  variant="secondary" 
                                  className="h-7 text-[10px]" 
                                  type="button" 
                                  onClick={() => {
                                    setUploadingPremioId(premio.id);
                                    premioFileInputRef.current?.click();
                                  }}
                                >
                                  Mudar
                                </Button>
                              </div>
                            </>
                          ) : (
                            <button 
                              type="button"
                              className="flex flex-col items-center justify-center text-gray-400 hover:text-blue-500 transition-colors"
                              onClick={() => {
                                setUploadingPremioId(premio.id);
                                premioFileInputRef.current?.click();
                              }}
                            >
                              <ImageIcon className="h-8 w-8 mb-1" />
                              <span className="text-[10px]">Add Imagem</span>
                            </button>
                          )}
                          
                          {uploadingPremioId === premio.id && (
                            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Lado dos Campos */}
                      <div className="flex-1 space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Título do Prêmio</Label>
                            <Input 
                              placeholder="Ex: iPhone 15 Pro Max" 
                              required 
                              value={premio.titulo}
                              onChange={e => updatePremio(premio.id, 'titulo', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Valor Estimado (R$)</Label>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="Ex: 8500.00" 
                              value={premio.valorEstimado}
                              onChange={e => updatePremio(premio.id, 'valorEstimado', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Descrição (Opcional)</Label>
                          <Input 
                            placeholder="Detalhes adicionais sobre o prêmio" 
                            value={premio.descricao}
                            onChange={e => updatePremio(premio.id, 'descricao', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={premioFileInputRef}
                  onChange={(e) => {
                    if (uploadingPremioId) {
                      handlePremioImageUpload(e, uploadingPremioId);
                    }
                  }}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Status da Rifa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Visibilidade</Label>
                    <Select 
                      value={formData.status} 
                      onValueChange={(value) => setFormData({...formData, status: value})}
                    >
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rascunho">Desativada (Rascunho)</SelectItem>
                        <SelectItem value="ativa">Ativa (Visível ao Público)</SelectItem>
                        <SelectItem value="encerrada">Encerrada (Vendas Suspensas)</SelectItem>
                        <SelectItem value="sorteada">Sorteada (Finalizada)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.status === 'rascunho' && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      Rifas em rascunho não são visíveis para os compradores na página inicial.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Imagem de Capa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 relative overflow-hidden">
                      {formData.imagemUrl ? (
                        <img src={formData.imagemUrl} alt="Preview" className="object-cover w-full h-full absolute inset-0" />
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {uploadingImage ? (
                            <Loader2 className="w-8 h-8 mb-4 text-gray-500 animate-spin" />
                          ) : (
                            <Upload className="w-8 h-8 mb-4 text-gray-500" />
                          )}
                          <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Clique para fazer upload</span></p>
                          <p className="text-xs text-gray-500">PNG, JPG ou WEBP</p>
                        </div>
                      )}
                      <input 
                        id="dropzone-file" 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                    </label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imagemUrl">Ou cole a URL da Imagem</Label>
                    <Input 
                      id="imagemUrl" 
                      placeholder="https://exemplo.com/imagem.jpg" 
                      value={formData.imagemUrl}
                      onChange={e => setFormData({...formData, imagemUrl: e.target.value})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button type="submit" className="w-full" disabled={loading || uploadingImage}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {isEditing ? "Salvar Alterações" : "Criar Rifa"}
                </Button>
                <Button type="button" variant="outline" className="w-full" render={<Link to="/admin/rifas" />} nativeButton={false} disabled={loading || uploadingImage}>
                  Cancelar
                </Button>
              </CardContent>
            </Card>

            {isEditing && (
              <Card className="border-red-100 bg-red-50/30">
                <CardHeader>
                  <CardTitle className="text-red-600 text-sm">Zona de Risco</CardTitle>
                </CardHeader>
                <CardContent>
                  <button 
                    type="button" 
                    onClick={() => setRifaToDelete(id)}
                    className="text-red-400 hover:text-red-700 text-sm font-medium transition-colors flex items-center"
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Excluir esta Rifa
                  </button>
                  <p className="text-[10px] text-red-400 mt-2">Esta ação é irreversível e excluirá todos os dados da rifa.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </form>

      <Dialog open={!!rifaToDelete} onOpenChange={(open) => !open && setRifaToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Rifa</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta rifa? Esta ação não pode ser desfeita e apagará todos os prêmios e números associados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRifaToDelete(null)} disabled={isDeleting}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash className="h-4 w-4 mr-2" />}
              Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

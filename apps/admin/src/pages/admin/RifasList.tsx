import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash, Eye, Loader2, Link as LinkIcon, CheckCircle2, Calendar, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function RifasList() {
  const [rifas, setRifas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rifaToDelete, setRifaToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'guardiao'>('admin');
  const [vendedorRef, setVendedorRef] = useState<string | null>(null);

  useEffect(() => {
    fetchRifas();
  }, []);

  async function fetchRifas() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Identificar Role e ID se for Vendedor
      const { data: vData } = await supabase
        .from('vendedores')
        .select('id, codigo_ref')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      setUserRole(vData ? 'guardiao' : 'admin');
      if (vData) setVendedorRef(vData.codigo_ref);

      // 2. Buscar Rifas com contagem de números vendidos e pedidos pagos
      let rifasQuery = supabase
        .from('rifas')
        .select(`
          *,
          numeros_rifa(status),
          pedidos(status, valor_total)
        `);

      if (vData) {
        // Se for guardião, ocultar rascunhos
        rifasQuery = rifasQuery.neq('status', 'rascunho');
      }

      const { data, error } = await rifasQuery.order('created_at', { ascending: false });
      
      if (error) throw error;

      // Calcular progresso real para cada rifa
      const rifasComProgresso = (data || []).map(rifa => {
        // Contagem de números vendidos (pela tabela de números)
        const vendidos = rifa.numeros_rifa?.filter((n: any) => n.status === 'vendido').length || 0;
        
        // Faturamento real pelos pedidos pagos
        const pedidosPagos = rifa.pedidos?.filter((p: any) => p.status === 'pago') || [];
        const brutoTotal = pedidosPagos.reduce((acc: number, p: any) => acc + Number(p.valor_total || 0), 0);
        
        const progresso = (vendidos / rifa.total_numeros) * 100;
        const liquido = brutoTotal * 0.9901; // Desconto de 0.99%
        
        return { 
          ...rifa, 
          numerosVendidos: vendidos, 
          progresso, 
          faturamentoLiquido: liquido 
        };
      });

      setRifas(rifasComProgresso);
    } catch (error) {
      console.error("Erro ao buscar rifas:", error);
    } finally {
      setLoading(false);
    }
  }

  const confirmDelete = async () => {
    if (!rifaToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('rifas').delete().eq('id', rifaToDelete);
      if (error) throw error;
      setRifas(rifas.filter(r => r.id !== rifaToDelete));
      setRifaToDelete(null);
    } catch (error) {
      console.error("Erro ao excluir rifa:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const copyRecruitLink = () => {
    const url = `${window.location.origin}/recrutamento`;
    navigator.clipboard.writeText(url);
    setCopiedId('recruit');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyRifaLink = (rifa: any) => {
    const ref = userRole === 'guardiao' && vendedorRef ? `?ref=${vendedorRef}` : '';
    const publicOrigin = window.location.origin.includes('admin.') ? window.location.origin.replace('admin.', '') : window.location.origin;
    const url = `${publicOrigin}/${rifa.slug || rifa.id}${ref}`;
    navigator.clipboard.writeText(url);
    setCopiedId(rifa.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ativa":
        return <Badge className="bg-green-500">Ativa</Badge>;
      case "rascunho":
        return <Badge variant="secondary">Rascunho</Badge>;
      case "encerrada":
        return <Badge variant="destructive">Encerrada</Badge>;
      case "sorteada":
        return <Badge className="bg-blue-500">Sorteada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rifas</h1>
          <p className="text-gray-500">
            {userRole === 'admin' ? "Gerencie todas as rifas do sistema." : "Confira os sorteios disponíveis para venda."}
          </p>
        </div>
        {userRole === 'admin' && (
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={copyRecruitLink}>
              {copiedId === 'recruit' ? <><CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Copiado!</> : <><Shield className="mr-2 h-4 w-4" /> Recrutar Guardião</>}
            </Button>
            <Button className="flex-1 sm:flex-none" render={<Link to="/admin/rifas/nova" />} nativeButton={false}>
              <Plus className="mr-2 h-4 w-4" /> Nova Rifa
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : rifas.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Nenhuma rifa encontrada</h3>
          <p className="text-gray-500">Crie sua primeira rifa para começar.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rifas.map((rifa) => {
            return (
              <Card key={rifa.id} className="overflow-hidden flex flex-col hover:shadow-lg transition-shadow border-blue-100/50">
                <div className="relative h-48 w-full bg-gray-200 group">
                  {userRole === 'admin' ? (
                    <Link to={`/admin/rifas/${rifa.id}/editar`} className="block h-full w-full overflow-hidden">
                      {rifa.imagem_url ? (
                        <img
                          src={rifa.imagem_url}
                          alt={rifa.titulo}
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                          Sem imagem
                        </div>
                      )}
                    </Link>
                  ) : (
                    <>
                      {rifa.imagem_url ? (
                        <img
                          src={rifa.imagem_url}
                          alt={rifa.titulo}
                          className="object-cover w-full h-full"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                          Sem imagem
                        </div>
                      )}
                    </>
                  )}
                  <div className="absolute top-2 right-2 z-10">
                    {getStatusBadge(rifa.status)}
                  </div>
                  <div className="absolute bottom-2 left-2 z-10">
                    <Badge variant="outline" className="bg-black/40 text-white border-none backdrop-blur-md text-[10px] py-0.5 px-2">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(rifa.data_sorteio).toLocaleDateString('pt-BR')}
                    </Badge>
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg line-clamp-1">{rifa.titulo}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 pb-4">
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex justify-between">
                      <span>Valor:</span>
                      <span className="font-medium text-gray-900">R$ {Number(rifa.valor_numero).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Progresso:</span>
                      <span className="font-medium text-gray-900">
                        {rifa.numerosVendidos} / {rifa.total_numeros} ({rifa.progresso.toFixed(1)}%)
                      </span>
                    </div>

                    {rifa.faturamentoLiquido > 0 && (
                       <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-3">
                        <span className="text-gray-500 font-semibold text-xs uppercase tracking-wider">Arrecadado:</span>
                        <span className="font-black text-xl text-green-600">
                          {rifa.faturamentoLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    )}

                    <div className="w-full bg-gray-100 rounded-full h-5 mt-3 relative overflow-hidden border border-gray-200/50">
                      <div
                        className="bg-blue-600 h-full transition-all duration-1000 flex items-center justify-end"
                        style={{ width: `${rifa.progresso}%` }}
                      >
                        {rifa.progresso > 30 && (
                          <span className="text-[10px] font-black text-white px-2 uppercase tracking-tighter">
                            {rifa.numerosVendidos} VENDIDOS
                          </span>
                        )}
                      </div>
                      {rifa.progresso <= 30 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-tighter">
                            {rifa.numerosVendidos} VENDIDOS
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
                
                <div className="bg-gray-50/80 border-t border-gray-100 p-5 pt-4 rounded-b-xl flex flex-col gap-2.5 w-full">
                    {userRole === 'admin' && (
                      <div className="flex flex-col gap-2.5 w-full">
                        <Button 
                          variant="default" 
                          size="sm"
                          render={<Link to={`/admin/rifas/${rifa.id}/editar`} />}
                          nativeButton={false}
                          className="w-full h-11 text-sm font-bold bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-600/20 rounded-xl"
                        >
                          <Edit className="h-4 w-4 mr-2" /> Editar Rifa
                        </Button>

                        <div className="grid grid-cols-2 gap-2.5">
                          <Button
                            variant="secondary" 
                            size="sm"
                            onClick={() => copyRifaLink(rifa)}
                            className="h-10 text-xs font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 shadow-sm rounded-xl"
                          >
                            {copiedId === rifa.id ? (
                              <><CheckCircle2 className="h-4 w-4 mr-1.5 text-green-600" /> Copiado</>
                            ) : (
                              <><LinkIcon className="h-4 w-4 mr-1.5 text-blue-600" /> Copiar Link</>
                            )}
                          </Button>

                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => {
                              const publicOrigin = window.location.origin.includes('admin.') ? window.location.origin.replace('admin.', '') : window.location.origin;
                              window.open(`${publicOrigin}/${rifa.slug || rifa.id}${userRole === 'guardiao' && vendedorRef ? `?ref=${vendedorRef}` : ''}`, '_blank');
                            }}
                            className="h-10 text-xs font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 shadow-sm rounded-xl"
                          >
                            <Eye className="h-4 w-4 mr-1.5 text-indigo-600" /> Página
                          </Button>
                        </div>
                      </div>
                    )}

                    {userRole === 'guardiao' && (
                      <div className="flex flex-col gap-2.5 w-full">
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => {
                            const publicOrigin = window.location.origin.includes('admin.') ? window.location.origin.replace('admin.', '') : window.location.origin;
                            window.open(`${publicOrigin}/${rifa.slug || rifa.id}?ref=${vendedorRef}`, '_blank');
                          }}
                          className="w-full h-11 text-sm font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 shadow-sm rounded-xl"
                        >
                          <Eye className="h-4 w-4 mr-2 text-indigo-600" /> Ver Página
                        </Button>

                        <Button
                          variant="default"
                          size="sm"
                          className="w-full h-11 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 rounded-xl"
                          onClick={() => {
                            const publicOrigin = window.location.origin.includes('admin.') ? window.location.origin.replace('admin.', '') : window.location.origin;
                            const myRefLink = `${publicOrigin}/${rifa.slug || rifa.id}${vendedorRef ? `?ref=${vendedorRef}` : ''}`;
                            navigator.clipboard.writeText(myRefLink);
                            setCopiedId(rifa.id);
                            setTimeout(() => setCopiedId(null), 2000);
                          }}
                        >
                           {copiedId === rifa.id ? <><CheckCircle2 className="h-4 w-4 mr-2" /> COPIADO!</> : <><LinkIcon className="h-4 w-4 mr-2" /> COPIAR MEU LINK</>}
                        </Button>
                      </div>
                    )}
                  </div>
              </Card>
            );
          })}
        </div>
      )}

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
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

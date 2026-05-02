import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Clock, Search, Eye, Trash, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function VendasList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPedido, setSelectedPedido] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteConfirmed, setIsDeleteConfirmed] = useState(false);

  const { data: pedidosData, isLoading: loading, refetch: fetchPedidos } = useQuery({
    queryKey: ['pedidos-list'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      // 1. Identificar Role e ID se for Vendedor
      const { data: vData } = await supabase
        .from('vendedores')
        .select('id, is_admin')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      const role = (vData && vData.is_admin === false) ? 'guardiao' : 'admin';

      // 2. Query de Pedidos
      let query = supabase
        .from('pedidos')
        .select(`
          *,
          cliente:clientes(nome_completo, cpf, telefone, email),
          rifa:rifas(titulo),
          vendedor:vendedores(nome)
        `);

      if (role === 'guardiao' && vData) {
        query = query.eq('vendedor_id', vData.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      return {
        pedidos: data || [],
        role,
        vendedorId: vData?.id
      };
    }
  });

  const pedidos = pedidosData?.pedidos || [];
  const userRole = pedidosData?.role || 'admin';
  const vendedorId = pedidosData?.vendedorId;

  const handleAprovar = async (pedidoId: string) => {
    if (!confirm("Tem certeza que deseja aprovar esta venda manualmente?")) return;
    setActionLoading(true);
    try {
      // Atualiza status do pedido
      const { error: pedidoError } = await supabase
        .from('pedidos')
        .update({ status: 'pago', pago_em: new Date().toISOString() })
        .eq('id', pedidoId);
      
      if (pedidoError) throw pedidoError;

      // Atualiza status dos números
      const { error: numerosError } = await supabase
        .from('numeros_rifa')
        .update({ status: 'vendido' })
        .eq('pedido_id', pedidoId);

      if (numerosError) throw numerosError;

      alert("Venda aprovada com sucesso!");
      fetchPedidos();
      setSelectedPedido(null);
    } catch (error) {
      console.error("Erro ao aprovar venda:", error);
      alert("Erro ao aprovar venda.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelar = async (pedidoId: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta venda? Os números serão liberados.")) return;
    setActionLoading(true);
    try {
      // Atualiza status do pedido
      const { error: pedidoError } = await supabase
        .from('pedidos')
        .update({ status: 'cancelado' })
        .eq('id', pedidoId);
      
      if (pedidoError) throw pedidoError;

      // Deleta as reservas dos números
      const { error: numerosError } = await supabase
        .from('numeros_rifa')
        .delete()
        .eq('pedido_id', pedidoId);

      if (numerosError) throw numerosError;

      alert("Venda cancelada com sucesso!");
      fetchPedidos();
      setSelectedPedido(null);
    } catch (error) {
      console.error("Erro ao cancelar venda:", error);
      alert("Erro ao cancelar venda.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExcluir = async (pedidoId: string) => {
    setActionLoading(true);
    try {
      // Deleta os números primeiro por causa da FK (embora tenhamos cascade, é bom garantir)
      await supabase.from('numeros_rifa').delete().eq('pedido_id', pedidoId);
      
      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', pedidoId);

      if (error) throw error;

      alert("Venda excluída permanentemente!");
      fetchPedidos();
      setSelectedPedido(null);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error("Erro ao excluir venda:", error);
      alert("Erro ao excluir venda.");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPedidos = pedidos.filter(p => 
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.display_id && p.display_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
    p.cliente?.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cliente?.cpf.includes(searchTerm)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago': return <Badge className="bg-green-500">Pago</Badge>;
      case 'pendente': return <Badge className="bg-yellow-500">Pendente</Badge>;
      case 'expirado': return <Badge className="bg-red-500">Expirado</Badge>;
      case 'cancelado': return <Badge className="bg-gray-500">Cancelado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendas</h1>
          <p className="text-gray-500">Gerencie as compras e aprovações manuais.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Buscar por nome, CPF ou ID..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3 min-w-[120px]">Valor</th>
                <th className="px-6 py-3">Status</th>
                {userRole === 'admin' && <th className="px-6 py-3">Vendedor</th>}
                <th className="px-6 py-3">Rifa</th>
                <th className="px-6 py-3">ID / Data</th>
                {userRole === 'admin' && <th className="px-6 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
                  </td>
                </tr>
              ) : filteredPedidos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              ) : (
                filteredPedidos.map((pedido) => (
                  <tr 
                    key={pedido.id} 
                    className="bg-white border-b hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedPedido(pedido)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{pedido.cliente?.nome_completo || 'Cliente s/ nome'}</div>
                      <div className="text-xs text-gray-500">{pedido.cliente?.cpf}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">
                      R$ {Number(pedido.valor_total).toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(pedido.status)}
                    </td>
                    {userRole === 'admin' && (
                      <td className="px-6 py-4">
                        {pedido.venda_direta ? (
                          <div className="flex items-center gap-1.5">
                            {pedido.vendedor ? (
                              <span className="text-blue-600 font-medium flex items-center gap-1" title="Atribuído aleatoriamente">
                                <Search className="h-3 w-3 text-purple-500" /> {pedido.vendedor.nome}
                              </span>
                            ) : (
                              <Badge variant="outline" className="text-gray-400 font-normal bg-gray-50 flex items-center gap-1">
                                <Search className="h-3 w-3" /> Direto
                              </Badge>
                            )}
                          </div>
                        ) : (
                          pedido.vendedor ? (
                            <div className="text-blue-600 font-medium">{pedido.vendedor.nome}</div>
                          ) : (
                            <Badge variant="outline" className="text-gray-400 font-normal">Nenhum</Badge>
                          )
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="text-gray-900 truncate max-w-[150px]">{pedido.rifa?.titulo}</div>
                      <div className="text-xs text-gray-500">{pedido.quantidade} números</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs text-gray-900 font-bold">{pedido.display_id || pedido.id.substring(0, 8).toUpperCase()}</div>
                      <div className="text-xs text-gray-500">{new Date(pedido.created_at).toLocaleDateString('pt-BR')}</div>
                    </td>
                    {userRole === 'admin' && (
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedPedido(pedido)}>
                          <Eye className="h-4 w-4 mr-2" /> Detalhes
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={!!selectedPedido} onOpenChange={(open) => !open && setSelectedPedido(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Detalhes da Venda</DialogTitle>
            <DialogDescription className="flex flex-col gap-1">
              <span className="text-gray-900 font-black">Código: #{selectedPedido?.display_id}</span>
              <span className="text-[10px] text-gray-400">UUID: {selectedPedido?.id}</span>
              {selectedPedido?.mp_payment_id && (
                <span className="text-blue-600 font-semibold">ID Transação: {selectedPedido.mp_payment_id}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPedido && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Cliente</p>
                  <p className="font-medium text-gray-900">{selectedPedido.cliente?.nome_completo}</p>
                  <p className="text-sm text-gray-600">{selectedPedido.cliente?.cpf}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contato</p>
                  <p className="font-medium text-gray-900">{selectedPedido.cliente?.telefone}</p>
                  <p className="text-sm text-gray-600 truncate">{selectedPedido.cliente?.email}</p>
                </div>
              </div>

              {userRole === 'admin' && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-2">Guardião / Origem da Venda</p>
                  <div className="flex items-center gap-3">
                    {selectedPedido.venda_direta ? (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        <Search className="h-3 w-3 mr-1" /> Venda Direta
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Link de Indicação
                      </Badge>
                    )}
                    
                    {selectedPedido.vendedor && (
                      <span className="font-medium text-gray-900">
                        {selectedPedido.vendedor.nome} 
                        {selectedPedido.venda_direta && <span className="text-xs text-gray-500 font-normal ml-2">(Atribuído Aleatoriamente)</span>}
                      </span>
                    )}
                    {!selectedPedido.vendedor && selectedPedido.venda_direta && (
                      <span className="text-gray-500 italic text-sm">Nenhum guardião atribuído</span>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 mb-3">Números Escolhidos ({selectedPedido.quantidade})</p>
                <div className="bg-gray-50 p-4 rounded-lg border flex flex-wrap gap-2 justify-center">
                  {selectedPedido.numeros.map((num: any) => (
                    <div 
                      key={num} 
                      className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm border border-blue-700"
                    >
                      {num.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center border-t pt-4">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  {getStatusBadge(selectedPedido.status)}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Valor Total</p>
                  <p className="text-xl font-bold text-green-600">R$ {Number(selectedPedido.valor_total).toFixed(2)}</p>
                </div>
              </div>

              {userRole === 'admin' && (
                <div className="flex flex-col gap-3 pt-4 border-t">
                  {selectedPedido.status === 'pendente' && (
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => handleCancelar(selectedPedido.id)}
                        disabled={actionLoading}
                      >
                        <XCircle className="h-4 w-4 mr-2" /> Cancelar Pedido
                      </Button>
                      <Button 
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleAprovar(selectedPedido.id)}
                        disabled={actionLoading}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" /> Aprovar
                      </Button>
                    </div>
                  )}
                  
                  <Button 
                    variant="ghost" 
                    className="w-full text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setIsDeleteConfirmed(false);
                      setIsDeleteDialogOpen(true);
                    }}
                    disabled={actionLoading}
                  >
                    <Trash className="h-4 w-4 mr-2" /> Excluir Registro Permanente
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão (Dupla Confirmação) */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-center">Confirmar Exclusão</DialogTitle>
            <DialogDescription className="text-center">
              Esta ação excluirá permanentemente o pedido <strong>{selectedPedido?.id.substring(0, 8)}</strong> e todos os registros associados.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md border text-sm">
              <input 
                type="checkbox" 
                id="confirm-delete" 
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                checked={isDeleteConfirmed}
                onChange={(e) => setIsDeleteConfirmed(e.target.checked)}
              />
              <label htmlFor="confirm-delete" className="font-medium text-gray-700 cursor-pointer">
                Eu entendo que esta ação é irreversível.
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1" 
              disabled={!isDeleteConfirmed || actionLoading}
              onClick={() => selectedPedido && handleExcluir(selectedPedido.id)}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash className="h-4 w-4 mr-2" />}
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

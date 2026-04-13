import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, MoreHorizontal, Edit, Trash, Eye, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

export default function RifasList() {
  const [rifas, setRifas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rifaToDelete, setRifaToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchRifas();
  }, []);

  async function fetchRifas() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rifas')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setRifas(data || []);
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rifas</h1>
          <p className="text-gray-500">Gerencie todas as rifas do sistema.</p>
        </div>
        <Button render={<Link to="/admin/rifas/nova" />} nativeButton={false}>
          <Plus className="mr-2 h-4 w-4" /> Nova Rifa
        </Button>
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
            // Mock progress for now
            const numerosVendidos = 0;
            const progresso = 0;

            return (
              <Card key={rifa.id} className="overflow-hidden flex flex-col">
                <div className="relative h-48 w-full bg-gray-200">
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
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(rifa.status)}
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg line-clamp-1">{rifa.titulo}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex justify-between">
                      <span>Valor:</span>
                      <span className="font-medium text-gray-900">R$ {Number(rifa.valor_numero).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Progresso:</span>
                      <span className="font-medium text-gray-900">
                        {numerosVendidos} / {rifa.total_numeros} ({progresso.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${progresso}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-4 flex gap-2 items-center border-t border-gray-100">
                    <span className="text-xs text-gray-500 flex-1">
                      Sorteio: {new Date(rifa.data_sorteio).toLocaleDateString('pt-BR')}
                    </span>
                    
                    <Button 
                      variant="outline" 
                      size="icon-sm"
                      render={<Link to={`/admin/rifas/${rifa.id}/editar`} />}
                      nativeButton={false}
                      title="Editar Rifa"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Button 
                      variant="destructive" 
                      size="icon-sm"
                      onClick={() => setRifaToDelete(rifa.id)}
                      title="Excluir Rifa"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>

                    <Button 
                      variant="ghost" 
                      size="icon-sm"
                      render={<Link to={`/rifa/${rifa.id}`} />}
                      nativeButton={false}
                      title="Ver Página Pública"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
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

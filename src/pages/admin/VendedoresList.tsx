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
import { Plus, Search, MoreHorizontal, Edit, Trash, Copy, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

export default function VendedoresList() {
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
          .reduce((acc, curr) => acc + curr.quantidade, 0) || 0;
        return { ...vend, totalCotas };
      });

      setVendedores(vendedoresComVendas || []);
    } catch (error) {
      console.error("Erro ao buscar vendedores:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o vendedor "${nome}"? Esta ação não pode ser desfeita.`)) return;

    try {
      const { error } = await supabase.from('vendedores').delete().eq('id', id);
      if (error) throw error;
      setVendedores(vendedores.filter(v => v.id !== id));
      alert("Vendedor excluído com sucesso.");
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  const handleCopyLink = (codigo: string) => {
    const link = `${window.location.origin}?ref=${codigo}`;
    navigator.clipboard.writeText(link);
    alert("Link de vendedor copiado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendedores</h1>
          <p className="text-gray-500">Gerencie sua equipe de vendas e metas.</p>
        </div>
        <Button className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Novo Vendedor
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>Lista de Vendedores</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Buscar vendedor..."
                className="pl-8 w-full"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : vendedores.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              Nenhum vendedor cadastrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Código (Link)</TableHead>
                  <TableHead>Progresso da Meta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendedores.map((vendedor) => {
                  const numerosVendidos = vendedor.totalCotas || 0;
                  // Como a meta agora é por rifa, aqui na lista geral mostramos um placeholder 
                  // ou a soma de metas. Vamos usar 50 como padrão se não houver metas.
                  const metaExibir = 50; 
                  const progresso = Math.min((numerosVendidos / metaExibir) * 100, 100);

                  return (
                    <TableRow key={vendedor.id}>
                      <TableCell className="font-medium">{vendedor.nome}</TableCell>
                      <TableCell>
                        <div className="text-sm">{vendedor.email}</div>
                        <div className="text-xs text-gray-500">{vendedor.telefone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="font-mono bg-gray-50">
                            {vendedor.codigo_ref}
                          </Badge>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopyLink(vendedor.codigo_ref)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{numerosVendidos} cotas</span>
                            <span className="font-medium">
                              {/* Omitimos % se não houver meta global clara */}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                numerosVendidos >= vendedor.meta_numeros 
                                  ? 'bg-green-500' 
                                  : 'bg-blue-600'
                              }`}
                              style={{ width: `${progresso}%` }}
                            ></div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vendedor.status === 'ativo' ? (
                          <Badge className="bg-green-500">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" className="h-8 w-8 p-0" />}>
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => {
                                const tel = vendedor.telefone.replace(/\D/g, '');
                                window.open(`https://wa.me/55${tel}`, '_blank');
                              }}>
                                <MoreHorizontal className="mr-2 h-4 w-4 rotate-90" />
                                WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(vendedor.id, vendedor.nome)}>
                                <Trash className="mr-2 h-4 w-4" />
                                Excluir
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
    </div>
  );
}

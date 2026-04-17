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
import { Search, MoreHorizontal, Trash, Copy, Loader2, Shield, CheckCircle2, ExternalLink, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";

export default function VendedoresList() {
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);

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

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o guardião "${nome}"? Esta ação não pode ser desfeita.`)) return;

    try {
      const { error } = await supabase.from('vendedores').delete().eq('id', id);
      if (error) throw error;
      setVendedores(vendedores.filter(v => v.id !== id));
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  const handleCopiarLink = () => {
    const link = `http://rifa.virtudes.net.br/recrutamento`;
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
      alert("Erro ao atualizar cargo: " + err.message);
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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" /> Guardiões
          </h1>
          <p className="text-gray-500">Gerencie sua equipe de vendas e compare desempenhos.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none border-blue-200 text-blue-700 hover:bg-blue-50"
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
              <Users className="h-5 w-5 text-gray-400" />
              Lista de Guardiões
              {!loading && (
                <Badge variant="secondary" className="ml-2 font-bold">{vendedores.length}</Badge>
              )}
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
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
            <div className="text-center py-14 text-gray-400">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium text-gray-500">
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
                    <TableRow key={vendedor.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 ring-2 ring-white shadow-sm">
                            <AvatarImage src={vendedor.avatar_url} />
                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white text-xs font-bold">
                              {vendedor.nome ? vendedor.nome.charAt(0).toUpperCase() : 'G'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 flex items-center gap-1.5">
                              {vendedor.nome}
                              {vendedor.is_admin === true && (
                                <Badge className="h-4 px-1 text-[10px] bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100">Admin</Badge>
                              )}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5 min-w-[120px]">
                          <div className="flex justify-between text-xs">
                            <span className="font-bold text-gray-700">{totalCotas} cotas</span>
                            <span className={atingiuMeta ? "text-green-600 font-bold" : "text-gray-400"}>
                              meta: {metaReal}
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${atingiuMeta ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${progresso}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-slate-700">{vendedor.email}</div>
                        <div className="text-xs text-gray-500">{vendedor.telefone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="font-mono bg-gray-50 text-blue-700 border-blue-200">
                            {vendedor.codigo_ref}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              navigator.clipboard.writeText(`http://rifa.virtudes.net.br?ref=${vendedor.codigo_ref}`);
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {vendedor.ativo !== false ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200">Ativo</Badge>
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
                                const tel = vendedor.telefone?.replace(/\D/g, '');
                                if (tel) window.open(`https://wa.me/55${tel}`, '_blank');
                              }}>
                                📱 WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                navigator.clipboard.writeText(`http://rifa.virtudes.net.br?ref=${vendedor.codigo_ref}`);
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
    </div>
  );
}

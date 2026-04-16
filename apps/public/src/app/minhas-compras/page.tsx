"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, Ticket, Clock, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function MinhasCompras() {
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [clienteNome, setClienteNome] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("@rifa:client_data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cpf) {
          setCpf(parsed.cpf);
        }
      }
    } catch {}
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCpf = cpf.replace(/\D/g, '');
    
    if (cleanCpf.length !== 11) {
      alert("Por favor, digite um CPF válido com 11 dígitos.");
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('id, nome_completo')
        .eq('cpf', cleanCpf)
        .maybeSingle();

      if (clienteError) throw clienteError;

      if (!cliente) {
        setPedidos([]);
        setClienteNome("");
        return;
      }

      setClienteNome(cliente.nome_completo);

      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select(`
          *,
          rifa:rifas (
            id,
            titulo,
            imagem_url,
            data_sorteio
          )
        `)
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false });

      if (pedidosError) throw pedidosError;
      setPedidos(pedidosData || []);

    } catch (error) {
      console.error("Erro ao buscar compras:", error);
      alert("Ocorreu um erro ao buscar suas compras. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-green-500 border-0"><CheckCircle2 className="w-3 h-3 mr-1" /> Pago</Badge>;
      case 'pendente':
        return <Badge className="bg-yellow-500 border-0"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case 'expirado':
      case 'cancelado':
        return <Badge className="bg-red-500 border-0"><XCircle className="w-3 h-3 mr-1" /> {status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-blue-600 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para as rifas
        </Link>
      </div>

      <Card className="mb-8 border-0 shadow-md">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold">Consultar Meus Números</CardTitle>
          <p className="text-sm text-gray-500">Informe seu CPF para visualizar seus pedidos e números reservados.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input 
                id="cpf" 
                placeholder="000.000.000-00" 
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                maxLength={14}
                className="h-11"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full sm:w-40 h-11 bg-blue-600 hover:bg-blue-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <><Search className="h-4 w-4 mr-2" /> Buscar</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {searched && !loading && (
        <div className="space-y-6">
          {clienteNome && (
            <h2 className="text-lg font-medium text-gray-700 px-1">
              Olá, <span className="font-bold text-gray-900">{clienteNome.split(' ')[0]}</span>! Aqui estão seus pedidos:
            </h2>
          )}

          {pedidos.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
              <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900">Nenhuma compra encontrada</h3>
              <p className="text-gray-500 mt-2">Não encontramos pedidos vinculados a este CPF.</p>
              <Button asChild variant="outline" className="mt-6">
                <Link href="/">Ver Rifas Disponíveis</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {pedidos.map((pedido) => (
                <Card key={pedido.id} className="overflow-hidden border-0 shadow-md">
                  <div className="flex flex-col sm:flex-row">
                    <div className="w-full sm:w-48 h-32 sm:h-auto bg-gray-100 relative shrink-0">
                      {pedido.rifa?.imagem_url ? (
                        <img 
                          src={pedido.rifa.imagem_url} 
                          alt={pedido.rifa.titulo} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Ticket className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2 gap-4">
                          <h3 className="font-bold text-lg text-gray-900 line-clamp-1">
                            {pedido.rifa?.titulo || "Sorteio Inválido"}
                          </h3>
                          {getStatusBadge(pedido.status)}
                        </div>
                        
                        <div className="text-xs text-gray-500 mb-4 flex items-center gap-2">
                          <span className="font-medium">#{pedido.display_id || pedido.id.substring(0, 8).toUpperCase()}</span>
                          <span>•</span>
                          <span>{new Date(pedido.created_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                        
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2">Seus números ({pedido.quantidade})</p>
                          <div className="flex flex-wrap gap-1.5">
                            {pedido.numeros.map((num: number) => (
                              <Badge key={num} variant="secondary" className="bg-white border-blue-100 text-blue-700 font-mono">
                                {num.toString().padStart(2, '0')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-50">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Total do pedido</span>
                          <span className="text-xl font-black text-gray-900">R$ {Number(pedido.valor_total).toFixed(2)}</span>
                        </div>
                        
                        {pedido.status === 'pendente' && (
                          <Button asChild size="sm" className="bg-green-600 hover:bg-green-700">
                            <Link href={`/${pedido.slug || pedido.rifa_id}`}>
                              Pagar Agora
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

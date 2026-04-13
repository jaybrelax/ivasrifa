import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Trophy, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/src/lib/supabase";

export default function RifaDetails() {
  const { id } = useParams();
  const [rifa, setRifa] = useState<any>(null);
  const [premios, setPremios] = useState<any[]>([]);
  const [numerosVendidos, setNumerosVendidos] = useState<number[]>([]);
  const [numerosReservados, setNumerosReservados] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1); // 1: Identificação, 2: Resumo, 3: PIX, 4: Sucesso
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: ""
  });

  useEffect(() => {
    async function fetchRifaData() {
      if (!id) return;
      
      try {
        // 1. Fetch Rifa (by ID or Slug)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        
        let query = supabase.from('rifas').select('*');
        if (isUuid) {
          query = query.eq('id', id);
        } else {
          query = query.eq('slug', id);
        }

        const { data: rifaData, error: rifaError } = await query.single();
          
        if (rifaError) throw rifaError;
        setRifa(rifaData);

        const realId = rifaData.id; // Use o ID real para as próximas consultas

        // 2. Fetch Premios
        const { data: premiosData, error: premiosError } = await supabase
          .from('premios')
          .select('*')
          .eq('rifa_id', realId)
          .order('posicao', { ascending: true });
          
        if (premiosError) throw premiosError;
        setPremios(premiosData || []);

        // 3. Fetch Numeros (Vendidos e Reservados)
        const { data: numerosData, error: numerosError } = await supabase
          .from('numeros_rifa')
          .select('numero, status')
          .eq('rifa_id', realId);
          
        if (numerosError) throw numerosError;
        
        if (numerosData) {
          setNumerosVendidos(numerosData.filter(n => n.status === 'vendido').map(n => n.numero));
          setNumerosReservados(numerosData.filter(n => n.status === 'reservado').map(n => n.numero));
        }

      } catch (error) {
        console.error("Erro ao buscar detalhes da rifa:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRifaData();
  }, [id]);

  const handleNumberClick = (num: number) => {
    if (numerosVendidos.includes(num) || numerosReservados.includes(num)) {
      return; // Cannot select sold or reserved
    }

    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else {
      setSelectedNumbers([...selectedNumbers, num]);
    }
  };

  const selectRandom = (qtd: number) => {
    if (!rifa) return;
    const available = Array.from({ length: rifa.total_numeros }, (_, i) => i + 1)
      .filter(n => !numerosVendidos.includes(n) && !numerosReservados.includes(n) && !selectedNumbers.includes(n));
    
    const shuffled = available.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, qtd);
    setSelectedNumbers([...selectedNumbers, ...selected]);
  };

  const getNumberStatusClass = (num: number) => {
    if (numerosVendidos.includes(num)) return "bg-green-500 text-white border-green-600 cursor-not-allowed opacity-80";
    if (numerosReservados.includes(num)) return "bg-yellow-400 text-yellow-900 border-yellow-500 cursor-not-allowed opacity-80";
    if (selectedNumbers.includes(num)) return "bg-blue-600 text-white border-blue-700 shadow-md transform scale-105";
    return "bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer";
  };

  const [pixData, setPixData] = useState<{ qr_code_base64?: string, qr_code?: string, payment_id?: string } | null>(null);
  const [pedidoId, setPedidoId] = useState<string | null>(null);

  // Poll for payment status when on PIX step
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (checkoutStep === 3 && pedidoId) {
      interval = setInterval(async () => {
        try {
          const { data, error } = await supabase
            .from('pedidos')
            .select('status')
            .eq('id', pedidoId)
            .single();
            
          if (!error && data && data.status === 'pago') {
            setCheckoutStep(4);
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Erro ao verificar status do pedido:", err);
        }
      }, 5000); // Verifica a cada 5 segundos
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [checkoutStep, pedidoId]);

  const handleCheckout = async () => {
    if (!rifa) return;
    setIsSubmitting(true);
    try {
      // Chamada unificada para o Backend (O servidor cuida do cliente e do pedido via Admin Key)
      const response = await fetch('/api/pagamento/pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rifa_id: rifa.id,
          cliente: {
            nome: formData.nome,
            cpf: formData.cpf,
            email: formData.email,
            telefone: formData.telefone
          },
          numeros: selectedNumbers
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao processar pedido");
      }

      setPedidoId(data.pedido_id);
      setPixData(data);
      setCheckoutStep(3);
    } catch (error: any) {
      console.error("Erro no checkout:", error);
      alert(error.message || "Ocorreu um erro ao processar seu pedido. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!rifa) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Rifa não encontrada</h2>
        <Button render={<Link to="/" />} nativeButton={false}>Voltar para o Início</Button>
      </div>
    );
  }

  const totalValue = selectedNumbers.length * rifa.valor_numero;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Hero Section */}
      <div className="relative h-64 md:h-80 w-full bg-gray-900">
        {rifa.imagem_url ? (
          <img
            src={rifa.imagem_url}
            alt={rifa.titulo}
            className="object-cover w-full h-full opacity-60"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gray-800 opacity-60"></div>
        )}
        <div className="absolute top-4 left-4">
          <Button variant="secondary" size="sm" render={<Link to="/" />} nativeButton={false} className="bg-white/90 hover:bg-white text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent">
          <div className="max-w-5xl mx-auto">
            <Badge className="bg-green-500 mb-2">Sorteio Ativo</Badge>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{rifa.titulo}</h1>
            <div className="flex items-center text-gray-300 text-sm">
              <Clock className="h-4 w-4 mr-2" />
              Sorteio: {new Date(rifa.data_sorteio).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid md:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-4">Sobre a Rifa</h2>
              <p className="text-gray-600 whitespace-pre-line">{rifa.descricao || "Sem descrição disponível."}</p>
              
              {premios.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold flex items-center mb-3">
                    <Trophy className="h-5 w-5 text-yellow-500 mr-2" /> Prêmios
                  </h3>
                  <div className="space-y-2">
                    {premios.map(premio => (
                      <div key={premio.id} className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-100 gap-4">
                        <div className="flex-shrink-0 w-16 h-16 rounded-md bg-white border border-gray-200 overflow-hidden">
                          {premio.imagem_url ? (
                            <img src={premio.imagem_url} alt={premio.titulo} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <Trophy className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                             <span className="font-bold text-blue-600 text-sm">{premio.posicao}º PRÊMIO</span>
                             {premio.valor_estimado && <span className="text-xs text-gray-500">Valor: R$ {Number(premio.valor_estimado).toLocaleString('pt-BR')}</span>}
                          </div>
                          <h4 className="font-medium text-gray-900">{premio.titulo}</h4>
                          {premio.descricao && <p className="text-xs text-gray-500 line-clamp-1">{premio.descricao}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="numeros">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-xl font-bold">Escolha seus números</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => selectRandom(1)}>+1 Aleatório</Button>
                  <Button variant="outline" size="sm" onClick={() => selectRandom(5)}>+5 Aleatórios</Button>
                </div>
              </div>

              <div className="flex gap-4 mb-6 text-sm">
                <div className="flex items-center"><div className="w-4 h-4 rounded bg-white border border-gray-300 mr-2"></div> Disponível</div>
                <div className="flex items-center"><div className="w-4 h-4 rounded bg-blue-600 mr-2"></div> Selecionado</div>
                <div className="flex items-center"><div className="w-4 h-4 rounded bg-yellow-400 mr-2"></div> Reservado</div>
                <div className="flex items-center"><div className="w-4 h-4 rounded bg-green-500 mr-2"></div> Vendido</div>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {Array.from({ length: rifa.total_numeros }, (_, i) => i + 1).map(num => (
                  <button
                    key={num}
                    onClick={() => handleNumberClick(num)}
                    className={`h-10 rounded-md border font-medium text-sm transition-all flex items-center justify-center ${getNumberStatusClass(num)}`}
                  >
                    {num.toString().padStart(rifa.total_numeros > 99 ? 3 : 2, '0')}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar / Sticky Checkout */}
        <div className="md:col-span-1">
          <div className="sticky top-24">
            <Card className="border-blue-200 shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-4">Resumo da Compra</h3>
                
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                  <span className="text-gray-600">Valor por número</span>
                  <span className="font-bold text-gray-900">R$ {Number(rifa.valor_numero).toFixed(2)}</span>
                </div>

                <div className="mb-6">
                  <span className="text-sm text-gray-500 block mb-2">Números selecionados ({selectedNumbers.length}):</span>
                  {selectedNumbers.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {selectedNumbers.map(n => (
                        <Badge key={n} variant="secondary" className="bg-blue-100 text-blue-800">
                          {n.toString().padStart(rifa.total_numeros > 99 ? 3 : 2, '0')}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Nenhum número selecionado</p>
                  )}
                </div>

                <div className="flex justify-between items-center mb-6 pt-4 border-t border-gray-100">
                  <span className="text-lg font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-extrabold text-green-600">R$ {totalValue.toFixed(2)}</span>
                </div>

                <Button 
                  className="w-full h-12 text-lg bg-green-600 hover:bg-green-700" 
                  disabled={selectedNumbers.length === 0}
                  onClick={() => {
                    setCheckoutStep(1);
                    setIsModalOpen(true);
                  }}
                >
                  Participar Agora
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {checkoutStep === 1 && "Seus Dados"}
              {checkoutStep === 2 && "Confirmar Pedido"}
              {checkoutStep === 3 && "Pagamento PIX"}
              {checkoutStep === 4 && "Sucesso!"}
            </DialogTitle>
            <DialogDescription>
              {checkoutStep === 1 && "Preencha seus dados para garantir seus números."}
              {checkoutStep === 2 && "Revise seus números antes de gerar o pagamento."}
              {checkoutStep === 3 && "Escaneie o QR Code ou copie o código PIX."}
            </DialogDescription>
          </DialogHeader>

          {checkoutStep === 1 && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input id="nome" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} placeholder="João da Silva" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">WhatsApp</Label>
                <Input id="telefone" value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="joao@email.com" />
              </div>
            </div>
          )}

          {checkoutStep === 2 && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Resumo</h4>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Quantidade:</span>
                  <span className="font-medium">{selectedNumbers.length} números</span>
                </div>
                <div className="flex justify-between text-sm mb-4">
                  <span className="text-gray-600">Números:</span>
                  <span className="font-medium text-right max-w-[200px] truncate">
                    {selectedNumbers.join(", ")}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                  <span className="font-bold text-gray-900">Total a pagar:</span>
                  <span className="text-xl font-bold text-green-600">R$ {totalValue.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-start text-sm text-yellow-800 bg-yellow-50 p-3 rounded-md">
                <AlertCircle className="h-5 w-5 mr-2 shrink-0" />
                <p>Seus números ficarão reservados por {rifa.timeout_reserva} minutos após gerar o PIX.</p>
              </div>
            </div>
          )}

          {checkoutStep === 3 && (
            <div className="flex flex-col items-center py-6 space-y-6">
              <div className="bg-gray-100 p-4 rounded-xl">
                {pixData?.qr_code_base64 ? (
                  <img 
                    src={`data:image/jpeg;base64,${pixData.qr_code_base64}`} 
                    alt="QR Code PIX" 
                    className="w-48 h-48 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 bg-white border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                    Gerando QR Code...
                  </div>
                )}
              </div>
              <div className="w-full space-y-2 text-center">
                <p className="text-sm text-gray-600">Ou copie o código abaixo:</p>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={pixData?.qr_code || "Aguarde..."} 
                    className="font-mono text-xs" 
                  />
                  <Button 
                    variant="secondary"
                    onClick={() => {
                      if (pixData?.qr_code) {
                        navigator.clipboard.writeText(pixData.qr_code);
                        alert("Código PIX copiado!");
                      }
                    }}
                    disabled={!pixData?.qr_code}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900">Aguardando pagamento...</p>
                <p className="text-xs text-gray-500">ID da Transação: {pixData?.payment_id}</p>
                <p className="text-xs text-gray-500">Tempo restante: {String((rifa.timeout_reserva || 15) - 1).padStart(2, '0')}:59</p>
              </div>
              {/* Simulate payment success for demo */}
              <Button variant="ghost" size="sm" onClick={() => setCheckoutStep(4)} className="mt-4 text-[10px] text-gray-300 hover:text-gray-500">
                (Simular Sucesso)
              </Button>
            </div>
          )}

          {checkoutStep === 4 && (
            <div className="flex flex-col items-center py-8 space-y-4 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Pagamento Confirmado!</h3>
              <p className="text-gray-600">
                Seus números foram garantidos com sucesso. Boa sorte!
              </p>
              <div className="bg-gray-50 p-4 rounded-lg w-full mt-4 space-y-2 text-left">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Resumo do Pedido:</p>
                  <p className="text-sm text-gray-700">Pedido: #{pedidoId?.substring(0, 8)}</p>
                  <p className="text-sm text-gray-700">Transação: {pixData?.payment_id}</p>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Seus números:</p>
                  <p className="font-mono text-lg font-bold text-blue-600 break-all">{selectedNumbers.join(", ")}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {checkoutStep === 1 && (
              <Button className="w-full sm:w-auto" onClick={() => setCheckoutStep(2)}>Continuar</Button>
            )}
            {checkoutStep === 2 && (
              <>
                <Button variant="outline" className="w-full sm:w-auto" onClick={() => setCheckoutStep(1)} disabled={isSubmitting}>Voltar</Button>
                <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700" onClick={handleCheckout} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Gerar PIX
                </Button>
              </>
            )}
            {checkoutStep === 4 && (
              <Button className="w-full" onClick={() => {
                setIsModalOpen(false);
                setSelectedNumbers([]);
                setCheckoutStep(1);
                // Reload data to show numbers as sold/reserved
                window.location.reload();
              }}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

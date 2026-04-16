"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Trophy, Clock, CheckCircle2, AlertCircle, Loader2, Copy, Shuffle, Ticket, X, Plus } from "lucide-react";
import { supabase } from "@shared/supabaseClient";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface RifaDetailsClientProps {
  initialRifa: any;
  initialPremios: any[];
  initialNumbers: any[];
  config: any;
}

export default function RifaDetailsClient({ initialRifa, initialPremios, initialNumbers, config }: RifaDetailsClientProps) {
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");

  const [rifa] = useState<any>(initialRifa);
  const [premios] = useState<any[]>(initialPremios);
  const [numerosVendidos, setNumerosVendidos] = useState<number[]>(
    initialNumbers.filter((n) => n.status === "vendido").map((n) => n.numero)
  );
  const [numerosReservados, setNumerosReservados] = useState<number[]>(
    initialNumbers.filter((n) => n.status === "reservado").map((n) => n.numero)
  );
  const [numerosEmSelecao, setNumerosEmSelecao] = useState<number[]>([]);
  const [loading] = useState(false);

  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 12));
  const channelRef = useRef<any>(null);

  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);

  const [formData, setFormData] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem("@rifa:client_data");
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            nome: parsed.nome || "",
            cpf: parsed.cpf || "",
            email: parsed.email || "",
            telefone: parsed.telefone || ""
          };
        }
      } catch {}
    }
    return { nome: "", cpf: "", email: "", telefone: "" };
  });

  const [pixData, setPixData] = useState<{ qr_code_base64?: string; qr_code?: string; payment_id?: string } | null>(null);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Guardar ref se houver
  useEffect(() => {
    if (refCode && typeof window !== 'undefined') {
      localStorage.setItem("@rifa:guardiao_ref", refCode);
    }
  }, [refCode]);

  // Sincronizar as seleções em tempo real usando Supabase Presence
  useEffect(() => {
    if (!rifa?.id) return;

    const room = supabase.channel(`rifa-${rifa.id}`, {
      config: { presence: { key: sessionId } }
    });

    channelRef.current = room;

    room.on('presence', { event: 'sync' }, () => {
      const newState = room.presenceState();
      let othersNumbers: number[] = [];

      for (const id in newState) {
        if (id === sessionId) continue;
        for (const presence of (newState[id] as any)) {
          if (presence.selected && Array.isArray(presence.selected)) {
            othersNumbers.push(...presence.selected);
          }
        }
      }
      setNumerosEmSelecao(othersNumbers);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        room.track({ selected: selectedNumbers }).catch(() => { });
      }
    });

    return () => {
      supabase.removeChannel(room);
    };
  }, [rifa?.id, sessionId, selectedNumbers]);

  // Poll de pagamento
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (checkoutStep === 3 && pedidoId) {
      interval = setInterval(async () => {
        try {
          const { data, error } = await supabase.from("pedidos").select("status").eq("id", pedidoId).single();
          if (!error && data && data.status === "pago") {
            if (typeof window !== 'undefined') {
              localStorage.setItem("@rifa:client_data", JSON.stringify(formData));
            }
            setCheckoutStep(4);
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Erro ao verificar status:", err);
        }
      }, 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [checkoutStep, pedidoId, formData]);

  const handleNumberClick = (num: number) => {
    if (numerosVendidos.includes(num) || numerosReservados.includes(num) || numerosEmSelecao.includes(num)) return;
    setSelectedNumbers((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };

  const selectRandom = (qtd: number) => {
    if (!rifa) return;
    const available = Array.from({ length: rifa.total_numeros }, (_, i) => i + 1)
      .filter((n) => !numerosVendidos.includes(n) && !numerosReservados.includes(n) && !selectedNumbers.includes(n) && !numerosEmSelecao.includes(n));
    const selected = available.sort(() => 0.5 - Math.random()).slice(0, qtd);
    setSelectedNumbers((prev) => [...prev, ...selected]);
  };

  const getNumberStatusClass = (num: number) => {
    if (numerosVendidos.includes(num)) return "bg-green-500 text-white border-green-600 cursor-not-allowed";
    if (numerosReservados.includes(num) || numerosEmSelecao.includes(num)) return "bg-yellow-400 text-yellow-900 border-yellow-500 cursor-not-allowed";
    if (selectedNumbers.includes(num)) return "bg-blue-600 text-white border-blue-700 shadow-md scale-105";
    return "bg-white text-gray-700 border-gray-300 active:scale-95 cursor-pointer hover:border-blue-400 hover:bg-blue-50";
  };

  const handleCheckout = async () => {
    if (!rifa) return;
    setIsSubmitting(true);
    setCheckoutError(null);
    try {
      const guardiaoRef = typeof window !== 'undefined' ? localStorage.getItem("@rifa:guardiao_ref") : null;

      // Note: In Next.js, we might need to point correctly to the Admin API
      // Since they are on different domains in production, we'll need the absolute URL or a proxy
      // For now, I'll assume standard proxying or absolute URL from env
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://admin.ivasrifas.com.br";
      
      const response = await fetch(`${apiUrl}/api/pagamento/pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rifa_id: rifa.id,
          cliente: { nome: formData.nome, cpf: formData.cpf, email: formData.email, telefone: formData.telefone },
          numeros: selectedNumbers,
          vendedor_ref: guardiaoRef,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao processar pedido");
      setPedidoId(data.pedido_id);
      setPixData(data);
      setCheckoutStep(3);
    } catch (error: any) {
      if (error.message?.includes("Invalid user identification number") || error.message?.includes("invalid identification.number")) {
        setCheckoutError("CPF inválido! Por favor, clique em VOLTAR e corrija o número do seu documento.");
      } else {
        setCheckoutError(error.message || "Ocorreu um erro ao gerar o pagamento. Tente novamente.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPix = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 3000);
    }
  };

  const hasPromo = rifa.off_price && rifa.qtd_off;
  const isPromoActive = hasPromo && selectedNumbers.length >= rifa.qtd_off;
  const currentUnitPrice = isPromoActive ? rifa.off_price : rifa.valor_numero;
  const totalValue = selectedNumbers.length * currentUnitPrice;
  const padNum = (n: number) => n.toString().padStart(rifa.total_numeros > 99 ? 3 : 2, "0");

  return (
    <div className="bg-gray-50 pb-28 md:pb-12">
      {/* ── HERO ── */}
      <div className="relative h-56 sm:h-64 md:h-80 w-full bg-gray-900">
        {rifa.imagem_url ? (
          <img src={rifa.imagem_url} alt={rifa.titulo} className="object-cover w-full h-full opacity-60" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-900 to-indigo-900 opacity-80" />
        )}
        <div className="absolute top-3 left-3">
          <Link href="/">
            <Button variant="secondary" size="sm" className="bg-white/90 hover:bg-white text-gray-900 shadow">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Button>
          </Link>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 to-transparent">
          <div className="max-w-5xl mx-auto">
            <Badge className="bg-green-500 mb-2 border-0">Sorteio Ativo</Badge>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-white mb-1 leading-tight">{rifa.titulo}</h1>
            <div className="flex items-center text-gray-300 text-xs sm:text-sm">
              <Clock className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              Sorteio: {new Date(rifa.data_sorteio).toLocaleDateString("pt-BR")}
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO ── */}
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-5 md:py-8">
        <div className="flex flex-col md:grid md:grid-cols-3 gap-5 md:gap-8">

          {/* Coluna principal */}
          <div className="md:col-span-2 space-y-5">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold mb-3">Sobre a Rifa</h2>
                <p className="text-gray-600 whitespace-pre-line text-sm sm:text-base">{rifa.descricao || "Sem descrição disponível."}</p>

                {premios.length > 0 && (
                  <div className="mt-5 space-y-6">
                    {/* Bônus */}
                    {premios.filter(p => p.is_bonus).length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-semibold flex items-center text-sm sm:text-base text-purple-700">
                          <Plus className="h-4 w-4 mr-2" /> Bônus Exclusivos
                        </h3>
                        {premios.filter(p => p.is_bonus).map((premio) => (
                          <div key={premio.id} className="flex flex-col md:flex-row items-stretch gap-4 rounded-xl border p-4 bg-gradient-to-br from-purple-50 to-white border-purple-200 shadow-sm transition-all duration-300">
                            <div className="flex-shrink-0 rounded-lg border border-purple-100 bg-white overflow-hidden w-full md:w-40 h-32 sm:h-40">
                              {premio.imagem_url ? (
                                <img src={premio.imagem_url} alt={premio.titulo} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-purple-200">
                                  <Trophy className="h-10 w-10" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 flex flex-col justify-center min-w-0">
                              <div className="flex justify-between items-start gap-2 flex-wrap mb-1">
                                <span className="font-black uppercase tracking-normal text-purple-600 text-[10px]">🎁 BÔNUS DISPONÍVEL</span>
                                {premio.valor_estimado && (
                                  <span className="font-bold text-green-600 text-base">R$ {Number(premio.valor_estimado).toLocaleString("pt-BR")}</span>
                                )}
                              </div>
                              <h4 className="font-bold text-gray-900 text-lg sm:text-xl leading-snug">{premio.titulo}</h4>
                              {premio.descricao && <p className="text-gray-500 mt-1 text-sm line-clamp-2">{premio.descricao}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Prêmios */}
                    <div className="space-y-3">
                      <h3 className="font-semibold flex items-center text-sm sm:text-base text-blue-800">
                        <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 mr-2 shrink-0" /> Premiação
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        {premios.filter(p => !p.is_bonus).sort((a,b) => a.posicao - b.posicao).map((premio) => (
                          <div
                            key={premio.id}
                            className={`
                              flex flex-col md:flex-row items-stretch gap-4 rounded-xl border transition-all duration-300
                              ${premio.posicao === 1
                                ? 'p-5 bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-md'
                                : 'p-3 bg-gray-50 border-gray-100 items-center'
                              }
                            `}
                          >
                            <div className={`
                              flex-shrink-0 rounded-lg border border-gray-200 bg-white overflow-hidden
                              ${premio.posicao === 1
                                ? 'w-full md:w-48 h-48 sm:h-56'
                                : 'w-12 h-12 sm:w-16 sm:h-16'
                              }
                            `}>
                              {premio.imagem_url ? (
                                <img src={premio.imagem_url} alt={premio.titulo} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                  <Trophy className={premio.posicao === 1 ? "h-12 w-12" : "h-5 w-5"} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 flex flex-col justify-center min-w-0">
                              <div className="flex justify-between items-start gap-2 flex-wrap mb-1">
                                <span className={`
                                  font-black uppercase tracking-normal
                                  ${premio.posicao === 1 ? 'text-blue-700 text-[10px]' : 'text-blue-400 text-[8.5px]'}
                                `}>
                                  {premio.posicao === 1 ? '👑 PREMIAÇÃO PRINCIPAL' : `${premio.posicao}º PRÊMIO`}
                                </span>
                                {premio.valor_estimado && (
                                  <span className={`
                                    font-bold
                                    ${premio.posicao === 1 ? 'text-green-600 text-lg' : 'text-gray-500 text-xs'}
                                  `}>
                                    R$ {Number(premio.valor_estimado).toLocaleString("pt-BR")}
                                  </span>
                                )}
                              </div>
                              <h4 className={`
                                font-bold text-gray-900 
                                ${premio.posicao === 1 ? 'text-xl sm:text-2xl leading-snug' : 'text-sm truncate'}
                              `}>
                                {premio.titulo}
                              </h4>
                              {premio.descricao && (
                                <p className={`
                                  text-gray-500 mt-1
                                  ${premio.posicao === 1 ? 'text-base line-clamp-3' : 'text-xs line-clamp-1 italic'}
                                `}>
                                  {premio.descricao}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Price section for mobile */}
            <Card className="md:hidden border-blue-200 bg-blue-50/50">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
                      <Ticket className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 leading-tight">Por apenas</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Valor da cota</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-black text-green-600 drop-shadow-sm ${isPromoActive ? 'line-through text-gray-400 text-lg' : ''}`}>
                      R$ {Number(rifa.valor_numero).toFixed(2)}
                    </p>
                    {isPromoActive && (
                      <p className="text-3xl font-black text-green-600 drop-shadow-sm animate-pulse">
                        R$ {Number(rifa.off_price).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                {hasPromo && !isPromoActive && (
                  <div id="promo-banner" className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-3 rounded-xl text-center text-sm font-medium animate-pulse shadow-md scroll-mt-[170px]">
                    🚀 PROMOÇÃO: Compre {rifa.qtd_off} ou mais e pague apenas <span className="text-yellow-300 font-bold text-base">R$ {Number(rifa.off_price).toFixed(2)}</span> por cada cota!
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Numbers Grid */}
            <Card id="numeros" className="scroll-mt-[170px]">
              <CardContent className="p-4 sm:p-6">
                <div className="flex justify-between items-center mb-6 gap-3">
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Escolha seus números</h2>
                </div>

                <div className="flex items-center gap-3 mb-5 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center shrink-0">
                    <Shuffle className="h-3 w-3 mr-1.5" /> Surpresinha:
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => selectRandom(3)} className="bg-white hover:bg-blue-600 hover:text-white transition-colors border-blue-200 text-blue-700 font-bold h-10 px-6 text-base">+3</Button>
                    <Button variant="outline" size="sm" onClick={() => selectRandom(5)} className="bg-white hover:bg-blue-600 hover:text-white transition-colors border-blue-200 text-blue-700 font-bold h-10 px-6 text-base">+5</Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1.5 mb-6 text-[11px] text-gray-600 font-medium bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded bg-white border border-gray-300" /> Disponível</div>
                  <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded bg-blue-600" /> Selecionado</div>
                  <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded bg-yellow-400" /> Reservado</div>
                  <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded bg-green-500" /> Vendido</div>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5 sm:gap-2">
                  {Array.from({ length: rifa.total_numeros }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      onClick={() => handleNumberClick(num)}
                      className={`h-9 sm:h-10 rounded-md border font-semibold text-xs sm:text-sm transition-all flex items-center justify-center select-none ${getNumberStatusClass(num)}`}
                    >
                      {padNum(num)}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Desktop */}
          <div className="md:col-span-1 hidden md:block">
            <div className="sticky top-24">
              <Card className="border-blue-200 shadow-lg">
                <CardContent className="p-5">
                  <h3 className="text-lg font-bold mb-4">Resumo da Compra</h3>
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100 text-sm">
                    <span className="text-gray-600">Valor unitário</span>
                    <div className="text-right">
                      <span className={`font-bold block ${isPromoActive ? 'line-through text-gray-400 text-xs' : ''}`}>R$ {Number(rifa.valor_numero).toFixed(2)}</span>
                      {isPromoActive && <span className="font-bold text-green-600">R$ {Number(rifa.off_price).toFixed(2)}</span>}
                    </div>
                  </div>
                  <div className="mb-5">
                    <span className="text-xs text-gray-500 block mb-2">Selecionados ({selectedNumbers.length}):</span>
                    {selectedNumbers.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedNumbers.map((n) => (
                          <Badge key={n} variant="secondary" className="bg-blue-100 text-blue-800 text-xs">{padNum(n)}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Nenhum selecionado</p>
                    )}
                  </div>
                  <div className="flex justify-between items-center mb-5 pt-4 border-t border-gray-100">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="text-2xl font-extrabold text-green-600">R$ {totalValue.toFixed(2)}</span>
                  </div>
                  <Button
                    className={`w-full h-12 text-base uppercase font-bold shadow-lg transition-all duration-300 ${
                      selectedNumbers.length === 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-black hover:bg-slate-900 text-white'
                    }`}
                    onClick={() => {
                      if (selectedNumbers.length === 0) {
                        document.getElementById('numeros')?.scrollIntoView({ behavior: 'smooth' });
                      } else {
                        setCheckoutStep(1);
                        setIsModalOpen(true);
                      }
                    }}
                  >
                    {selectedNumbers.length === 0 ? 'Escolher Números' : 'Confirmar Reserva'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Mobile Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-gray-100 px-4 py-3 safe-area-bottom shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">
              {selectedNumbers.length > 0 ? `${selectedNumbers.length} selecionado(s)` : "Nenhum selecionado"}
            </p>
            <p className="text-xl font-extrabold text-green-600 leading-tight">R$ {totalValue.toFixed(2)}</p>
          </div>
          <Button
            className={`h-12 px-8 uppercase font-bold ${selectedNumbers.length === 0 ? 'bg-blue-600' : 'bg-black'}`}
            onClick={() => {
              if (selectedNumbers.length === 0) {
                document.getElementById('numeros')?.scrollIntoView({ behavior: 'smooth' });
              } else {
                setCheckoutStep(1);
                setIsModalOpen(true);
              }
            }}
          >
            {selectedNumbers.length === 0 ? 'Escolher' : 'Confirmar'}
          </Button>
        </div>
      </div>

      {/* Checkout Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden rounded-3xl">
          {checkoutStep !== 3 && (
            <div className="p-6">
              <DialogHeader>
                <DialogTitle>{checkoutStep === 1 ? "Seus Dados" : checkoutStep === 2 ? "Confirmar Pedido" : "Pronto! 🎉"}</DialogTitle>
                <DialogDescription>
                  {checkoutStep === 1 && "Preencha para garantir seus números."}
                  {checkoutStep === 2 && "Revise antes de pagar."}
                </DialogDescription>
              </DialogHeader>

              {checkoutStep === 1 && (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="João Silva" />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    <Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="joao@email.com" />
                  </div>
                </div>
              )}

              {checkoutStep === 2 && (
                <div className="space-y-4 py-4">
                   {checkoutError && <div className="p-3 bg-red-50 text-red-700 text-sm border border-red-200 rounded-lg">{checkoutError}</div>}
                   <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm">
                      <p><strong>Quantidade:</strong> {selectedNumbers.length} números</p>
                      <p><strong>Total:</strong> R$ {totalValue.toFixed(2)}</p>
                   </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4">
                {checkoutStep === 2 && <Button variant="ghost" onClick={() => setCheckoutStep(1)}>Voltar</Button>}
                <Button 
                  disabled={isSubmitting} 
                  className="bg-blue-600 flex-1"
                  onClick={() => checkoutStep === 1 ? setCheckoutStep(2) : handleCheckout()}
                >
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : checkoutStep === 1 ? "Continuar" : "Gerar PIX"}
                </Button>
              </div>
            </div>
          )}

          {checkoutStep === 3 && (
            <div className="bg-gradient-to-b from-blue-500 to-blue-700 text-white p-10 flex flex-col items-center">
              <h2 className="text-xl font-bold mb-6">Pagamento via PIX</h2>
              <div className="bg-white p-4 rounded-3xl shadow-xl mb-6">
                <img src={`data:image/jpeg;base64,${pixData?.qr_code_base64}`} alt="PIX" className="w-48 h-48 mix-blend-multiply" />
              </div>
              <p className="text-sm opacity-80 mb-2">Total: R$ {totalValue.toFixed(2)}</p>
              <Button onClick={copyPix} className="bg-white text-blue-600 hover:bg-blue-50">
                {pixCopied ? "Copiado!" : <><Copy className="mr-2 h-4 w-4" /> Copiar PIX</>}
              </Button>
            </div>
          )}

          {checkoutStep === 4 && (
            <div className="p-10 flex flex-col items-center text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h2 className="text-2xl font-bold">Reserva Confirmada!</h2>
              <p className="text-gray-500 mt-2">Seus números foram adquiridos com sucesso.</p>
              <Button onClick={() => setIsModalOpen(false)} className="mt-6 w-full bg-blue-600">Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

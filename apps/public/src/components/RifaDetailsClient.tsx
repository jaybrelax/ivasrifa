"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Trophy, Clock, CheckCircle2, AlertCircle, Loader2, Copy, Shuffle, Ticket, X, Plus, User, CreditCard, Phone, Mail, Shield, ChevronLeft, ArrowRight, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
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
  const selectedNumbersRef = useRef<number[]>([]);

  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
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

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");
  };

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
  // IMPORTANTE: O canal é criado apenas uma vez (deps: rifa.id, sessionId)
  // para evitar race conditions ao desmarcar números.
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
        const presences = newState[id] as any[];
        if (presences && presences.length > 0) {
          const latestPresence = presences[presences.length - 1];
          if (latestPresence.selected && Array.isArray(latestPresence.selected)) {
            othersNumbers.push(...latestPresence.selected);

            // Resolução de Conflitos (Race Condition de milissegundos)
            // Se o outro dispositivo também capturou números que eu capturei:
            const conflitos = latestPresence.selected.filter((n: number) => 
               selectedNumbersRef.current.includes(n)
            );
            
            if (conflitos.length > 0) {
              // Tie-breaker determinístico: a menor string de ID ganha o número.
              if (id < sessionId) {
                // Eu perdi o conflito. Removo localmente os do meu carrinho.
                setSelectedNumbers(prev => prev.filter(n => !conflitos.includes(n)));
              }
            }
          }
        }
      }
      setNumerosEmSelecao(othersNumbers);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Track com o valor mais recente via ref (não recria o canal)
        channelRef.current?.track({ selected: selectedNumbersRef.current }).catch(() => {});
      }
    });

    return () => {
      supabase.removeChannel(room);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rifa?.id, sessionId]);

  // Atualiza o track no canal existente sempre que a seleção muda.
  // Não recria o canal — apenas envia os dados atualizados.
  useEffect(() => {
    selectedNumbersRef.current = selectedNumbers;
    if (channelRef.current) {
      channelRef.current.track({ selected: selectedNumbers }).catch(() => {});
    }
  }, [selectedNumbers]);

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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://admin.rifa.virtudes.net.br";
      
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
            <div className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] bg-white/20 backdrop-blur-md border border-white/30 text-white mb-3 shadow-lg">
              RIFA
            </div>
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
                      className={`h-10 sm:h-12 rounded-lg border font-bold text-sm sm:text-base transition-all flex items-center justify-center select-none ${getNumberStatusClass(num)}`}
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
                    className={`w-full h-14 rounded-full text-base uppercase font-bold shadow-lg transition-all duration-300 ${
                      selectedNumbers.length === 0 
                        ? 'bg-black hover:bg-slate-900 text-white' 
                        : 'bg-[#1b5df1] hover:bg-[#0044cc] text-white font-black scale-[1.02]'
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
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/40 backdrop-blur-xl border-t border-white/20 px-4 py-4 safe-area-bottom shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-all duration-300">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 pr-2 flex-1">
            {selectedNumbers.length > 0 ? (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 max-w-[150px] scrollbar-hide">
                {selectedNumbers.map(n => (
                  <div key={n} className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold shadow-sm">
                    {n}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">Nenhum selecionado</p>
            )}
            <p className="text-lg font-extrabold text-green-600 leading-tight mt-0.5">R$ {totalValue.toFixed(2)}</p>
          </div>
          <Button
            className={`h-12 px-6 uppercase text-xs sm:text-sm font-bold rounded-full transition-all duration-300 ${
              selectedNumbers.length === 0 
                ? 'bg-black text-white' 
                : 'bg-[#22c55e] hover:bg-[#16a34a] text-white font-black shadow-lg shadow-green-500/20'
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
            {selectedNumbers.length === 0 ? 'Escolher números' : 'Confirmar Números'}
          </Button>
        </div>
      </div>

      {/* Checkout Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="!fixed !top-0 !left-0 !translate-x-0 !translate-y-0 !m-0 !w-full !max-w-none !h-[100dvh] !rounded-none border-none p-0 overflow-y-auto flex flex-col bg-white sm:!top-[50%] sm:!left-[50%] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:!max-w-[450px] sm:!h-auto sm:!max-h-[82vh] sm:!rounded-[32px] sm:border">
          {(checkoutStep === 1 || checkoutStep === 2) && (
            <div className="flex-1 flex flex-col pb-8">
              {/* Custom Header Checkout */}
              <div className="sticky top-0 bg-white z-20 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100">
                <button 
                  onClick={() => checkoutStep === 1 ? setIsModalOpen(false) : setCheckoutStep(1)} 
                  className="p-2 hover:bg-slate-50 rounded-full transition-colors relative z-10"
                >
                  <ArrowLeft className={`h-[22px] w-[22px] ${checkoutStep === 1 ? 'text-[#0055ff]' : 'text-slate-800'}`} />
                </button>
                <h3 className={`text-lg font-bold absolute left-1/2 -translate-x-1/2 tracking-tight ${checkoutStep === 1 ? 'text-[#0055ff]' : 'text-slate-900'}`}>Checkout</h3>
                <div className="w-10"></div> {/* Spacer */}
              </div>

              <div className="px-5 sm:px-8 pt-8 flex-1">
                <div className="text-center mb-10">
                  <h2 className="text-[28px] font-extrabold text-slate-900 tracking-tight mb-2 leading-tight">
                    {checkoutStep === 1 ? "Seus Dados" : "Resumo da Compra"}
                  </h2>
                  <p className="text-slate-500 font-medium text-[15px]">
                    {checkoutStep === 1 ? "Preencha para garantir suas cotas" : "Confira os detalhes da reserva"}
                  </p>
                </div>

                {checkoutStep === 1 && (
                  <div className="space-y-6">
                    <div className="bg-[#f8fafc] p-6 rounded-[28px] space-y-5 border border-slate-100/60 shadow-sm shadow-slate-100">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-slate-500 ml-1 tracking-widest">Nome Completo</Label>
                        <div className="relative group">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400" />
                          <Input 
                            value={formData.nome} 
                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })} 
                            placeholder="Ex: João da Silva"
                            className="h-14 pl-11 rounded-[14px] border border-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] font-semibold text-slate-800 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-[#0055ff]/20 text-[15px]"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-slate-500 ml-1 tracking-widest">CPF</Label>
                        <div className="relative group overflow-hidden">
                          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400" />
                          <Input 
                            value={formData.cpf} 
                            onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })} 
                            placeholder="000.000.000-00"
                            inputMode="numeric"
                            className="h-14 pl-11 rounded-[14px] border border-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] font-semibold text-slate-800 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-[#0055ff]/20 font-mono text-[15px]"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-slate-500 ml-1 tracking-widest">WhatsApp / Telefone</Label>
                        <div className="relative group overflow-hidden">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400" />
                          <Input 
                            value={formData.telefone} 
                            onChange={(e) => setFormData({ ...formData, telefone: formatPhone(e.target.value) })} 
                            placeholder="(00) 00000-0000"
                            inputMode="numeric"
                            className="h-14 pl-11 rounded-[14px] border border-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] font-semibold text-slate-800 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-[#0055ff]/20 font-mono text-[15px]"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-slate-500 ml-1 tracking-widest">E-mail</Label>
                        <div className="relative group overflow-hidden">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400" />
                          <Input 
                            type="email" 
                            value={formData.email} 
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                            placeholder="seu@email.com"
                            className="h-14 pl-11 rounded-[14px] border border-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] font-semibold text-slate-800 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-[#0055ff]/20 text-[15px]"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4 mt-6">
                      <Button 
                        disabled={isSubmitting} 
                        className="h-14 rounded-full bg-[#1b5df1] hover:bg-[#0044cc] text-[15px] font-bold uppercase tracking-widest shadow-[0_8px_20px_rgba(27,93,241,0.25)] transition-all active:scale-[0.98]"
                        onClick={() => {
                          if (!formData.nome || !formData.cpf || !formData.telefone || !formData.email) {
                            setCheckoutError("Preencha todos os campos para continuar");
                            setCheckoutStep(2); 
                            setTimeout(() => setCheckoutStep(1), 10);
                            return;
                          }
                          setCheckoutStep(2);
                        }}
                      >
                        Prosseguir <ArrowRight className="ml-1 h-5 w-5" />
                      </Button>
                      <p className="text-[12px] text-slate-400 font-medium text-center leading-relaxed px-4">
                        Ao continuar, você declara que concorda com os nossos{" "}
                        <Link href="/termos" target="_blank" className="text-[#1b5df1] font-bold underline decoration-slate-200 underline-offset-4">Termos de Uso</Link> e{" "}
                        <Link href="/privacidade" target="_blank" className="text-[#1b5df1] font-bold underline decoration-slate-200 underline-offset-4">Política de Privacidade</Link>.
                      </p>
                    </div>
                  </div>
                )}

                {checkoutStep === 2 && (
                  <div className="space-y-6">
                    {/* Reservation Banner */}
                    <div className="bg-[#fffbeb] border border-[#fde68a] p-4 p-5 rounded-[24px] flex items-start gap-3.5 shadow-sm">
                      <div className="h-6 w-6 rounded-full bg-[#f59e0b] flex items-center justify-center shrink-0 mt-0.5">
                        <AlertCircle className="h-4 w-4 text-white" />
                      </div>
                      <p className="text-[#92400e] text-[14px] font-bold leading-tight">
                        Seus números ficam reservados por <span className="text-[#78350f] font-black underline decoration-amber-300">10 minutos</span> após gerar o PIX.
                      </p>
                    </div>

                    {checkoutError && (
                      <div className="p-4 bg-[#ffecec] border border-[#ffcccc] text-[#d32f2f] text-[13px] font-bold rounded-[12px] flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <div className="h-6 w-6 rounded-full bg-[#d32f2f] flex items-center justify-center shrink-0">
                          <AlertCircle className="h-4 w-4 text-white" />
                        </div>
                        {checkoutError}
                      </div>
                    )}

                    {/* User Summary Card */}
                    <div className="bg-white rounded-[24px] p-5 flex items-center gap-4 border border-slate-100 shadow-sm">
                      <div className="h-[52px] w-[52px] rounded-full bg-slate-50 flex items-center justify-center text-[#1b5df1] shrink-0 border border-slate-100">
                        <User className="h-[24px] w-[24px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-slate-900 text-[18px] leading-tight truncate">{formData.nome}</p>
                        <div className="flex items-center gap-3 mt-1">
                           <p className="text-[12px] text-slate-500 font-bold tracking-tight">{formData.cpf}</p>
                           <div className="h-3 w-[1px] bg-slate-200"></div>
                           <div className="flex items-center gap-1.5 overflow-hidden">
                              <Phone className="h-3 w-3 text-[#1b5df1]" />
                              <p className="text-[12px] text-slate-500 font-bold truncate">{formData.telefone}</p>
                           </div>
                        </div>
                      </div>
                    </div>

                    {/* Numbers Summary Card */}
                    <div className="bg-[#eff6ff] rounded-[24px] p-6 border border-blue-100 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                         <h4 className="text-[11px] uppercase font-black text-blue-600 tracking-widest">Cotas Selecionadas ({selectedNumbers.length})</h4>
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {selectedNumbers.map((num) => (
                           <div key={num} className="w-[46px] h-[46px] rounded-full bg-white text-[#1b5df1] flex items-center justify-center font-black text-[15px] shadow-sm border border-blue-100">
                            {padNum(num)}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pricing Display */}
                    <div className="bg-[#f8fafc] rounded-[28px] py-10 px-5 mt-6 border border-slate-100/60 shadow-sm shadow-slate-100 text-center space-y-1.5 relative">
                       <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#dcfce7] text-[#166534] text-[10px] font-black uppercase tracking-widest border border-green-200 shadow-sm">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Pagamento Seguro
                      </div>
                      <p className="text-[11px] uppercase font-bold text-slate-500 tracking-wider pt-1">Total a Pagar</p>
                      <p className="text-[42px] font-black text-[#006b2d] tracking-tighter leading-none">
                        R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 pt-2">
                      <Button 
                        disabled={isSubmitting} 
                        className="h-14 rounded-full bg-[#006b2d] hover:bg-[#005a26] text-[15px] font-bold uppercase tracking-widest shadow-[0_8px_20px_rgba(0,107,45,0.25)] transition-all active:scale-[0.98]"
                        onClick={handleCheckout}
                      >
                        {isSubmitting ? (
                          <Loader2 className="animate-spin h-6 w-6" />
                        ) : (
                          <>
                           <Wallet className="mr-2.5 h-5 w-5" /> 
                           Finalizar e Pagar via PIX
                          </>
                        )}
                      </Button>
                      <button 
                         onClick={() => setCheckoutStep(1)}
                         className="text-[11px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest py-3 transition-colors"
                      >
                         Voltar e Alterar Dados
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {checkoutStep === 3 && (
            <div className="flex-1 flex flex-col min-h-[100dvh] sm:min-h-0 sm:h-[90vh] sm:max-h-[700px] overflow-hidden bg-gradient-to-b from-[#0a1854] via-[#0d2080] to-[#1035c4] text-white relative animate-in fade-in duration-500">
              {/* Close Confirmation Popup */}
              {showCloseConfirmation && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowCloseConfirmation(false)}></div>
                  <div className="relative bg-white rounded-[32px] p-8 max-w-[320px] w-full text-center shadow-2xl">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertCircle className="h-8 w-8 text-amber-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">Atenção!</h3>
                    <p className="text-slate-500 text-sm font-bold leading-relaxed mb-8">
                      Você ainda não confirmou o pagamento. Se fechar agora, perderá sua reserva em alguns minutos. Deseja realmente sair?
                    </p>
                    <div className="space-y-3">
                      <Button
                        onClick={() => {
                          setShowCloseConfirmation(false);
                          setIsModalOpen(false);
                        }}
                        variant="ghost"
                        className="w-full h-12 text-slate-400 font-bold hover:text-slate-600 hover:bg-slate-50 rounded-2xl"
                      >
                        Sim, desejo sair
                      </Button>
                      <Button
                        onClick={() => setShowCloseConfirmation(false)}
                        className="w-full h-14 bg-[#1b5df1] text-white rounded-2xl font-black uppercase tracking-widest shadow-lg"
                      >
                        Voltar ao PIX
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-2 shrink-0">
                <h2 className="text-lg font-black uppercase tracking-widest text-white">Pagamento PIX</h2>
                <button
                  onClick={() => setShowCloseConfirmation(true)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="h-6 w-6 text-white/80" />
                </button>
              </div>

              {/* QR Code area — flex-1 so it takes available space */}
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 gap-5">
                {/* QR Code Card */}
                <div className="bg-white rounded-[28px] shadow-2xl p-5 flex items-center justify-center w-full max-w-[260px] aspect-square">
                  {pixData?.qr_code_base64 ? (
                    <img
                      src={`data:image/jpeg;base64,${pixData?.qr_code_base64}`}
                      alt="QR Code PIX"
                      className="w-full h-auto mix-blend-multiply"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-slate-50 animate-pulse rounded-2xl flex items-center justify-center text-slate-300">
                      <Loader2 className="h-12 w-12 animate-spin" />
                    </div>
                  )}
                </div>

                {/* PIX Logo */}
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Logo_-_pix_powered_by_Banco_Central_%28Brazil%2C_2020%29.png/1280px-Logo_-_pix_powered_by_Banco_Central_%28Brazil%2C_2020%29.png"
                  alt="Logo Pix"
                  className="h-8 w-auto object-contain brightness-0 invert opacity-95"
                />

                {/* Valor */}
                <div className="text-center">
                  <p className="text-[11px] font-black text-blue-300 uppercase tracking-[0.2em] mb-1">Valor a pagar</p>
                  <p className="text-[52px] font-black text-white leading-none tracking-tight">R$ {totalValue.toFixed(2)}</p>
                </div>
              </div>

              {/* Bottom actions — fixed at bottom */}
              <div className="shrink-0 px-6 pb-8 pt-2 space-y-3">
                <Button
                  onClick={copyPix}
                  className="w-full h-[58px] bg-[#22c55e] hover:bg-[#16a34a] text-white text-base font-black uppercase tracking-widest rounded-[18px] shadow-xl shadow-green-900/30 active:scale-[0.98] transition-all border-none"
                >
                  {pixCopied ? (
                    <><CheckCircle2 className="mr-3 h-5 w-5" /> Copiado!</>
                  ) : (
                    <><Copy className="mr-3 h-5 w-5" /> Copiar Código PIX</>
                  )}
                </Button>

                <div className="flex flex-col items-center gap-2 pt-1">
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 animate-pulse">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-300 shrink-0" />
                    <span className="text-[11px] font-black uppercase tracking-widest">Aguardando Pagamento</span>
                  </div>
                  <p className="text-[10px] text-white/60 text-center uppercase font-bold leading-snug tracking-widest">
                    Não saia desta tela após pagar<br />A confirmação é automática
                  </p>
                </div>
              </div>
            </div>
          )}


          {checkoutStep === 4 && (
            <div className="p-10 flex flex-col items-center text-center flex-1 justify-center bg-white min-h-screen sm:min-h-0 sm:rounded-xl">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20 animate-pulse"></div>
                <div className="relative w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30 mb-8">
                  <CheckCircle2 className="h-12 w-12 text-white" />
                </div>
              </div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-4">SUCESSO!</h2>
              <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-[280px] mx-auto">
                Parabéns, {formData.nome.split(' ')[0]}! Suas cotas foram garantidas.
              </p>
              
              <div className="mt-10 p-4 bg-green-50 border border-green-100 rounded-[20px] flex items-center gap-3 text-[#008000] text-sm font-bold">
                 <Shield className="h-5 w-5 shrink-0" />
                 Seu comprovante foi enviado para o WhatsApp cadastrado.
              </div>

              <Button onClick={() => setIsModalOpen(false)} className="mt-10 w-full h-16 bg-slate-900 text-white rounded-[24px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                Finalizar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

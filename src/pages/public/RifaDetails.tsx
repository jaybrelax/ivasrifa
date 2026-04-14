import { useState, useEffect, useRef } from "react";
import { useParams, Link, useSearchParams, useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Trophy, Clock, CheckCircle2, AlertCircle, Loader2, Copy, Shuffle, Ticket, X } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
// @ts-ignore
import Logo from "../../img/ivas_logo.png";

export default function RifaDetails() {
  const { config: layoutConfig } = useOutletContext<any>() || { config: {} };
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref");

  const [rifa, setRifa] = useState<any>(null);
  const [premios, setPremios] = useState<any[]>([]);
  const [numerosVendidos, setNumerosVendidos] = useState<number[]>([]);
  const [numerosReservados, setNumerosReservados] = useState<number[]>([]);
  const [numerosEmSelecao, setNumerosEmSelecao] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const [sessionId] = useState(() => Math.random().toString(36).substring(2, 12));
  const channelRef = useRef<any>(null);

  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);

  const [formData, setFormData] = useState({ nome: "", cpf: "", email: "", telefone: "" });
  const [pixData, setPixData] = useState<{ qr_code_base64?: string; qr_code?: string; payment_id?: string } | null>(null);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [config, setConfig] = useState({
    nome_sistema: "Sorteios Online",
    logo_url: "",
    hero_enabled: true,
    hero_titulo: "Realize seus sonhos com nossos sorteios",
    hero_descricao: "Participe de rifas seguras, com sorteios transparentes e prêmios incríveis.",
    hero_imagem_url: ""
  });

  useEffect(() => {
    if (layoutConfig) {
      setConfig(prev => ({ ...prev, ...layoutConfig }));
    }
  }, [layoutConfig]);

  // Guardar ref se houver
  useEffect(() => {
    if (refCode) {
      localStorage.setItem("@rifa:guardiao_ref", refCode);
    }
  }, [refCode]);

  useEffect(() => {
    async function fetchRifaData() {
      if (!id) return;
      try {
        // Fetch Config
        const { data: configData } = await supabase
          .from('vw_configuracoes_publicas')
          .select('*')
          .eq('id', 1)
          .single();

        if (configData) {
          setConfig({
            nome_sistema: configData.nome_sistema || "Sorteios Online",
            logo_url: configData.logo_url || "",
            hero_enabled: configData.hero_enabled !== false,
            hero_titulo: configData.hero_titulo || "Realize seus sonhos com nossos sorteios",
            hero_descricao: configData.hero_descricao || "Participe de rifas seguras, com sorteios transparentes e prêmios incríveis.",
            hero_imagem_url: configData.hero_imagem_url || ""
          });
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        let query = supabase.from("rifas").select("*");
        query = isUuid ? query.eq("id", id) : query.eq("slug", id);

        const { data: rifaData, error: rifaError } = await query.single();
        if (rifaError) throw rifaError;
        setRifa(rifaData);

        const realId = rifaData.id;

        const { data: premiosData } = await supabase
          .from("premios").select("*").eq("rifa_id", realId).order("posicao", { ascending: true });
        setPremios(premiosData || []);

        const { data: numerosData } = await supabase
          .from("numeros_rifa").select("numero, status").eq("rifa_id", realId);
        if (numerosData) {
          setNumerosVendidos(numerosData.filter((n) => n.status === "vendido").map((n) => n.numero));
          setNumerosReservados(numerosData.filter((n) => n.status === "reservado").map((n) => n.numero));
        }
      } catch (error) {
        console.error("Erro ao buscar detalhes da rifa:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchRifaData();
  }, [id]);

  // Atualizar Metadados para Compartilhamento (SEO / Social)
  useEffect(() => {
    if (rifa) {
      document.title = `${rifa.titulo} - ${config.nome_sistema}`;

      const updateMeta = (name: string, content: string, isProperty: boolean = false) => {
        const attr = isProperty ? 'property' : 'name';
        let element = document.querySelector(`meta[${attr}="${name}"]`);
        if (!element) {
          element = document.createElement('meta');
          element.setAttribute(attr, name);
          document.head.appendChild(element);
        }
        element.setAttribute('content', content);
      };

      const description = rifa.descricao?.substring(0, 160) || "Participe desta rifa e concorra a prêmios incríveis!";
      const shareUrl = window.location.href;

      updateMeta('description', description);
      updateMeta('og:title', rifa.titulo, true);
      updateMeta('og:description', description, true);
      updateMeta('og:image', rifa.imagem_url || '', true);
      updateMeta('og:url', shareUrl, true);
      updateMeta('og:type', 'website', true);
      updateMeta('twitter:card', 'summary_large_image');
      updateMeta('twitter:title', rifa.titulo);
      updateMeta('twitter:description', description);
      updateMeta('twitter:image', rifa.imagem_url || '');
    }
  }, [rifa, config.nome_sistema]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rifa?.id, sessionId]);

  // Informar aos outros toda vez que a nossa seleção mudar
  useEffect(() => {
    if (channelRef.current && channelRef.current.state === 'joined') {
      channelRef.current.track({ selected: selectedNumbers }).catch(() => { });
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
            setCheckoutStep(4);
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Erro ao verificar status:", err);
        }
      }, 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [checkoutStep, pedidoId]);

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
    try {
      const guardiaoRef = localStorage.getItem("@rifa:guardiao_ref");

      const response = await fetch("/api/pagamento/pix", {
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
        alert(error.message || "Ocorreu um erro. Tente novamente.");
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!rifa) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-4">
        <h2 className="text-2xl font-bold text-gray-900 text-center">Rifa não encontrada</h2>
        <Link to="/">
          <Button>Voltar para o Início</Button>
        </Link>
      </div>
    );
  }

  const hasPromo = rifa.off_price && rifa.qtd_off;
  const isPromoActive = hasPromo && selectedNumbers.length >= rifa.qtd_off;
  const currentUnitPrice = isPromoActive ? rifa.off_price : rifa.valor_numero;
  const totalValue = selectedNumbers.length * currentUnitPrice;
  const padNum = (n: number) => n.toString().padStart(rifa.total_numeros > 99 ? 3 : 2, "0");

  return (
    <div className="bg-gray-50 pb-28 md:pb-0">

      {/* ── HERO ── */}
      <div className="relative h-56 sm:h-64 md:h-80 w-full bg-gray-900">
        {rifa.imagem_url ? (
          <img src={rifa.imagem_url} alt={rifa.titulo} className="object-cover w-full h-full opacity-60" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-900 to-indigo-900 opacity-80" />
        )}
        <div className="absolute top-3 left-3">
          <Link to="/">
            <Button variant="secondary" size="sm" className="bg-white/90 hover:bg-white text-gray-900 shadow">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Button>
          </Link>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/90 to-transparent">
          <div className="max-w-5xl mx-auto">
            <Badge className="bg-green-500 mb-2 text-xs">Sorteio Ativo</Badge>
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

            {/* Sobre a Rifa */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold mb-3">Sobre a Rifa</h2>
                <p className="text-gray-600 whitespace-pre-line text-sm sm:text-base">{rifa.descricao || "Sem descrição disponível."}</p>

                {premios.length > 0 && (
                  <div className="mt-5">
                    <h3 className="font-semibold flex items-center mb-3 text-sm sm:text-base">
                      <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 mr-2 shrink-0" /> Prêmios
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {[...premios].sort((a, b) => {
                        if (a.is_bonus && !b.is_bonus) return -1;
                        if (!a.is_bonus && b.is_bonus) return 1;
                        return a.posicao - b.posicao;
                      }).map((premio) => (
                        <div
                          key={premio.id}
                          className={`
                            flex items-center gap-4 rounded-xl border transition-all duration-300
                            ${premio.posicao === 1 || premio.is_bonus
                              ? 'p-5 bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-md md:flex-row flex-col items-stretch'
                              : 'p-3 bg-gray-50 border-gray-100'
                            }
                          `}
                        >
                          <div className={`
                            flex-shrink-0 rounded-lg border border-gray-200 bg-white overflow-hidden
                            ${premio.posicao === 1 || premio.is_bonus
                              ? 'w-full md:w-48 h-48 sm:h-56'
                              : 'w-12 h-12 sm:w-16 sm:h-16'
                            }
                          `}>
                            {premio.imagem_url ? (
                              <img src={premio.imagem_url} alt={premio.titulo} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <Trophy className={premio.posicao === 1 || premio.is_bonus ? "h-12 w-12" : "h-5 w-5"} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 flex flex-col justify-center min-w-0">
                            <div className="flex justify-between items-start gap-2 flex-wrap mb-1">
                              <span className={`
                                font-black uppercase tracking-normal
                                ${premio.is_bonus ? 'text-purple-600 text-[10px]' : premio.posicao === 1 ? 'text-blue-700 text-[10px]' : 'text-blue-400 text-[8.5px]'}
                              `}>
                                {premio.is_bonus ? '🎁 BÔNUS ESPECIAL' : premio.posicao === 1 ? '👑 PREMIAÇÃO PRINCIPAL' : `${premio.posicao}º PRÊMIO`}
                              </span>
                              {premio.valor_estimado && (
                                <span className={`
                                  font-bold
                                  ${(premio.posicao === 1 || premio.is_bonus) ? 'text-green-600 text-lg' : 'text-gray-500 text-xs'}
                                `}>
                                  R$ {Number(premio.valor_estimado).toLocaleString("pt-BR")}
                                </span>
                              )}
                            </div>
                            <h4 className={`
                              font-bold text-gray-900 
                              ${premio.posicao === 1 || premio.is_bonus ? 'text-xl sm:text-2xl leading-snug' : 'text-sm truncate'}
                            `}>
                              {premio.titulo}
                            </h4>
                            {premio.descricao && (
                              <p className={`
                                text-gray-500 mt-1
                                ${premio.posicao === 1 || premio.is_bonus ? 'text-base line-clamp-3' : 'text-xs line-clamp-1 italic'}
                              `}>
                                {premio.descricao}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preço da Cota (Mobile) */}
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
                    🚀 PROMOÇÃO: Compre {rifa.qtd_off} ou mais e pague apenas <span className="text-yellow-300 font-bold text-base">R$ {Number(rifa.off_price).toFixed(2)}</span> cada!
                  </div>
                )}
                
                {isPromoActive && (
                  <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-3 rounded-xl text-center text-sm font-medium shadow-md">
                    ✅ DESCONTO ATIVADO! Você está economizando <span className="font-bold text-base">R$ {(selectedNumbers.length * (rifa.valor_numero - rifa.off_price)).toFixed(2)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grade de Números */}
            <Card id="numeros" className="scroll-mt-[170px]">
              <CardContent className="p-4 sm:p-6">
                {/* Cabeçalho */}
                <div className="flex justify-between items-center mb-6 gap-3">
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Escolha seus números</h2>
                </div>

                {/* Linha Surpresinha */}
                <div className="flex items-center gap-3 mb-5 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider flex items-center shrink-0">
                    <Shuffle className="h-3 w-3 mr-1.5" /> Surpresinha:
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => selectRandom(3)} 
                      className="bg-white hover:bg-blue-600 hover:text-white transition-colors border-blue-200 text-blue-700 font-bold h-10 px-6 text-base"
                    >
                      +3
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => selectRandom(5)} 
                      className="bg-white hover:bg-blue-600 hover:text-white transition-colors border-blue-200 text-blue-700 font-bold h-10 px-6 text-base"
                    >
                      +5
                    </Button>
                  </div>
                </div>

                {/* Legenda em 2 colunas no mobile */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1.5 mb-6 text-[11px] text-gray-600 font-medium bg-gray-50/50 p-2 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded bg-white border border-gray-300 shrink-0" /> Disponível</div>
                  <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded bg-blue-600 shrink-0" /> Selecionado</div>
                  <div className="flex items-center gap-1.5" title="Reservado no sistema ou sendo escolhido por alguém agora"><div className="w-3.5 h-3.5 rounded bg-yellow-400 shrink-0" /> Reservado</div>
                  <div className="flex items-center gap-1.5"><div className="w-3.5 h-3.5 rounded bg-green-500 shrink-0" /> Vendido</div>
                </div>

                {/* Números: 5 cols no mobile, 8 no sm, 10 no md+ */}
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

          {/* ── SIDEBAR (desktop) ── */}
          <div className="md:col-span-1 hidden md:block">
            <div className="sticky top-24">
              <Card className="border-blue-200 shadow-lg">
                <CardContent className="p-5">
                  <h3 className="text-lg font-bold mb-4">Resumo da Compra</h3>
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100 text-sm">
                    <span className="text-gray-600">Valor unitário</span>
                    <div className="text-right">
                      <span className={`font-bold block ${isPromoActive ? 'line-through text-gray-400 text-xs' : ''}`}>
                        R$ {Number(rifa.valor_numero).toFixed(2)}
                      </span>
                      {isPromoActive && (
                        <span className="font-bold text-green-600">
                          R$ {Number(rifa.off_price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  {hasPromo && !isPromoActive && (
                    <div className="mb-4 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl text-sm text-blue-900 font-normal leading-relaxed shadow-sm">
                      💡 <span className="font-semibold text-blue-700">Dica:</span> Adicione mais <span className="font-bold text-blue-600">{rifa.qtd_off - selectedNumbers.length}</span> números para pagar apenas <strong className="text-blue-700 text-base">R$ {Number(rifa.off_price).toFixed(2)}</strong> cada!
                    </div>
                  )}
                  {isPromoActive && (
                    <div className="mb-4 p-3 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl text-sm text-green-900 font-normal flex justify-between items-center shadow-sm">
                      <span className="font-semibold text-green-700">ECONOMIA ATIVA</span>
                      <span className="font-bold text-green-600 text-base">- R$ {(selectedNumbers.length * (rifa.valor_numero - rifa.off_price)).toFixed(2)}</span>
                    </div>
                  )}
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
                      selectedNumbers.length === 0 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white animate-bounce-subtle' 
                        : 'bg-black hover:bg-slate-900 text-white'
                    }`}
                    onClick={() => {
                      if (selectedNumbers.length === 0) {
                        document.getElementById('numeros')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

      {/* ── BARRA FIXA MOBILE (rodapé) ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-white/20 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] px-4 py-3 safe-area-bottom">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">
              {selectedNumbers.length > 0
                ? `${selectedNumbers.length} número${selectedNumbers.length > 1 ? "s" : ""} selecionado${selectedNumbers.length > 1 ? "s" : ""}`
                : "Nenhum selecionado"}
            </p>
            <p className="text-xl font-extrabold text-green-600 leading-tight">R$ {totalValue.toFixed(2)}</p>
          </div>
          <Button
            className={`h-12 px-6 text-base shrink-0 uppercase font-bold shadow-lg transition-all duration-300 ${
              selectedNumbers.length === 0 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-black hover:bg-slate-900 text-white'
            }`}
            onClick={() => {
              if (selectedNumbers.length === 0) {
                const targetId = hasPromo && !isPromoActive ? 'promo-banner' : 'numeros';
                document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                setCheckoutStep(1);
                setIsModalOpen(true);
              }
            }}
          >
            {selectedNumbers.length === 0 ? 'Escolher Números' : 'Confirmar'}
          </Button>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={(val) => {
        // Bloqueia o fechamento automático (clique fora / esc) se estiver no passo do PIX
        if (!val && checkoutStep === 3) return;
        setIsModalOpen(val);
      }}>
        {/* full-screen no mobile, centralizado no desktop com proporção 3x4 */}
        <DialogContent 
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className={`w-full max-w-none h-full sm:h-auto rounded-none p-0 flex flex-col sm:block ${
            checkoutStep === 3 
              ? 'sm:max-w-[480px] border-0 overflow-hidden sm:overflow-visible sm:rounded-3xl shadow-none sm:shadow-2xl' 
              : 'sm:max-w-[420px] sm:aspect-[3/4.2] sm:rounded-3xl overflow-y-auto'
          }`}
        >

          <div className={`${checkoutStep === 3 ? 'p-0 flex-1 flex flex-col sm:min-h-[700px]' : 'p-5 sm:p-6'}`}>
            {checkoutStep !== 3 && (
              <DialogHeader className="mb-4 text-center sm:text-left">
                <DialogTitle className="text-lg sm:text-xl">
                  {checkoutStep === 1 && "Seus Dados"}
                  {checkoutStep === 2 && "Confirmar Pedido"}
                  {checkoutStep === 4 && "Pagamento Confirmado! 🎉"}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {checkoutStep === 1 && "Preencha seus dados para garantir seus números."}
                  {checkoutStep === 2 && "Revise antes de gerar o pagamento."}
                </DialogDescription>
              </DialogHeader>
            )}

            {/* ── STEP 1: Dados ── */}
            {checkoutStep === 1 && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="João da Silva" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input id="cpf" value={formData.cpf} onChange={(e) => setFormData({ ...formData, cpf: e.target.value })} placeholder="000.000.000-00" className="h-11" inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telefone">WhatsApp</Label>
                  <Input id="telefone" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} placeholder="(00) 00000-0000" className="h-11" inputMode="tel" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="joao@email.com" className="h-11" />
                </div>
              </div>
            )}

            {/* ── STEP 2: Resumo ── */}
            {checkoutStep === 2 && (
              <div className="space-y-4">
                {checkoutError && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span className="text-sm font-bold">{checkoutError}</span>
                  </div>
                )}
                
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Quantidade:</span>
                    <span className="font-semibold">{selectedNumbers.length} números</span>
                  </div>
                  <div className="mb-3">
                    <span className="text-sm text-gray-600 block mb-1.5">Números:</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedNumbers.map((n) => (
                        <Badge key={n} variant="secondary" className="bg-blue-100 text-blue-800 text-xs">{padNum(n)}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <span className="font-bold text-gray-900">Total a pagar:</span>
                    <div>
                      <span className="text-xl font-bold text-green-600 mt-2 block">R$ {totalValue.toFixed(2)}</span>
                      {isPromoActive && (
                        <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                          Desconto Ativado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-start text-sm text-yellow-800 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <AlertCircle className="h-5 w-5 mr-2 shrink-0 mt-0.5" />
                  <p>Seus números ficam reservados por <strong>{rifa.timeout_reserva} minutos</strong> após gerar o PIX.</p>
                </div>
              </div>
            )}

            {/* ── STEP 3: PIX ── */}
            {checkoutStep === 3 && (
              <div className="flex flex-col items-center w-full flex-1">
                {/* Background com gradiente azul vibrante e claro */}
                <div className="w-full bg-gradient-to-b from-blue-400 via-blue-500 to-blue-700 px-6 sm:px-10 pt-10 pb-16 sm:rounded-3xl relative overflow-hidden flex-1 flex flex-col items-center justify-center">
                  {/* Elementos decorativos de fundo */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-blue-300/20 rounded-full blur-3xl"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-white/[0.05] to-transparent rounded-full font-black"></div>
                  </div>



                  <div className="relative z-10 flex flex-col items-center w-full max-w-sm mx-auto">
                    {/* Header com valor */}
                    <div className="text-center mb-8">
                      <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full mb-4 border border-white/10">
                        <CheckCircle2 className="w-4 h-4 text-green-300" />
                        <span className="text-xs font-bold text-white uppercase tracking-widest">PAGAMENTO VIA PIX</span>
                      </div>
                      <div className="text-white">
                        <span className="text-base font-medium text-blue-100 block opacity-90 mb-1">Total a pagar</span>
                        <div className="flex items-center justify-center">
                          <span className="text-3xl sm:text-4xl text-blue-100/80 font-bold mr-1.5 mt-2">R$</span>
                          <span className="text-6xl sm:text-7xl font-black tracking-tighter tabular-nums drop-shadow-2xl">
                            {totalValue.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* QR Code Container */}
                    <div className="bg-white p-5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] mb-8 relative group transition-transform duration-500 hover:scale-[1.02]">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-[2.5rem] pointer-events-none"></div>
                      {pixData?.qr_code_base64 ? (
                        <img
                          src={`data:image/jpeg;base64,${pixData.qr_code_base64}`}
                          alt="QR Code PIX"
                          className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-3xl relative z-10 mix-blend-multiply"
                        />
                      ) : (
                        <div className="w-56 h-56 sm:w-64 sm:h-64 bg-blue-50 rounded-3xl flex flex-col items-center justify-center text-blue-500 gap-3">
                          <Loader2 className="h-10 w-10 animate-spin" />
                          <span className="text-sm font-medium">Gerando PIX...</span>
                        </div>
                      )}
                    </div>

                    {/* Seção Copiar Código */}
                    <div className="w-full space-y-4">
                      <p className="text-sm text-white font-semibold text-center drop-shadow-sm">Ou copie o código Pix copia e cola:</p>
                      
                      {/* Input do código PIX - Branco puro, centralizado */}
                      <div className="relative group">
                        <Input
                          readOnly
                          value={pixData?.qr_code || "Aguarde..."}
                          className="w-full font-mono text-center text-[11px] h-16 bg-white border-0 focus-visible:ring-2 focus-visible:ring-green-400 text-slate-900 shadow-2xl rounded-2xl px-6"
                        />
                      </div>
                      
                      {/* Botão Copiar - AGORA VERDE POR PADRÃO */}
                      <Button
                        variant="secondary"
                        onClick={copyPix}
                        disabled={!pixData?.qr_code}
                        className={`w-full h-15 rounded-2xl font-black text-lg shadow-[0_10px_25px_rgba(34,197,94,0.3)] transition-all duration-300 active:scale-[0.97] flex items-center justify-center gap-3 border-0 ${
                          pixCopied 
                            ? 'bg-green-600 hover:bg-green-700 text-white' 
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        {pixCopied ? (
                          <><CheckCircle2 className="h-6 w-6" /> Código Copiado!</>
                        ) : (
                          <><Copy className="h-6 w-6" /> COPIAR CÓDIGO PIX</>
                        )}
                      </Button>
                      
                      {pixCopied && (
                        <p className="text-xs text-green-200 text-center font-bold animate-bounce mt-2">
                          ✓ Pronto! Agora abra o app do seu banco.
                        </p>
                      )}
                    </div>

                    {/* Status de confirmação centralizado */}
                    <div className="text-center mt-10 w-full">
                      <div className="inline-flex items-center justify-center gap-3 bg-black/20 backdrop-blur-md py-3 px-8 rounded-full border border-white/10 shadow-lg">
                        <div className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400"></span>
                        </div>
                        <p className="text-sm font-bold text-white">Aguardando seu pagamento...</p>
                      </div>

                      {pixData?.payment_id && (
                        <p className="text-[10px] text-white/40 pt-6 font-mono tracking-widest uppercase">ID Transação: {pixData.payment_id}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {checkoutStep === 4 && (
              <div className="flex flex-col items-center space-y-4 text-center py-2">
                <img src={Logo} alt="IVAS Logo" className="h-16 w-auto mb-2" />
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Pagamento Confirmado!</h3>
                  <p className="text-gray-500 text-sm mt-1">Seus números foram garantidos. Boa sorte! 🍀</p>
                </div>
                <div className="bg-gray-50 p-4 sm:p-6 rounded-xl w-full space-y-4 text-left border border-gray-100 shadow-inner">
                  <div className="flex justify-between items-start flex-wrap gap-3 border-b border-gray-200 pb-3">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Pedido</p>
                      <p className="text-sm font-mono font-bold text-gray-700">#{pedidoId?.substring(0, 8).toUpperCase()}</p>
                    </div>
                    {pixData?.payment_id && (
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">ID Transação</p>
                        <p className="text-sm font-mono text-blue-600 font-bold">{pixData.payment_id}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-3 text-center">Meus Números da Sorte</p>
                    <div className="flex flex-wrap justify-center gap-2.5">
                      {selectedNumbers.map((num) => (
                        <div
                          key={num}
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-base sm:text-lg shadow-lg border-2 border-white ring-2 ring-blue-100"
                        >
                          {padNum(num)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── RODAPÉ DO MODAL ── */}
          <div className="mt-auto p-5 sm:px-6 sm:pb-6 sm:pt-0 border-t sm:border-t-0 bg-white sm:bg-transparent">
            {checkoutStep === 1 && (
              <Button className="w-full h-12 text-base" onClick={() => setCheckoutStep(2)}>Continuar</Button>
            )}
            {checkoutStep === 2 && (
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12" onClick={() => { setCheckoutStep(1); setCheckoutError(null); }} disabled={isSubmitting}>Voltar</Button>
                <Button className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-base" onClick={handleCheckout} disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aguarde...</> : "Gerar PIX"}
                </Button>
              </div>
            )}
            {checkoutStep === 4 && (
              <Button className="w-full h-12 text-base" onClick={() => { setIsModalOpen(false); setSelectedNumbers([]); setCheckoutStep(1); window.location.reload(); }}>
                Fechar
              </Button>
            )}
            
            {(checkoutStep === 1 || checkoutStep === 2) && (
              <p className="text-[10px] text-gray-400 text-center mt-4 leading-tight">
                Ao continuar, você declara que concorda com os nossos <br />
                <a href="/termos" target="_blank" rel="noopener noreferrer" className="underline cursor-pointer hover:text-blue-500">Termos de Uso</a> e <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="underline cursor-pointer hover:text-blue-500">Política de Privacidade</a>.
              </p>
            )}
          </div>

        </DialogContent>
      </Dialog>
      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 text-center mt-12 pb-32 md:pb-12">
        <div className="max-w-7xl mx-auto px-4">
          {config.logo_url ? (
            <img src={config.logo_url} alt={config.nome_sistema} className="h-10 object-contain mx-auto mb-4 grayscale opacity-50" />
          ) : (
            <Ticket className="h-8 w-8 text-blue-500 mx-auto mb-4" />
          )}
          <p className="text-sm mb-6">Este site é destinado exclusivamente para uso de pessoas maiores de 18 anos. Ao acessar e utilizar os serviços oferecidos, você confirma que possui 18 anos ou mais.</p>
          <p className="mb-2">© {new Date().getFullYear()} {config.nome_sistema}. Todos os direitos reservados.</p>


          <div className="flex flex-wrap justify-center gap-4 text-xs mb-6">
            <Link to="/" className="hover:text-white transition-colors">Ver Rifas</Link>
            <Link to="/termos" className="hover:text-white transition-colors">Termos de Uso</Link>
            <Link to="/privacidade" className="hover:text-white transition-colors">Política de Privacidade</Link>
          </div>

          <Link to="/admin" className="text-xs text-gray-800 hover:text-gray-600 transition-colors block">
            Área Restrita
          </Link>
        </div>
      </footer>
    </div>
  );
}

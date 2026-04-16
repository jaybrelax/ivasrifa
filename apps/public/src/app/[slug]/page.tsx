import { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import RifaDetailsClient from "@/components/RifaDetailsClient";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getRifaData(slug: string) {
  // Check if slug is a valid UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  
  let query = supabase.from("rifas").select("*");
  if (isUuid) {
    query = query.eq("id", slug);
  } else {
    query = query.eq("slug", slug);
  }

  const { data: rifa, error } = await query.single();
  
  if (error || !rifa) return null;

  const [premiosRes, numbersRes, configRes] = await Promise.all([
    supabase.from("premios").select("*").eq("rifa_id", rifa.id).order("posicao", { ascending: true }),
    supabase.from("numeros_rifa").select("numero, status").eq("rifa_id", rifa.id),
    supabase.from('vw_configuracoes_publicas').select('*').eq('id', 1).single()
  ]);

  return {
    rifa,
    premios: premiosRes.data || [],
    numbers: numbersRes.data || [],
    config: configRes.data || { nome_sistema: "Sorteios Online" }
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getRifaData(slug);
  
  if (!data) return { title: "Rifa não encontrada" };

  const { rifa, config } = data;
  const title = `${rifa.titulo} | ${config.nome_sistema}`;
  const description = rifa.descricao?.substring(0, 160) || "Participe desta rifa e concorra a prêmios incríveis!";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: rifa.imagem_url ? [rifa.imagem_url] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: rifa.imagem_url ? [rifa.imagem_url] : [],
    }
  };
}

export default async function RifaPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getRifaData(slug);

  if (!data) {
    notFound();
  }

  return (
    <RifaDetailsClient 
      initialRifa={data.rifa}
      initialPremios={data.premios}
      initialNumbers={data.numbers}
      config={data.config}
    />
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { heroVariants } from "@/components/home/hero-variants";
import { Offers } from "@/components/home/offers";

// PRÉVIA TEMPORÁRIA para comparar variações do hero. Não vai para produção.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return Object.keys(heroVariants).map((v) => ({ v }));
}

export default async function PreviaHero({ params }: { params: Promise<{ v: string }> }) {
  const { v } = await params;
  const Hero = heroVariants[v as keyof typeof heroVariants];
  if (!Hero) notFound();
  return (
    <>
      <Hero />
      <Offers />
    </>
  );
}

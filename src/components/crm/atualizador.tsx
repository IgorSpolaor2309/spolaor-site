"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVALO = 20_000;
const PAUSA_SEM_USO = 15 * 60_000;

/**
 * Mantém a tela em dia enquanto ela está aberta: a cada 20 segundos pergunta ao servidor um carimbo do estado do
 * CRM e, se mudou, recarrega os dados da página (sem perder a rolagem).
 *
 * Proporcional ao volume: é uma consulta leve, só com a aba visível, e para depois de 15 minutos sem uso (cada
 * consulta acorda o banco; uma aba esquecida aberta não pode mantê-lo ligado o dia inteiro). Voltar à aba ou mexer
 * nela retoma na hora. Não recarrega enquanto há um campo em edição, para não atrapalhar quem está escrevendo.
 */
export function Atualizador({ inicial }: { inicial: string }) {
  const router = useRouter();
  const carimbo = useRef(inicial);
  const ultimoUso = useRef(0);
  const [estado, setEstado] = useState<"ativo" | "pausado" | "sem_conexao">("ativo");
  const [hora, setHora] = useState<string | null>(null);

  useEffect(() => {
    carimbo.current = inicial;
  }, [inicial]);

  useEffect(() => {
    let parado = false;
    ultimoUso.current = Date.now();
    const editando = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const campo = el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !["checkbox", "radio", "submit", "button"].includes((el as HTMLInputElement).type));
      return campo && ((el as HTMLInputElement).value ?? "").length > 0;
    };
    const conferir = async () => {
      if (parado || document.visibilityState !== "visible") return;
      if (Date.now() - ultimoUso.current > PAUSA_SEM_USO) return setEstado("pausado");
      try {
        const r = await fetch("/api/leads/pulso", { cache: "no-store" });
        if (r.status === 401) return window.location.assign("/leads/entrar");
        if (!r.ok) return setEstado("sem_conexao");
        const { pulso } = (await r.json()) as { pulso: string };
        setEstado("ativo");
        setHora(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
        if (pulso !== carimbo.current && !editando()) {
          carimbo.current = pulso;
          router.refresh();
        }
      } catch {
        setEstado("sem_conexao");
      }
    };
    const usar = () => {
      const estavaPausado = Date.now() - ultimoUso.current > PAUSA_SEM_USO;
      ultimoUso.current = Date.now();
      if (estavaPausado) void conferir();
    };
    const visivel = () => {
      if (document.visibilityState === "visible") {
        ultimoUso.current = Date.now();
        void conferir();
      }
    };
    const t = setInterval(conferir, INTERVALO);
    document.addEventListener("visibilitychange", visivel);
    for (const ev of ["pointerdown", "keydown", "scroll"]) window.addEventListener(ev, usar, { passive: true });
    return () => {
      parado = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", visivel);
      for (const ev of ["pointerdown", "keydown", "scroll"]) window.removeEventListener(ev, usar);
    };
  }, [router]);

  return (
    <p className="text-[0.78rem] text-dim" aria-live="polite" data-atualizador={estado}>
      {estado === "pausado"
        ? "Atualização automática pausada por falta de uso. Toque na tela para retomar."
        : estado === "sem_conexao"
          ? "Sem conexão com o servidor: os dados podem estar desatualizados."
          : `Atualiza sozinha a cada 20 segundos${hora ? ` · conferida às ${hora}` : ""}.`}
    </p>
  );
}

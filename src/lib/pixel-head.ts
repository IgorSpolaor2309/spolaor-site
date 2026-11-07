// Código base do Meta Pixel no <head>, antes da hidratação (usado em app/layout.tsx).
//
// Por quê: a "visualização da página de destino" da Meta só conta quando o PageView sai depois do
// clique no anúncio. Quando o Pixel era carregado só depois da hidratação (componente Analytics), o
// PageView saía depois do evento load (≈2,8 s em 4G simulado e 9–11 s em 3G simulado, com o texto
// já na tela em ≈1,3 s e ≈3 s): quem lia a abertura e saía antes disso não contava. Aqui o PageView
// da primeira página entra na fila assim que o <head> é lido; o fbevents.js segue assíncrono e não
// atrasa a pintura. As navegações internas seguem com trackPageView (lib/analytics.ts), que não
// repete este primeiro PageView (marca window.__spolaorPageView).
//
// Módulo sem "use client" para o layout (servidor) poder ler o ID.

const raw = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim();

/** ID do Pixel, só se for numérico (o valor entra num script inline). Vazio = Pixel desligado. */
export const headPixelId = /^\d{5,20}$/.test(raw) ? raw : "";

/** Snippet oficial da Meta (fila + fbevents.js assíncrono) com init e o PageView da primeira página. */
export function pixelHeadScript(id: string) {
  return (
    "try{!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};" +
    "if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;" +
    "s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');" +
    `fbq('init','${id}');fbq('track','PageView');window.__spolaorPageView=1}catch(e){}`
  );
}

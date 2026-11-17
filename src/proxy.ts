import { NextResponse, type NextRequest } from "next/server";
import { blogInternalPath, blogOrigin, isBlogHost, siteOrigin } from "@/lib/blog/config";

// Blog no subdomínio (blog.<domínio>), servido por este mesmo projeto:
//  - no subdomínio do blog, "/", "/<slug>", "/sitemap.xml", "/robots.txt" e "/feed.xml" são reescritos para
//    as rotas em src/app/blog; qualquer outro caminho é do site principal e volta para ele (308);
//  - no site principal, /blog e /blog/... redirecionam para o subdomínio (um endereço só por artigo).
// Arquivos estáticos, imagens otimizadas e /api passam direto (matcher).
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isBlogHost(request.headers.get("host"))) {
    const interno = blogInternalPath(pathname);
    if (interno) {
      const url = request.nextUrl.clone();
      url.pathname = interno;
      return NextResponse.rewrite(url);
    }
    return NextResponse.redirect(`${siteOrigin}${pathname}${search}`, 308);
  }

  if (pathname === "/blog" || pathname.startsWith("/blog/")) {
    const resto = pathname.slice("/blog".length) || "/";
    return NextResponse.redirect(`${blogOrigin}${resto}${search}`, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|api/|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|css|js|map|webmanifest)$).*)"],
};

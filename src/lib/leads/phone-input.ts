import type { ChangeEvent } from "react";
import { maskPhone } from "./schema";

/**
 * onChange do campo WhatsApp dos formulários: aplica a máscara e mantém o cursor depois do mesmo dígito.
 *
 * Por quê: ao reformatar (por exemplo, ao substituir um trecho selecionado no meio do número), o navegador
 * jogava o cursor para o fim do campo e os dígitos seguintes iam para o lugar errado. Selecionar "99747" em
 * "(13) 99747-2309" e digitar "98888" resultava em "(13) 92309-8888": outro número, com cara de válido.
 *
 * Também trata o Backspace/Delete sobre um separador ("(", ")", espaço, "-"): sem isso o campo voltava ao mesmo
 * valor e o dígito não saía; agora sai o dígito vizinho, como a pessoa espera.
 *
 * `anterior` é o valor do campo antes desta alteração (o estado do formulário).
 */
export function mascararTelefone(e: ChangeEvent<HTMLInputElement>, anterior: string): string {
  const el = e.target;
  let bruto = el.value;
  let pos = el.selectionStart ?? bruto.length;
  const so = (s: string) => s.replace(/\D/g, "");

  // Apagou só um separador: remove o dígito vizinho (Backspace = o anterior ao cursor; Delete = o seguinte).
  if (so(bruto) === so(anterior) && bruto.length < anterior.length) {
    const tipo = (e.nativeEvent as InputEvent).inputType;
    if (tipo === "deleteContentForward") {
      const i = bruto.slice(pos).search(/\d/);
      if (i >= 0) bruto = bruto.slice(0, pos + i) + bruto.slice(pos + i + 1);
    } else {
      const antes = bruto.slice(0, pos);
      const i = antes.search(/\d\D*$/);
      if (i >= 0) {
        bruto = bruto.slice(0, i) + bruto.slice(i + 1);
        pos = i;
      }
    }
  }

  const digitos = so(bruto);
  const zeros = digitos.length - digitos.replace(/^0+/, "").length;
  const antesDoCursor = Math.max(0, so(bruto.slice(0, pos)).length - zeros);
  const valor = maskPhone(bruto);
  const alvo = posicaoAposDigitos(valor, antesDoCursor);
  // Grava já o valor formatado e o cursor no próprio campo. Como o valor do DOM passa a ser igual ao novo estado,
  // o React não o reescreve na renderização e o cursor fica onde está (reescrever o valor manda o cursor ao fim).
  // Precisa ser síncrono: com digitação rápida, um ajuste adiado chega depois da tecla seguinte.
  if (el.value !== valor) el.value = valor;
  if (document.activeElement === el) el.setSelectionRange(alvo, alvo);
  return valor;
}

/** Posição logo depois do n-ésimo dígito do texto formatado (0 = antes do primeiro dígito). */
export function posicaoAposDigitos(valor: string, n: number): number {
  if (n <= 0) {
    const i = valor.search(/\d/);
    return i < 0 ? valor.length : i;
  }
  let vistos = 0;
  for (let i = 0; i < valor.length; i++) {
    if (/\d/.test(valor[i]) && ++vistos === n) return i + 1;
  }
  return valor.length;
}

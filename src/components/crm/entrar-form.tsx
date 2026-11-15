"use client";

import { useActionState } from "react";
import { entrarAction, pedirCodigoAction, type EstadoEntrada } from "@/app/leads/actions";
import { Enviar } from "./enviar";
import { Aviso, btnPrimary, btnQuiet, Campo, input } from "./ui";

const inicial: EstadoEntrada = { etapa: "email", email: "" };

export function EntrarForm() {
  const [pedido, pedir] = useActionState(pedirCodigoAction, inicial);
  const [entrada, entrar] = useActionState(entrarAction, inicial);

  if (pedido.etapa === "codigo") {
    return (
      <div className="grid gap-4">
        <Aviso>
          Se <strong>{pedido.email}</strong> tiver acesso, um código de 6 dígitos foi enviado para esse e-mail. Vale por 10 minutos.
        </Aviso>
        <form action={entrar} className="grid gap-4">
          <input type="hidden" name="email" value={pedido.email} />
          <Campo rotulo="Código de acesso">
            <input name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus className={`${input} text-center text-[1.4rem] tracking-[0.3em]`} />
          </Campo>
          {entrada.erro && <Aviso tom="alerta">{entrada.erro}</Aviso>}
          <Enviar className={btnPrimary}>Entrar</Enviar>
        </form>
        <form action={pedir}>
          <input type="hidden" name="email" value={pedido.email} />
          <Enviar className={btnQuiet}>Enviar outro código</Enviar>
        </form>
      </div>
    );
  }
  return (
    <form action={pedir} className="grid gap-4">
      <Campo rotulo="Seu e-mail">
        <input name="email" type="email" autoComplete="email" required autoFocus defaultValue={pedido.email} className={input} />
      </Campo>
      {pedido.erro && <Aviso tom="alerta">{pedido.erro}</Aviso>}
      <Enviar className={btnPrimary}>Receber código por e-mail</Enviar>
    </form>
  );
}

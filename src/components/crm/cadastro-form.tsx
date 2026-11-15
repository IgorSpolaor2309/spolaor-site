"use client";

import { useActionState } from "react";
import { cadastrarAction, type EstadoCadastro } from "@/app/leads/actions";
import { CANAIS, CANAL_ROTULO, SERVICOS } from "@/lib/crm/tipos";
import { Enviar } from "./enviar";
import { Aviso, btnPrimary, Campo, input } from "./ui";

const inicial: EstadoCadastro = {};

export function CadastroForm({ agoraLocal }: { agoraLocal: string }) {
  const [estado, acao] = useActionState(cadastrarAction, inicial);
  return (
    <form action={acao} className="grid gap-4 px-4 py-5 sm:grid-cols-2 sm:px-5">
      <Campo rotulo="Nome">
        <input name="nome" required minLength={2} maxLength={200} className={input} autoComplete="off" />
      </Campo>
      <Campo rotulo="Empresa (opcional)">
        <input name="empresa" maxLength={200} className={input} autoComplete="off" />
      </Campo>
      <Campo rotulo="WhatsApp (com DDD)" dica="É por ele (ou pelo e-mail) que o CRM reconhece a mesma pessoa. Nome parecido não une registros.">
        <input name="whatsapp" inputMode="tel" className={input} autoComplete="off" />
      </Campo>
      <Campo rotulo="E-mail">
        <input name="email" type="email" className={input} autoComplete="off" />
      </Campo>
      <Campo rotulo="Instagram">
        <input name="instagram" placeholder="usuario" className={input} autoComplete="off" />
      </Campo>
      <Campo rotulo="Site">
        <input name="site" className={input} autoComplete="off" />
      </Campo>
      <Campo rotulo="Por onde chegou">
        <select name="canal" required defaultValue="whatsapp" className={input}>
          {CANAIS.filter((c) => c !== "formulario").map((c) => (
            <option key={c} value={c}>
              {CANAL_ROTULO[c]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Serviço de interesse">
        <input name="servico" list="servicos-novo" maxLength={200} className={input} />
      </Campo>
      <datalist id="servicos-novo">
        {SERVICOS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Campo rotulo="Como chegou até a Spolaor (opcional)" dica="Ex.: indicação da Marina, anúncio que mencionou, grupo de empresários.">
        <input name="origem" maxLength={200} className={input} />
      </Campo>
      <Campo rotulo="Quando chegou (horário de Brasília)" dica="Mude para registrar um contato antigo com a data real.">
        <input type="datetime-local" name="recebidoEm" defaultValue={agoraLocal} max={agoraLocal} className={input} />
      </Campo>
      <div className="sm:col-span-2">
        <Campo rotulo="O que a pessoa pediu ou escreveu">
          <textarea name="mensagem" maxLength={4000} className={`${input} min-h-[110px]`} />
        </Campo>
      </div>
      {estado.erro && (
        <div className="sm:col-span-2">
          <Aviso tom="alerta">{estado.erro}</Aviso>
        </div>
      )}
      <div className="sm:col-span-2">
        <Enviar className={btnPrimary}>Cadastrar contato</Enviar>
      </div>
    </form>
  );
}

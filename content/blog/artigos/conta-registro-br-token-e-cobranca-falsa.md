---
{
  "titulo": "Conta do Registro.br: como ativar o token e reconhecer cobrança falsa do domínio da empresa",
  "descricao": "Quem acessa a conta do Registro.br controla o domínio. Veja como ativar o token, guardar os códigos de recuperação e conferir se uma cobrança é verdadeira.",
  "status": "publicado",
  "publicadoEm": "2026-11-20T18:40:00-03:00",
  "atualizadoEm": "2026-11-20T18:40:00-03:00",
  "turno": "2026-11-20-tarde",
  "servicos": ["sites", "consultoria"],
  "fontes": [
    {
      "titulo": "Ajuda do Registro.br: Gerenciamento de conta, seções Chave de acesso e Token (NIC.br)",
      "url": "https://registro.br/ajuda/gerenciamento-de-conta/",
      "consultadoEm": "2026-11-20",
      "trecho": "Um segundo fator de segurança para acesso ao nosso sistema, conhecido também como \"Verificação em Duas Etapas\". Seu uso é opcional e não substitui a senha do usuário. Recomendamos a utilização do Token, pois ele aumenta, em muito, a segurança no acesso aos domínios registrados."
    },
    {
      "titulo": "Ajuda do Registro.br: Problemas para acessar a conta (NIC.br)",
      "url": "https://registro.br/ajuda/problemas-para-acessar-a-conta/",
      "consultadoEm": "2026-11-20",
      "trecho": "Basta acessar o sistema utilizando o código temporal e solicitar uma nova leva de códigos de segurança. Isso invalidará todos os códigos de segurança já emitidos para esse token."
    },
    {
      "titulo": "Ajuda do Registro.br: Procedimentos administrativos, reabilitação de conta (NIC.br)",
      "url": "https://registro.br/ajuda/procedimentos-administrativos/alteracao-do-email/",
      "consultadoEm": "2026-11-20",
      "trecho": "Indicado para contas cadastradas com nome completo da PESSOA FÍSICA, por usuários que não se recordam da senha cadastrada e não possuem acesso ao e-mail vinculado à conta. Também indicado para casos de perda de acesso através do Token cadastrado."
    },
    {
      "titulo": "Cobranças indevidas (Registro.br)",
      "url": "https://registro.br/cobrancas-indevidas",
      "consultadoEm": "2026-11-20",
      "trecho": "O Registro.br não envia cobranças por correio, em nenhuma circunstância. As cobranças por e-mail vem do domínio @registro.br e nunca de qualquer outro domínio."
    },
    {
      "titulo": "Cartilha de Segurança para Internet, fascículo Autenticação (CERT.br)",
      "url": "https://cartilha.cert.br/fasciculos/autenticacao/fasciculo-autenticacao.pdf",
      "consultadoEm": "2026-11-20",
      "trecho": "Prefira chave de segurança física ou geradores de códigos de verificação por aplicativo de celular • use SMS apenas se não houver outras opções [...] Gere códigos de backup (reserva) para usar quando outras opções de autenticação não estiverem disponíveis"
    }
  ],
  "historico": [
    { "em": "2026-11-20T18:40:00-03:00", "turno": "2026-11-20-tarde", "tipo": "publicacao", "resumo": "Publicação." }
  ]
}
---
Quem entra na conta do Registro.br que administra o domínio consegue mexer no endereço do site e dos e-mails da empresa. Por isso, dois cuidados valem a pena: **ativar o token** (a verificação em duas etapas do Registro.br) e **guardar os códigos de recuperação** num lugar que a empresa consiga encontrar. E, como há golpes com boletos e Pix falsos em nome do Registro.br, vale saber **como reconhecer uma cobrança verdadeira** antes de pagar.

Se você ainda não sabe em nome de quem está o domínio, nem quem são os contatos dele, comece por [quem é o dono do domínio do seu site](/dono-do-dominio-do-site-registro-br). Este texto parte do ponto seguinte: a conta já é sua, ou de alguém da empresa, e precisa ficar protegida.

## Senha e e-mail não bastam

Quando o navegador não é reconhecido e a conta não tem token, o Registro.br pede uma **chave de acesso**: um código enviado ao e-mail da conta. Parece uma segunda etapa, mas a [ajuda do Registro.br](https://registro.br/ajuda/gerenciamento-de-conta/) explica que não é: como quem tem acesso ao e-mail consegue redefinir a senha, os dois contam como um fator só. Na prática, numa conta sem token, quem tomar o e-mail cadastrado pode chegar à conta.

O próprio Registro.br diz que o token é um substituto mais seguro para essas chaves de acesso e recomenda o seu uso. O uso é opcional, e o token não substitui a senha: passa a ser pedido junto com ela.

## Como o token funciona e como ativar

Segundo a ajuda do Registro.br, há três formas de segundo fator:

- **Token no aplicativo:** um aplicativo no celular gera um código numérico que muda a cada 30 segundos. O Registro.br recomenda o Google Authenticator.
- **Token físico:** uma chave de segurança no padrão FIDO2/U2F.
- **Códigos de recuperação de acesso:** uma lista de 10 códigos, cada um usado uma única vez, para usar quando os outros métodos não estiverem disponíveis.

Para ativar, entre no sistema com usuário e senha, clique em **"Segurança"** e depois em **"Cadastrar Token"** (aplicativo) ou **"Cadastrar Novo Token Físico"**, seguindo as instruções da tela. Um detalhe importante: o código do aplicativo depende da hora do celular. A ajuda informa que a hora precisa estar correta, com tolerância de até 30 segundos.

A [Cartilha de Segurança para Internet do CERT.br](https://cartilha.cert.br/fasciculos/autenticacao/fasciculo-autenticacao.pdf), no fascículo sobre autenticação, vai na mesma direção para contas em geral: prefira chave física ou aplicativo gerador de códigos, use SMS só se não houver outra opção e gere códigos de reserva, guardados em local seguro.

## O que muda se você perder o celular ou esquecer a senha

Com o token ativo, a recuperação fica mais rígida, e é isso que protege o domínio. Pelas páginas de ajuda do Registro.br:

- **Esqueceu a senha:** para redefini-la, passa a ser preciso usar um código de recuperação ou o token físico, junto com o acesso ao e-mail cadastrado. O código que muda a cada 30 segundos no aplicativo não serve para isso, justamente para que quem fique com um celular perdido, que tenha o aplicativo e o acesso ao e-mail, não consiga assumir a conta.
- **Perdeu o celular:** entre com um código de recuperação (ou com o token físico, se houver) e cadastre o novo aparelho em **"Alterar Token"**.
- **Perdeu os códigos, mas ainda tem o aplicativo:** segundo a página de [problemas para acessar a conta](https://registro.br/ajuda/problemas-para-acessar-a-conta/), dá para entrar com o código do aplicativo e gerar uma nova lista; a anterior deixa de valer.
- **Perdeu tudo** (códigos, aplicativo e token físico): o acesso só volta por um procedimento administrativo.

Esse procedimento, a reabilitação de conta, é feito com envio de documentos assinados (a página recomenda fortemente o assinador gov.br) e tem prazo de análise de 2 dias úteis a partir do recebimento da documentação, segundo a [página de procedimentos administrativos](https://registro.br/ajuda/procedimentos-administrativos/alteracao-do-email/). Há um detalhe importante nela: a reabilitação é indicada para contas cadastradas com o **nome completo de uma pessoa física**. Se a conta que administra o domínio da empresa foi criada com nome abreviado ou em nome da própria empresa, e ninguém lembra a senha nem tem acesso ao e-mail, o caminho passa a ser a transferência do contato do titular, que pede a documentação da empresa e a assinatura de quem a representa; a nova conta indicada precisa estar no nome completo de uma pessoa física.

Em outra resposta, a ajuda do Registro.br diz que, mesmo quando o domínio é de uma empresa, a administração é sempre feita por uma pessoa física, e que o cadastro com o nome correto é a única forma de identificar a quem pertence a conta quando é preciso recuperar a senha por procedimento administrativo.

## Como reconhecer uma cobrança verdadeira

A página de [cobranças indevidas](https://registro.br/cobrancas-indevidas) do Registro.br alerta para tentativas continuadas de golpe com boletos maliciosos e cobranças Pix falsas. Os pontos que ela traz:

- **O pagamento é emitido no site do Registro.br.** Boleto e QR Code Pix da manutenção do domínio saem do próprio site.
- **Não há cobrança por correio**, em nenhuma circunstância.
- **E-mail de cobrança vem do domínio @registro.br**, nunca de outro.
- **O recebedor é o NIC.br** (CNPJ 05.506.560/0001-36). A página mostra os bancos, a agência e o código do cedente e a linha digitável dos boletos verdadeiros, que deve ser idêntica à publicada, variando só nas posições marcadas com X. Para o Pix, traz o titular, a instituição, o CNPJ, a chave e o formato do identificador da transação. Compare antes de pagar.
- **Cobrança verdadeira não fala em "opcional", "facultativo", "hospedagem" ou "e-mail".** Ela se refere a um registro que você já pediu, e o valor corresponde ao período de manutenção escolhido, de 1 a 10 anos.

Se pagar com leitor de código de barras, a página recomenda, antes de confirmar, conferir se a linha digitável exibida no app do banco segue a publicada na própria página, porque há fraudes em que o código de barras traz dados diferentes da linha digitável do boleto original. Na dúvida, fale com a central de atendimento do Registro.br antes de pagar.

Um lembrete, na nossa leitura: uma cobrança de "hospedagem" ou de "e-mail" pode ser legítima, mas, se for, vem do seu provedor de hospedagem e não do Registro.br. A mesma página pede atenção a cobranças que não tenham sido enviadas nem pelo Registro.br nem pelo provedor atual.

## Checklist para a empresa

1. Descubra qual conta (ID) administra o domínio e se ela está no **nome completo** de uma pessoa da empresa.
2. Confira se o **e-mail da conta** é um endereço que a empresa controla e que alguém lê.
3. Ative o **token** e, se fizer sentido, cadastre também um token físico.
4. Imprima ou guarde os **10 códigos de recuperação** num lugar seguro, que não seja o mesmo celular do aplicativo.
5. Combine com a equipe e o financeiro: **cobrança de domínio só se paga depois de conferir** no site do Registro.br.

Imagine, como ilustração, uma clínica que ativou o token no celular do sócio responsável e nunca guardou os códigos de recuperação. Se esse celular for trocado sem o cuidado de passar o token para o aparelho novo, a conta só volta por procedimento administrativo, com documentos e prazo de análise. Guardar os códigos hoje leva poucos minutos e evita esse caminho.

Se você vai refazer o site e quer o domínio no CNPJ da empresa, administrado por uma conta no nome completo de alguém da empresa, e os demais acessos registrados com a empresa desde o começo, peça isso no orçamento de [criação de site](https://www.spolaortecnologia.com.br/sites). Se a dúvida é mais ampla, como levantar quem tem acesso a quê (domínio, e-mail, Google, redes) e o que proteger primeiro, a [consultoria em tecnologia](https://www.spolaortecnologia.com.br/consultoria) ajuda a montar esse mapa. Vale também conferir quem controla a ficha da empresa no Google, como explicamos em [quem é o dono do Perfil da Empresa no Google](/dono-do-perfil-da-empresa-no-google).

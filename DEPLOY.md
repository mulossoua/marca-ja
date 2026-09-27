# Guia para gerar os executáveis e publicar a API

Este documento cobre exactamente os passos que dependem de contas externas —
nada disto pode ser feito por mim, porque exige credenciais suas.

---

## 1. Publicar a API (fazer isto PRIMEIRO — o mobile precisa da URL)

Stack 100% grátis e sem expirar: **base de dados no Neon** (a Postgres do
próprio Render expira aos 30 dias no plano gratuito) + **API no Render**.

### 1a. Base de dados (Neon)

1. Crie conta grátis em https://neon.tech (pode entrar com GitHub)
2. **New Project** → dê um nome (ex.: `marca-ja`)
3. O Neon mostra logo uma **connection string** (`postgresql://...`) — copie-a,
   vai precisar dela no passo seguinte. Já vem com `?sslmode=require`, que o
   Prisma aceita sem alterações.

### 1b. API (Render)

1. Crie conta em https://render.com (grátis, sem cartão)
2. O repositório já está no GitHub: `mulossoua/marca-ja`
3. No Render: **New +** → **Blueprint** → escolha o repositório. O ficheiro
   `render.yaml` já está pronto na raiz e cria o serviço `marca-ja-api`
   automaticamente, com `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` gerados sozinhos.
4. **Antes de aplicar** (ou logo a seguir), em **Environment**, adicione
   manualmente a variável `DATABASE_URL` com a connection string do Neon do
   passo 1a — o blueprint deixa-a marcada para preenchimento manual de propósito.
5. Depois de publicado, o Render dá-lhe um URL do tipo
   `https://marca-ja-api.onrender.com` — é esse URL que vai usar em todo o resto
   deste guia como `<API_URL>`.
6. Corra o seed de demonstração contra a BD de produção (opcional, só para
   testar): localmente, apontando `DATABASE_URL` para a connection string do
   Neon, `npm run --workspace=packages/database seed`.

**Nota sobre o plano gratuito do Render**: a API "adormece" ao fim de 15 min
sem pedidos e demora ~1 min a responder na chamada seguinte. A base de dados
no Neon nunca expira nem é apagada — só a API tem esta latência inicial.

---

## 2. Preparar a conta EAS (Expo) — obrigatório para ambas as plataformas

```bash
npm install -g eas-cli
eas login          # cria conta grátis em expo.dev se ainda não tiver
cd apps/mobile
eas build:configure
```

Isto substitui o placeholder `projectId` em `app.json` pelo ID real do seu
projecto. `eas.json` já está criado com 3 perfis (`development`, `preview`,
`production`) — só falta editar os `env.EXPO_PUBLIC_API_URL` desse ficheiro
para o `<API_URL>` do passo 1.

---

## 3. Gerar o executável Android (.apk — o mais rápido para testar)

```bash
cd apps/mobile
eas build --platform android --profile preview
```

- Não exige conta Google Play para este passo — o EAS devolve um link para
  descarregar o `.apk` directamente e instalar num telemóvel Android (activar
  "Instalar de fontes desconhecidas" nas definições do Android).
- Para publicar na Play Store mais tarde: conta Google Play Console (25 USD,
  pagamento único) + `eas build --profile production` (gera `.aab`) +
  `eas submit --platform android`.

---

## 4. Gerar o executável iOS (.ipa)

Isto **exige uma conta Apple Developer (99 USD/ano)** — não há forma de testar
num iPhone físico sem ela (nem para uso pessoal/interno).

```bash
eas build --platform ios --profile preview
```

O EAS pergunta as credenciais Apple na primeira vez e trata de certificados e
provisioning profiles automaticamente. Sem conta Apple, ainda pode testar a
app em qualquer navegador via Expo Web (`npx expo start --web`), como fizemos
na simulação — mas isso não é um `.ipa` instalável.

---

## 5. Antes de publicar a sério — checklist

- [ ] Trocar `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` por valores gerados
      aleatoriamente em produção (o Render já faz isto sozinho via `render.yaml`).
- [ ] Restringir CORS na API a domínios conhecidos (hoje está aberto — ver
      nota no `README.md`, secção "Pendências para produção").
- [ ] Ícone e splash screen reais da marca (hoje usa os predefinidos do Expo) —
      ficheiros em `apps/mobile/assets/`, referenciados no `app.json`.
- [ ] Nome definitivo do pacote/bundle (`com.marcaja.app` é um placeholder no
      `app.json` — mude para o domínio real da empresa, ex.: `com.suaempresa.app`).
- [ ] Política de privacidade (URL) — a Google Play e a App Store exigem-na
      mesmo para apps grátis que recolhem dados de conta.

---

## O que eu não posso fazer por si

Criar as contas (Expo, Apple Developer, Google Play, Render/Railway) exige os
seus dados pessoais/de pagamento — isso tem de ser feito directamente por si
nos respectivos sites. Depois de ter as contas, posso correr todos os comandos
(`eas build`, configurar variáveis, ajustar `app.json`, resolver erros de build)
sem precisar de mais nada da sua parte.

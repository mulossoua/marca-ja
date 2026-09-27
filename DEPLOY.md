# Guia para gerar os executáveis e publicar a API

Este documento cobre exactamente os passos que dependem de contas externas —
nada disto pode ser feito por mim, porque exige credenciais suas.

---

## 1. Publicar a API (fazer isto PRIMEIRO — o mobile precisa da URL)

Recomendado: **Render** (tem plano gratuito, mais simples para começar).

1. Crie conta em https://render.com
2. Suba este repositório para o GitHub (posso ajudar com isso — `git init` +
   `git push` — só preciso da sua autorização e do link do repositório vazio).
3. No Render: **New +** → **Blueprint** → escolha o repositório. O ficheiro
   `render.yaml` já está pronto na raiz e cria a API + a base de dados Postgres
   automaticamente, com os segredos gerados sozinhos.
4. Depois de publicado, o Render dá-lhe um URL do tipo
   `https://marca-ja-api.onrender.com` — é esse URL que vai usar em todo o resto
   deste guia como `<API_URL>`.
5. Corra o seed de demonstração contra a BD de produção (opcional, só para
   testar): no shell do Render, ou localmente apontando `DATABASE_URL` para lá,
   `npm run --workspace=packages/database seed`.

**Alternativas equivalentes**: Railway (railway.app), Fly.io (fly.io) — todos
aceitam o mesmo `apps/api/Dockerfile` sem alterações.

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

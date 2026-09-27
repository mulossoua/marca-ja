# Marca Já — Plataforma de agendamento (Barbearias & Salões)

Monorepo com quatro pacotes:

- `packages/database` — schema Prisma (PostgreSQL), migrações e seed de demonstração.
- `apps/api` — backend Node.js + TypeScript + Express, multi-tenant.
- `apps/mobile` — app cliente em React Native (Expo): explorar, marcar, gerir marcações.
- `apps/backoffice` — painel web (Vite + React) do gestor do estabelecimento.

## Arranque local

```bash
npm install

# BD (requer PostgreSQL a correr localmente)
createdb agendamento
createdb agendamento_test

# Configurar variáveis de ambiente
cp apps/api/.env.example apps/api/.env      # ajustar DATABASE_URL para "agendamento"
cp packages/database/.env prisma            # já existe, ajustar se necessário

npm run prisma:generate
npm run prisma:migrate      # aplica migrações à BD "agendamento"
npm run prisma:seed         # dados fictícios de desenvolvimento (contas: Demo@1234)

npm run dev:api             # backend em http://localhost:3000
```

Mobile (requer Expo CLI / dispositivo ou emulador):

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=http://<ip-da-maquina>:3000 npx expo start
```

Backoffice (painel do gestor, no browser):

```bash
cd apps/backoffice
VITE_API_URL=http://localhost:3000 npm run dev   # http://localhost:5173
```

## Testes

```bash
# apps/api/.env deve apontar para a BD "agendamento_test"
npm run test:api
```

O teste `tests/tenant-isolation.test.ts` garante a regra mais crítica do produto:
nenhum estabelecimento consegue ler ou escrever dados de outro.

## Estado (Fases A–O concluídas — MVP completo)

- **Fase A** — Fundação do monorepo, Express, Prisma, tratamento de erros.
- **Fase B** — Autenticação (registo, login, refresh com rotação, logout, `/auth/me`).
- **Fase C** — Estabelecimentos e filiais multi-tenant, isolamento verificado no
  middleware (`requireBusinessAccess` / `requireBranchAccess`) contra a BD, nunca só no frontend.
- **Fase D** — CRUD de Serviços e Profissionais escopado por filial, categorias de
  serviço, associação profissional↔serviço, disponibilidade semanal, bloqueios (folgas/pausas).
- **Fase E** — Motor de disponibilidade (`availability.engine.ts`): calcula slots livres
  cruzando horário do estabelecimento, disponibilidade do profissional, bloqueios e
  marcações existentes. Lógica pura, testada isoladamente (8 casos de fronteira) mais
  testes de integração ligados à BD real.
- **Fase F** — Marcação, cancelamento, reagendamento e máquina de estados
  (`appointment.state.ts`). Concorrência resolvida com transacções `SERIALIZABLE` do
  Postgres: duas marcações simultâneas para o mesmo horário — só uma é aceite, a
  outra recebe 409 (testado com `Promise.all` real, não simulado).
- **Fase G** — Área do cliente no app mobile: explorar/pesquisar, perfil do
  estabelecimento, fluxo de marcação (serviço → profissional → data → hora →
  confirmar), "As minhas marcações" com cancelar. Validada com type-check, build
  real do bundle Metro (744 módulos) e um fluxo E2E completo contra a API com dados
  de seed (pesquisa → disponibilidade → marcar → listar → cancelar).
- **Fase H** — Área do profissional: uma conta de utilizador pode ser ligada a um
  perfil de `Professional` existente (`link-user`, feito pelo gestor). O profissional
  passa a ter uma agenda própria (`/me/professional/appointments`) e bloqueios
  próprios, sempre isolados dos de outros colegas da mesma filial — nunca depende de
  um `professionalId` vindo do cliente.
- **Fase I** — Backoffice web (`apps/backoffice`, Vite + React): login de gestor,
  onboarding do primeiro estabelecimento, dashboard do dia (marcações, receita),
  agenda com transições de estado, gestão de serviços e profissionais. Validado com
  type-check, `vite build` e um smoke test real em Chromium headless (login →
  dashboard → agenda → serviços → profissionais, todos a carregar dados reais da API).
- **Fase J** — Notificações: `Notification` criada nos eventos de confirmação,
  cancelamento e reagendamento da marcação; lembretes (`sendUpcomingReminders`) sem
  duplicação, prontos a ser chamados por um cron externo. Camada de envio
  desacoplada (`notification.sender.ts`) — trocar por um provider real (FCM/SES/
  Twilio) nunca deve exigir tocar nos chamadores.
- **Fase K** — Avaliações (só após `COMPLETED`, uma por marcação, nunca a de outro
  cliente) e Favoritos (negócio/filial/profissional/serviço, com verificação de que
  o alvo existe e sem duplicar).
- **Fase L** — Pagamentos: `Payment` criado atomicamente com cada marcação
  (`PAY_AT_BUSINESS`/`PENDING`), gestor confirma recebimento presencial. Camada
  desacoplada — nenhum gateway online fictício integrado.
- **Fase M** — Relatórios por período: total de marcações, receita, taxa de
  cancelamento/no-show, top serviços e profissionais — só leitura, isolado por filial.
- **Fase N** — SaaS: catálogo de planos sem preços inventados (`starter` /
  `professional` / `business`), com limites de filiais e profissionais **aplicados
  no backend** (não decorativos) e mudança de plano restrita a `PLATFORM_ADMIN`.
- **Fase O** — Auditoria (`AuditLog`) ligada a mudanças de preço/duração de serviço,
  disponibilidade de profissional, vínculo de conta e plano do negócio — a lacuna
  em que o modelo existia no schema mas nunca era escrito foi encontrada e corrigida
  nesta fase. Suite completa revista e um bug sistémico de validação corrigido
  (ver nota abaixo).

**72/72 testes automatizados de backend a passar** (`npm run test:api`), mais
type-check e build limpos em `apps/mobile` e `apps/backoffice`.

### Mapa de endpoints principais

```
POST   /auth/register | /auth/login | /auth/refresh | /auth/logout
GET    /auth/me

GET    /businesses/search                         (público)
POST   /businesses                                 (autenticado — promove a BUSINESS_MANAGER)
GET    /businesses/mine
POST   /businesses/:businessId/branches

GET    /branches/:id/services/public                (público)
POST   /branches/:id/services | PATCH .../:serviceId | DELETE .../:serviceId
PUT    /branches/:id/services/:serviceId/professionals

GET    /branches/:id/professionals/public           (público)
POST   /branches/:id/professionals
PUT    /branches/:id/professionals/:profId/availability
POST   /branches/:id/professionals/:profId/time-blocks

GET    /branches/:id/availability?serviceId=&date=&professionalId=  (público)

POST   /branches/:id/appointments                   (cliente cria marcação)
GET    /branches/:id/appointments                    (gestor lista marcações da filial)
PATCH  /branches/:id/appointments/:apptId/status      (gestor: CONFIRMED/CHECKED_IN/…)

GET    /appointments/mine
POST   /appointments/:apptId/cancel
POST   /appointments/:apptId/reschedule

PATCH  /branches/:id/professionals/:profId/link-user   (gestor liga uma conta a um profissional)
GET    /me/professional/appointments?date=              (agenda do próprio profissional)
PATCH  /me/professional/appointments/:apptId/status
GET|POST|DELETE /me/professional/time-blocks[/:id]       (bloqueios do próprio profissional)

GET    /notifications/mine
PATCH  /notifications/:id/read

POST   /appointments/:apptId/review                       (só se COMPLETED, uma vez)
GET    /branches/:id/reviews                              (público)

GET|POST|DELETE /favourites/mine [/:id]

PATCH  /branches/:id/appointments/:apptId/payment/received  (gestor confirma recebimento)

GET    /branches/:id/reports?from=YYYY-MM-DD&to=YYYY-MM-DD

GET    /plans                                             (público, sem preços)
PATCH  /businesses/:id/plan                                (PLATFORM_ADMIN)
```

### Notas de arquitectura e bugs reais corrigidos

1. **Autorização nunca depende da claim `role` do JWT** (snapshot do momento do
   login) — depende sempre do registo `BusinessMember` verificado em tempo real na
   BD (`requireBusinessAccess`/`requireBranchAccess`). Sem isto, um utilizador
   promovido a gestor ficava bloqueado das suas próprias rotas até novo login.
2. **Erros de validação (`zod`) nunca chegavam a 400.** Até à Fase K, qualquer
   `ZodError` lançado por um `.parse()` caía no handler genérico e devolvia 500 —
   um bug sistémico presente desde a Fase B, afectando todos os endpoints. Corrigido
   centralmente em `errorHandler.ts`.
3. **Concorrência de testes vs. `SERIALIZABLE`.** A suite corre `fileParallelism:
   false` porque transacções `SERIALIZABLE` não relacionadas, ao correr em paralelo
   contra a mesma BD real, podem colidir por bloqueio de predicados (SSI do
   Postgres) — não é um bug de lógica de negócio, mas exige execução sequencial
   dos testes.
4. **`AuditLog` existia no schema desde a Fase A mas nunca era escrito.** Corrigido
   na Fase O: preço/duração de serviço, disponibilidade de profissional, vínculo de
   conta e mudança de plano deixam agora rasto auditável.

### Pendências para produção (fora do MVP)

- Provider real de notificações (FCM/APNs/SMS/WhatsApp) — a camada está pronta
  (`notification.sender.ts`), falta credenciais e integração real.
- Gateway de pagamento online — a camada está desacoplada (`payment.service.ts`),
  só "pagamento no estabelecimento" está implementado, por decisão consciente de
  não integrar gateways fictícios.
- Um agendador externo (cron) real para chamar `sendUpcomingReminders` periodicamente.

## Gerar os executáveis (APK/IPA) e publicar

Ver **[DEPLOY.md](./DEPLOY.md)** — passo-a-passo completo para publicar a API
(Render/Railway/Fly.io, `Dockerfile` e `render.yaml` já prontos) e gerar os
executáveis Android/iOS via EAS Build (`eas.json` já configurado com perfis
`development`/`preview`/`production`). Esses passos exigem contas externas
(Expo, Apple Developer, Google Play, hosting) que só podem ser criadas pelo
dono do produto.

CORS já está restrito a uma lista de origens (`CORS_ALLOWED_ORIGINS`, ver
`.env.example`) — apps nativas (mobile) não são afectadas, só chamadas vindas
de um browser.

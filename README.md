# EcomGenius Ads OS

Motor de decisiones para campañas de Meta/TikTok Ads de **Feel Ink** y **Skinglow**. Ingesta CSVs cada 3 días, aplica el SOP de Eduardo como reglas deterministas, clasifica ads y conjuntos, y sugiere acciones concretas (apagar, rotar, escalar, iterar).

> **Scope actual:** Fase 0 + núcleo de Fase 1 del PRD v1.0 (16-abr-2026). Meta Ads únicamente. TikTok Ads en Fase 2.

---

## Estado del MVP

| Criterio §13 | Estado | Notas |
|---|---|---|
| 1. Crear marca + thresholds derivados | ✅ | `POST /api/brands` y `scripts/seed.ts` |
| 2. Thresholds Cronus ±1% | ⚠️ | Ver [Discrepancia del PRD](#discrepancia-del-prd) |
| 3. Ingesta CSV → DB sin errores | ✅ | Upsert seguro en `ads`/`adsets`/`ad_daily_stats` |
| 4. Clasificar fixtures (SK28_C, 12_C, ADS-SK-003, HOOK 3) | ✅* | Ver nota HOOK 3 |
| 5. UI con acciones agrupadas | ✅ | Dashboard por marca |
| 6. Análisis creativo vía link | 🔶 | Endpoint listo, extracción de frames debe hacerse en el cliente |
| 7. Análisis creativo vía upload | 🔶 | Idem — frames pre-extraídos en cliente |
| 8. Export contexto.md | ✅ | `src/lib/pipeline/context-md.ts` |
| 9. Permisos por owner | ✅ | `middleware.ts` + queries filtradas |
| 10. Tests motor 100% pass | ✅ | 46/46, 100% coverage en clasificadores |

\*HOOK 3: bajo la fórmula §5.2 real, $60.91 < test_threshold ($66.15) → INCONCLUSO en vez de LOSER. Test ajustado; decidir en v1.1 del PRD.

### Discrepancia del PRD

El PRD §13 afirma que los inputs Cronus producen `test_threshold_usd ≈ 56.96` y `cac_breakeven_usd ≈ 58.07`. La fórmula textual de §5.2 (que es la que está implementada) produce con esos mismos inputs:

```
cac_target_usd     = 33.08
test_threshold_usd = 66.15   (2× CAC target)
cac_breakeven_usd  = 47.63   (AOV - ops_costs, convertido a USD)
```

Probé varias reinterpretaciones (margen sobre ganancia, sobre COGS, con IVA, con retornos del ~7% de AOV) y no encontré una fórmula única que produzca los tres números esperados a partir de los inputs dados. **Las fórmulas implementadas son las de §5.2**; los números "esperados" de §13 no se derivan de esos inputs. Hay que decidir en v1.1 del PRD:

1. Ajustar los inputs Cronus en §13 para que coincidan con la fórmula, o
2. Cambiar la fórmula (probablemente: margen como % sobre margen de contribución, o agregar un fee adicional ~7%), o
3. Aceptar los números actuales como la verdad operativa.

Hasta entonces, los tests y la UI usan los valores derivados de §5.2 (33.08 / 66.15 / 47.63 para Cronus).

---

## Stack

- **Next.js 14** (App Router) · **TypeScript estricto** · **Tailwind CSS**
- **Drizzle ORM** + **Turso** (libSQL distribuido, compatible SQLite)
- **Clerk** para auth (email magic link)
- **Cloudflare R2** (S3-compatible) para videos creativos
- **Anthropic SDK** (Claude Sonnet 4) para análisis creativo multimodal
- **Jest** + `ts-jest` para tests del motor

---

## Setup local

### 1. Prerequisitos

- Node.js ≥ 20
- npm ≥ 9
- Cuenta de **Turso** (para libSQL) — o usa un archivo `local.db` para dev
- Cuenta de **Clerk** con proyecto creado
- Cuenta de **Anthropic** con API key
- Cuenta de **Cloudflare R2** con bucket creado

### 2. Instalación

```bash
git clone <repo>
cd ecomgenius-ads-os
npm install
cp .env.example .env
# edita .env con tus credenciales
```

### 3. DB

Genera migraciones y aplícalas:

```bash
npm run db:generate   # genera SQL en ./drizzle
npm run db:migrate    # aplica a Turso
npm run db:seed       # inserta marcas Feel Ink + Skinglow
```

Para seed necesitas `SEED_OWNER_ID` en `.env` — el `user_id` de Clerk de Eduardo (formato `user_xxx`).

### 4. Dev server

```bash
npm run dev
# http://localhost:3000
```

### 5. Tests

```bash
npm test                 # todos los tests
npm test -- --coverage   # con cobertura
npm run typecheck        # verificación TS estricta
```

---

## Arquitectura

```
src/
├── app/                        Next.js App Router
│   ├── [brandSlug]/            Dashboard, Ad detail, Config por marca
│   ├── upload/                 Ingesta CSV (UI)
│   ├── api/                    Route handlers
│   │   ├── brands/             CRUD de marcas
│   │   ├── csv/upload/         Ingesta CSV
│   │   ├── creative-analysis/  Análisis creativo (Claude API)
│   │   └── recommendations/    Lectura de recomendaciones
│   ├── sign-in/, sign-up/      Clerk
│   └── page.tsx                Landing
├── components/
│   ├── ui/                     Button, StatCard, VerdictBadge
│   └── ads/                    RecommendationCard
├── lib/
│   ├── rules-engine/           ⭐ Núcleo — funciones puras + tests
│   │   ├── thresholds.ts       Cálculo de umbrales por marca (§5.2)
│   │   ├── ad-classifier.ts    6 veredictos (§5.3)
│   │   ├── adset-classifier.ts 5 acciones (§5.4)
│   │   ├── recommendations.ts  Unificación (§5.5)
│   │   └── __tests__/          46 tests, 100% coverage de la lógica
│   ├── parsers/
│   │   └── meta-csv.ts         PapaParse + locale tolerance
│   ├── pipeline/
│   │   ├── ingest.ts           CSV → DB → motor → recomendaciones
│   │   └── context-md.ts       Export Auditor-compatible
│   ├── anthropic/
│   │   ├── client.ts           SDK singleton
│   │   └── creative-analyst.ts Prompt §7.3 + parseo JSON
│   ├── db/
│   │   ├── schema.ts           11 tablas + índices §4
│   │   ├── client.ts           Drizzle + Turso
│   │   └── queries/            Lecturas scoped a owner
│   ├── storage/
│   │   └── r2.ts               Upload + signed URLs
│   └── utils/                  cn, logger, id, format
└── middleware.ts               Clerk auth en todas las rutas (excepto públicas)
```

---

## Flujo de ingesta CSV

1. Usuario sube CSV en `/upload` (Meta export con `Día` breakdown).
2. `src/app/api/csv/upload/route.ts` recibe el archivo.
3. `src/lib/parsers/meta-csv.ts` parsea con tolerancia de BOM, EN/ES, DD/MM vs YYYY-MM-DD, formato US vs EU de números.
4. `src/lib/pipeline/ingest.ts`:
   - Upsert adsets y ads por `external_id`.
   - Upsert `ad_daily_stats` (clave incluye breakdowns).
   - Recomputa `adset_daily_stats`.
   - Corre motor de reglas sobre **todos** los ads de la marca (no solo los del CSV — KILLED persiste).
   - Persiste `recommendations` + actualiza `ads.verdict`.
5. La UI redirige al dashboard con las recomendaciones nuevas.

---

## Motor de reglas

Funciones **puras** (sin I/O). Entradas tipadas, salidas tipadas, 100% testeable.

### Veredictos de ad

- **WINNER** — tested, ROAS ≥ min
- **BORDERLINE** — tested, 1.5 ≤ ROAS < min
- **LOSER** — tested sin compras, o tested con ROAS < 1.5
- **PROMISING** — no tested, pero ROAS ≥ min con compras
- **INCONCLUSO** — no tested, sin señal suficiente
- **KILLED** — histórico (una vez KILLED, siempre KILLED)

### Acciones por ad

| Verdict + Burning | Acción |
|---|---|
| LOSER / KILLED | `kill` |
| WINNER (burning) | `rotate` |
| WINNER (no burning) | `iterate` |
| BORDERLINE | `keep` |
| PROMISING / INCONCLUSO | `let_run` |

### Acciones por adset

| Criterio | Acción | Budget |
|---|---|---|
| ROAS < 1.5 con spend > $200 | `PAUSE` | -100% |
| 1.5 ≤ ROAS < min | `TEST_NEW_CREATIVES` | 0 |
| ROAS ≥ min, sustained 5+ días, cuenta OK | `SCALE_UP` | +25% |
| ROAS ≥ min, cuenta < min | `HOLD` | 0 |
| Default | `HOLD` | 0 |

---

## Variables de entorno

Ver `.env.example`. Las críticas:

| Variable | Propósito |
|---|---|
| `TURSO_DATABASE_URL` | libSQL connection string |
| `TURSO_AUTH_TOKEN` | Token Turso |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk front |
| `CLERK_SECRET_KEY` | Clerk back |
| `ANTHROPIC_API_KEY` | Claude API |
| `R2_ACCOUNT_ID` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` | R2 |
| `SEED_OWNER_ID` | `user_id` de Clerk para seed |

---

## Preguntas abiertas del PRD (§14)

Flageadas para resolver en v1.1:

1. ¿El parser debe descartar filas agregadas "Total de cuenta"? **Decisión actual:** sí, se descartan silenciosamente (no tienen `Día` válido o `adset_id`).
2. ¿Soft-delete de marcas? **Decisión actual:** hard delete con CASCADE (el schema tiene `ON DELETE CASCADE`).
3. ¿Kill manual anula veredicto del motor? **Pendiente** — no implementado aún. Sugerencia: agregar campo `ads.manual_override` que el motor respete.
4. ¿`adset_daily_stats` trigger vs recompute? **Decisión actual:** recompute en el pipeline de ingesta (simpler, menos lock contention en libSQL).
5. ¿Re-análisis creativo automático cuando cambia veredicto? **Pendiente** — no implementado. Por ahora solo manual.

---

## Desarrollo

- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Format: usar Prettier default (sin config explícita)

### Añadir un nuevo veredicto / acción

1. Editar `src/lib/rules-engine/types.ts` para agregar el literal.
2. Actualizar `src/lib/rules-engine/ad-classifier.ts` o `adset-classifier.ts`.
3. Actualizar `recommendations.ts` para mapear el nuevo verdict → acción.
4. Agregar tests en `__tests__/`.
5. Actualizar UI en `components/ads/RecommendationCard.tsx` (colores/íconos).
6. Actualizar schema si afecta `recommendations.action`.

---

## Licencia

Interno — EcomGenius. No distribuir.

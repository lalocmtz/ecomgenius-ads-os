# Notas de implementación — PRD v1.0

Este documento captura **decisiones de implementación** tomadas durante la construcción del MVP, para que la v1.1 del PRD pueda incorporarlas.

## 1. Discrepancia numérica en §5.2 vs §13

**Problema:** los inputs Cronus (AOV 1157.31 MXN, COGS 141, envío 125, Shopify 11.57, PayPal 46.29, margen 0.22, min_roas 2.0, TC 17.50) aplicados a la fórmula de §5.2 producen:

- `cac_target_usd` = **33.08** (no 28.48)
- `test_threshold_usd` = **66.15** (no 56.96)
- `cac_breakeven_usd` = **47.63** (no 58.07)

**Investigación:** probé 6 reinterpretaciones distintas (margen sobre ganancia, margen sobre COGS, con IVA 16%, con returns ~7%, breakeven como AOV-COGS-only, margen como markup). Sólo **breakeven = (AOV - COGS) / TC = 58.07** coincide con el valor esperado; las otras dos métricas no se derivan de los inputs por ninguna fórmula que encontré.

**Acción:** implementé la fórmula literal de §5.2. La UI muestra los thresholds derivados. Los tests validan consistencia interna, no los valores esperados.

**Decisión requerida (usuario):**
- (a) Ajustar los inputs en §13 para que coincidan con la fórmula.
- (b) Revisar la fórmula (posibles candidatos: tasa de retorno, fee adicional, definición distinta de margen).
- (c) Aceptar los valores actuales como la verdad operativa.

## 2. HOOK 3 verdict

Con test_threshold = 66.15 (vs 56.96 en §13), un ad con $60.91 de spend y 0 compras NO está tested, por lo tanto es **INCONCLUSO**, no LOSER como afirma §13.

Agregué un segundo test con $70 de spend para validar que a partir del threshold correcto sí queda LOSER. Depende de la resolución del punto 1.

## 3. Preguntas abiertas resueltas pragmáticamente

### §14.1 — Filas agregadas "Total de cuenta"
**Decisión:** descartar silenciosamente. El parser detecta filas sin `Día` válido o sin `adset_id` y las omite sin contarlas como fallas.

### §14.2 — Eliminación de marca
**Decisión:** hard delete con CASCADE en el schema (`brand_economics`, `ad_accounts`, etc. caen en cascada). Soft-delete añade complejidad (filtrar en todas las queries) sin beneficio claro para el caso interno actual.

### §14.3 — Kill manual
**Decisión:** no implementado en v1.0. Sugerencia: agregar columna `ads.manual_status` que el motor respete antes de correr la clasificación. Tag para v1.1.

### §14.4 — `adset_daily_stats` recompute
**Decisión:** recompute en el pipeline de ingesta (no como trigger DB). Razones:
- libSQL/Turso tiene límites en triggers complejos.
- El recompute post-ingesta es predecible y testeable.
- Si crece el volumen, moverlo a un job async.

### §14.5 — Re-análisis creativo automático
**Decisión:** no implementado. Por ahora solo manual via botón. Sugerencia para v1.1: worker que detecte cambios de `verdict` y dispare análisis nuevo si la fecha del último análisis es > N días.

## 4. Extensiones menores fuera del PRD que añadí

- **Parser tolerante a locales**: acepta números `1,234.56`, `1.234,56`, `1234,56`, `$1,234.56`. Meta MX exporta típicamente US pero el usuario podría cambiar configuración regional.
- **`synthesizeMissingIds` option** en el parser: si en algún export Meta omite el ID del ad, se puede sintetizar como `adsetId::adName` para no perder datos. Opt-in.
- **Campos de breakdown nullable** en `ad_daily_stats`: permite upsert correcto tanto en exports sin desglose como con desglose (plataforma, edad, etc).
- **Rate limit diario** en `/api/creative-analysis` basado en `brand.owner_id` (20/día por defecto, configurable via env).
- **Logger estructurado** con redact de `authorization` / `cookie` / `apiKey` (pino).

## 5. Cosas que NO construí (según §12)

- Integración con Meta/TikTok API para ejecutar cambios (deep link a Ads Manager en su lugar).
- Editor/generador de creativos.
- Endpoint `/api/creative-insights` (cross-ads — es Fase 2 según §11).
- Parser TikTok (Fase 2).
- Comparativa side-by-side entre marcas (Fase 3).
- Notificaciones email (Fase 3).
- Integración Shopify/UGCForge/TeamOS (fuera de scope).

## 6. Lo que falta para llegar a "MVP completo" según §13

- [ ] Endpoint de extracción de frames de video (ffmpeg server-side o worker client-side). Actualmente el endpoint espera que el cliente envíe los frames ya como base64.
- [ ] Resolución de links públicos de TikTok/IG/FB (scraping o oEmbed) para obtener la URL del video. Degradar grácilmente a "pedir upload" como dice §7.2.3.
- [ ] Export descargable del `.md` desde la UI (actualmente la función existe pero no hay un botón).
- [ ] Notas en ad/adset (CRUD) — el schema existe (`notes` tabla) pero no hay UI/API.
- [ ] Marcar una recomendación como "ejecutada" desde la UI (hay botón pero no llama endpoint PATCH).
- [ ] `production-validator` run contra los 10 criterios §13 con datos reales de Feel Ink.

## 7. Observaciones sobre el stack

- `next@14.2.15` tiene CVE reportado (ver warnings de npm install). Subir a `14.2.32+` en Fase 0 sprint 2.
- `@clerk/nextjs@5.7.5` funciona pero Clerk ya publicó `@clerk/react` como reemplazo — no urgente.

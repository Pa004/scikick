# Plataforma de Predicción Deportiva con IA/ML — Análisis y Prompt para OpenCode

## 1. Encuadre del problema

Lo que describes no es "una casa de apuestas" sino un **sistema de estimación de probabilidades** (probability estimation engine) sobre resultados deportivos. Eso es clave porque cambia el objetivo de optimización:

- No buscas maximizar accuracy (¿acertó o no?).
- Buscas **probabilidades bien calibradas** (si el modelo dice 70%, ese resultado debe ocurrir ~70% de las veces en la práctica).

Esto es un matiz que mucha gente omite y termina construyendo un clasificador cuando en realidad necesita un **estimador probabilístico calibrado**. Todo el pipeline (métricas, validación, evaluación) debe girar en torno a esto.

Tipo de problema: clasificación multiclase (1X2: local/empate/visitante) o modelado conjunto de goles (para fútbol), con salida en probabilidades, no en etiquetas duras.

---

## 2. Análisis de modelos candidatos

| Enfoque | Cuándo usarlo | Ventajas | Desventajas |
|---|---|---|---|
| **Regresión de Poisson / Dixon-Coles** | Deportes de bajo scoring (fútbol) | Interpretable, modela el marcador completo (no solo 1X2), estándar de la industria (goles = variable de Poisson) | Asume independencia de goles (Dixon-Coles corrige esto), no captura relaciones no lineales complejas |
| **Elo / Glicko-2** | Rating dinámico de equipos | Simple, se actualiza partido a partido, buena feature de entrada para otros modelos | Por sí solo es débil, no usa contexto (lesiones, localía, forma) |
| **Regresión logística** | Baseline sólido para 1X2 | Muy bien calibrada de forma nativa, rápida, interpretable | Techo de rendimiento bajo si hay relaciones no lineales fuertes |
| **Gradient Boosting (LightGBM/XGBoost/CatBoost)** | Modelo principal recomendado | Excelente en datos tabulares, corre muy bien en CPU (tu laptop no necesita GPU aquí), soporta miles de features, permite SHAP para explicabilidad | Requiere calibración posterior (no sale calibrado de fábrica), riesgo de overfitting con pocos datos históricos |
| **Redes neuronales (MLP/tabular transformers)** | Solo si tienes datos masivos | Puede capturar interacciones complejas | Con tu hardware (CPU-only, 16GB RAM) y datasets deportivos típicos (miles, no millones de filas), casi seguro **no** superará a un buen LightGBM; overkill |
| **Ensamble (blend Poisson/Dixon-Coles + Gradient Boosting)** | Producción | Combina fuerza estadística clásica + señales contextuales de ML | Más complejidad de mantenimiento |

**Recomendación concreta:** LightGBM (o CatBoost si hay muchas variables categóricas) como modelo principal para 1X2, con Dixon-Coles como modelo paralelo para prob. de marcador exacto/over-under. **Decisión de blend (sin dejarlo abierto):** promedio ponderado simple para el MVP — menos piezas móviles, más fácil de depurar y de explicar por qué una predicción salió como salió. Stacking con regresión logística queda como mejora de Fase posterior, solo si el promedio ponderado no calibra bien tras la evaluación inicial. Esto es compatible con tu hardware — nada de esto requiere GPU.

---

## 2.1. Extensión a mercados múltiples (más allá de 1X2)

Sí es viable — es un patrón estándar en la industria (research papers y productos comerciales lo llaman "multi-market prediction"). Pero el punto clave que hay que dejar explícito desde el diseño: **esto no es "un modelo que predice más cosas", es un cambio de arquitectura de un modelo único a un catálogo de modelos especializados**, algunos de los cuales comparten features de entrada y otros necesitan datos completamente distintos. Conviene separar los mercados en tres grupos según su costo real de implementación:

**Grupo A — se derivan gratis del mismo modelo de goles (sin entrenar nada nuevo)**

Si el modelo principal es Dixon-Coles (o cualquier modelo Poisson bivariado), no solo te da 1X2: te da una **matriz completa de probabilidad de marcador** P(local anota i, visitante anota j) para todas las combinaciones razonables de goles. De esa única matriz se derivan matemáticamente, sin entrenar modelos adicionales:
- 1X2 (suma de celdas donde i>j, i=j, i<j)
- Doble oportunidad (1X + X2 + 12, combinaciones de lo anterior)
- Over/Under de goles (suma de celdas según i+j)
- Ambos equipos marcan (BTTS) (suma de celdas donde i>0 y j>0)
- Hándicap asiático/europeo (desplazar la matriz por la línea de hándicap y sumar)
- Marcador exacto

Esto es la parte más eficiente de todo el proyecto: un solo modelo bien calibrado alimenta ~6 mercados distintos con matemática, no con entrenamiento adicional.

**Grupo B — necesitan un modelo propio, pero con las mismas features base**

- **Córners** — no correlaciona linealmente con goles ni con quién gana; depende de estilo de juego (equipos que centran mucho, presión alta, contragolpe vs. posesión). Requiere su propia variable objetivo (conteo de córners por equipo) y típicamente se modela también como Poisson (córners también se comportan como conteos) o con LightGBM en modo regresión/clasificación sobre umbrales (over/under 8.5, 9.5, etc.). Reutiliza gran parte del feature set de forma/Elo, pero necesita agregar historial de córners como feature de entrada, que no todas las fuentes gratuitas dan (ver más abajo).
- **Tarjetas** — similar a córners en enfoque (conteo, Poisson o clasificación por umbral), pero las features relevantes son distintas: tendencia del árbitro asignado (si tienes ese dato), rivalidad/derbi, importancia del partido, historial disciplinario de cada equipo. Es el mercado más ruidoso de los tres grupos porque depende mucho de decisiones arbitrales, que son difíciles de predecir con datos históricos de equipo.
- **Mercados de primera mitad (HT/FT, over/under 1T, BTTS 1T)** — técnicamente puedes replicar el mismo enfoque Dixon-Coles pero entrenado *solo con goles de primera mitad* como variable objetivo separada. Requiere que tu fuente de datos traiga el desglose HT/FT (football-data.co.uk sí lo incluye: columnas de marcador al medio tiempo), y from ahí es el mismo patrón del Grupo A pero con su propia matriz de probabilidad.

**Grupo C — cambia la granularidad del problema por completo**

- **Goleador (anytime/primer goleador)** — este es el que más se aleja de todo lo anterior: deja de ser un problema a nivel de partido/equipo y pasa a ser un problema **a nivel de jugador**. Necesitas: minutos jugados históricos, tasa de goles por 90 minutos, xG individual (Understat lo da a nivel jugador), posición en el campo, si es titular confirmado o no (esto solo se sabe horas antes del partido con el line-up oficial). El modelo típico es una tasa de Poisson individual por jugador (goles esperados = xG90 del jugador × minutos esperados a jugar), no un clasificador de equipo. Es el mercado con mayor esfuerzo de implementación de los que mencionas, porque cambia la tabla de features de "una fila por partido" a "una fila por jugador por partido".

**Implicación en datos (conecta con la sección 3.1):**
- Córners y tarjetas: football-data.co.uk ya incluye columnas de córners (HC/AC) y tarjetas (HY/AY/HR/AR) por partido en su CSV histórico — no necesitas una fuente adicional para el histórico, solo para fixtures futuros (API-Football también expone estadísticas de partido a ese nivel de detalle en ligas top).
- Primera mitad: football-data.co.uk incluye el marcador de medio tiempo (HTHG/HTAG) — igual, ya cubierto por la fuente principal.
- Goleador: necesitas datos a nivel jugador (Understat te da xG por jugador; API-Football te da lineups/alineaciones confirmadas, clave porque no puedes predecir goleador sin saber quién es titular).

**Implicación en arquitectura:** el servicio de inferencia deja de tener un solo endpoint `/predict` que devuelve un JSON fijo, y pasa a ser más parecido a un catálogo: `/predict/1x2`, `/predict/goals` (de donde derivas BTTS/O-U/hándicap), `/predict/corners`, `/predict/cards`, `/predict/first-half`, `/predict/scorer`. Cada uno con su propio pipeline de entrenamiento, su propia calibración y sus propias métricas de evaluación — pero todos pueden vivir en el mismo servicio FastAPI, compartiendo la capa de feature engineering base (Elo, forma, xG) donde aplique.

**Recomendación de fasificación (para no inflar el alcance del MVP):**
1. **Fase 1:** 1X2 + todo el Grupo A (doble oportunidad, O/U, BTTS, hándicap, marcador exacto) — todo sale del mismo modelo Dixon-Coles/Poisson bivariado. Esto ya te da la mayoría de los mercados que ofrece Ecuabet con el menor esfuerzo posible.
2. **Fase 2:** Córners, tarjetas y primera mitad (Grupo B) — mismos datos ya disponibles en football-data.co.uk, requiere entrenar 3-4 modelos adicionales pero con el pipeline ya construido en Fase 1.
3. **Fase 3 (la más compleja, dejar para el final):** Goleador (Grupo C) — requiere rediseñar el esquema de datos a nivel jugador, una fuente adicional confiable de lineups confirmados, y su propio pipeline de entrenamiento independiente.

Esta fasificación evita el error común de intentar construir los 10+ mercados simultáneamente desde el día uno, lo cual generalmente termina en un pipeline de datos frágil y modelos mal calibrados en todos los mercados a la vez, en vez de tener 1X2 sólido primero.

## 2.2. Taxonomía completa de mercados de Ecuabet (~150 opciones analizadas)

El listado real de mercados de Ecuabet para un partido (~150 opciones, provisto directamente por Pablo desde la app) parece implicar ~150 problemas de predicción distintos, pero **en realidad se reducen a 4 motores estadísticos subyacentes**, más un grupo de mercados "combinados" que no son modelos nuevos. Este es el hallazgo clave que evita sobre-ingeniería: no hay que construir un modelo por cada opción del menú.

**Motor 1 — Matriz de marcador a partido completo** (ya es la Fase 1 del prompt, sección 2.1 Grupo A)
Cubre directamente: 1x2, Total, Doble oportunidad, Ambos equipos marcan, Pronóstico sin empate, Handicap, Handicap 1X2, Marcador exacto, Marcador exacto XL, Margen de victoria, total de goles por equipo, N° de goles exactos por equipo, Goles exactos, Par/Impar (global y por equipo), Multigoles (global y por equipo), Qué equipo marca, "equipo sin pronóstico", team marcará, team gana a cero, Cualquier equipo gana, Portería a cero por equipo. **~25 mercados, cero modelos adicionales** — es matemática sobre la misma matriz P(local=i, visitante=j).

**Motor 2 — Matriz de marcador por mitad** (Fase 2 del prompt, extiende el Grupo B de la sección 2.1)
Cubre todos los mercados prefijados "1ª Mitad -" y "2ª Mitad -" que repiten los conceptos del Motor 1 restringidos a una mitad (1x2, doble oportunidad, total, BTTS, par/impar, marcador exacto, handicap, handicap 1X2, primer gol, pronóstico sin empate, portería a cero, multigoles, goles exactos — cada uno por mitad), más: Mitad/Final (resultado HT/FT combinado), Mitad/Final marcador exacto, Doble oportunidad 1ª mitad / Doble oportunidad partido, 1X2 1ª mitad / Doble oportunidad partido, Doble oportunidad 1ª mitad / 1X2 partido, team gana ambas/cualquier mitad, team marca en ambos tiempos, Ambas mitades más/menos de 0.5/1.5/2.5, team mitad de mayor marcador. **~45 mercados.** Requiere modelar 1ª y 2ª mitad como distribuciones correlacionadas (el resultado del entretiempo cambia el estilo de juego del segundo tiempo — no son independientes).

**Motor 3 — Simulación de eventos en el tiempo (fuera de alcance por ahora)**
Mercados como Primer gol, Último gol, Último gol de 1ª/2ª Mitad, Intervalo con más goles, team liderará durante el partido, ambos equipos liderarán, team remontará y ganará, team marcará 2/3 goles consecutivos, Escala de goles, Primer tipo de puntuación — dependen de *cuándo* ocurre cada gol, no solo de cuántos hay en total, y requerirían un motor de simulación Monte Carlo del partido (procesos de Poisson no homogéneos en el tiempo) más datos históricos de eventos con marca de tiempo exacta, que **football-data.co.uk no provee** (habría que evaluar API-Football Pro u otra fuente paga). Queda descartado del alcance actual — se retoma más adelante si el resto del sistema está sólido y se justifica el esfuerzo/costo adicional. **~20 mercados quedan sin cubrir por ahora.**

**Motor 4 — Eventos raros binarios**
Penalti en el encuentro, Gol en propia meta. Modelos simples de tasa histórica por equipo (Poisson/logística sobre historial). **~2 mercados, esfuerzo trivial.**

**No-motor — Mercados combinados ("X y Y")**
Todo lo que combina dos condiciones en una sola selección: 1x2 y total, 1x2 y BTTS, Total y BTTS, Primer gol y 1x2, Doble oportunidad y total 1.5/2.5/3.5/4.5/5.5, Doble oportunidad y BTTS, Mitad/Final y total 1.5-6.5, Mitad/Final y 1ª mitad total 1.5/2.5/3.5, Mitad/Final y goles exactos, 1ª/2ª mitad ambos equipos marcan, Doble oportunidad (partido) y BTTS 1ª/2ª mitad, team o más de 3.5 / Empate o más de 3.5 / team o menos de 3.5, team o BTTS / Empate o BTTS, team o portería a cero / Empate o en blanco, 1x2 (partido) & 2ª mitad BTTS, 1x2 (partido) & 1er tiempo BTTS — **~40 mercados, no son modelos nuevos, son probabilidades conjuntas.** Los que combinan solo condiciones del Motor 1/2 (ej. Doble oportunidad y total de goles, Mitad/Final y total) sí se pueden implementar ahora leyendo la probabilidad conjunta de la matriz de marcador ya calculada, sin depender del Motor 3. Los que involucran timing (ej. Primer gol y 1x2) quedan bloqueados hasta que el Motor 3 esté disponible. Importante en ambos casos: no se pueden derivar multiplicando probabilidades marginales de mercados por separado (P(A)×P(B)), porque estos eventos están correlacionados — deben leerse de la distribución conjunta, no de una combinación ingenua.

**Fuera de este listado, pero relevante si se expande más adelante:**
- **Mercados en vivo (in-play):** ninguno de los ~150 mercados analizados aquí es "en vivo" — todos son pre-partido. Si en el futuro quisieras un mercado tipo "próximo gol" recalculado durante el partido, eso es un eje de arquitectura completamente distinto (ingesta en tiempo real, modelo re-ejecutándose cada pocos segundos con el estado actual del partido como input). Dado el alcance de portafolio/personal del proyecto, se recomienda dejarlo explícitamente fuera de alcance.
- **Goleador por jugador:** no aparece en el listado de mercados de partido que compartiste (suele vivir en una pestaña separada de "goleadores" en Ecuabet). Sigue siendo el Grupo C descrito en la sección 2.1 si se decide incluirlo más adelante.

**Ajuste de fasificación (reemplaza la fasificación simple de la sección 2.1):**
1. **Fase 1:** Motor 1 completo (1x2 + ~25 mercados derivados). Fuente de datos: football-data.co.uk, gratis.
2. **Fase 2:** Motor 2 (mitades) + córners/tarjetas del Grupo B original de la sección 2.1, + mercados combinados que solo dependen de los Motores 1/2. Misma fuente de datos, ya incluye HT score, córners y tarjetas.
3. **Fase 3:** Motor 4 (eventos raros) + goleador por jugador (Grupo C de la sección 2.1), si se decide incluirlo.
4. **Descartado por ahora:** Motor 3 (simulación de eventos en el tiempo) y los mercados combinados que dependen de él (~20 + una porción de los ~40 combinados). Se retoma solo si se justifica el esfuerzo/costo de datos adicional más adelante.

---

## 3. Aspectos que sueles omitir en este tipo de proyecto (y que aquí cubro)

1. **Fuga temporal de datos (data leakage):** el split train/test NUNCA debe ser aleatorio. Debe ser walk-forward / rolling origin (entrenar con el pasado, validar con el futuro cronológico). Es el error #1 en proyectos de predicción deportiva.
2. **Calibración, no solo accuracy:** usar Brier Score, Log Loss y curvas de calibración (reliability diagrams). Aplicar Platt scaling o isotonic regression sobre la salida del modelo.
3. **Comparación contra el mercado (odds implícitas):** aunque no vayas a operar apuestas, comparar tu probabilidad estimada vs. la probabilidad implícita de las cuotas públicas es el benchmark más honesto de qué tan bueno es tu modelo (el mercado es difícil de vencer).
4. **Desbalance de clases:** los empates son sistemáticamente menos frecuentes — hay que vigilar esto en las métricas por clase, no solo el agregado.
5. **Incertidumbre / intervalos de confianza:** no basta con dar "63%", conviene mostrar también qué tan confiable es esa estimación (p. ej. tamaño de muestra histórica del escenario).
6. **Explicabilidad:** SHAP values para que cada predicción tenga un "por qué" (forma reciente, localía, lesiones, etc.) — esto le da valor real al producto.
7. **Origen y licencia de los datos:** define desde ya de dónde saldrán los datos históricos (API-Football, Understat, football-data.co.uk, etc.) y revisa términos de uso — muchas fuentes de cuotas no permiten scraping comercial.
8. **MLOps mínimo viable:** versionado de modelos y de datasets con carpetas versionadas + un `metrics.json` por versión (decisión tomada en la sección 5: sin MLflow, es overhead innecesario para un solo desarrollador y un modelo principal — ver sección 5 para el detalle), para poder comparar reentrenamientos.
9. **Reentrenamiento y drift:** los equipos cambian de plantilla, forma, entrenador — define una cadencia de reentrenamiento (p. ej. semanal) y una alerta simple si el log loss se degrada.
10. **Testing más allá de "funciona":** además de tests de código (unit/integration), necesitas *tests de validez del modelo* (dataset dorado con resultados conocidos, tests de no-leakage, tests de rango de probabilidades que sumen 1, etc.).
11. **Aspecto legal/ético:** aunque el alcance es solo estimación de probabilidades (no gestión de apuestas ni de usuarios), conviene dejar explícito en el producto que es una herramienta analítica/educativa y no una recomendación de apuesta, para evitar ambigüedad regulatoria en Ecuador u otros países.
12. **Alcance reducido = ventaja:** como no manejarás usuarios ni transacciones, te ahorras auth de usuarios, pagos, KYC — enfócate 100% en la calidad del pipeline de datos y del modelo. (Sí hay un token simple para proteger el endpoint de escritura `/api/refresh` — no es auth de usuarios, es protección de un único endpoint de servicio.)

---

## 3.1. Fuentes de datos recomendadas (verificado agosto 2026)

Este espacio cambia con frecuencia (tiers gratuitos, pricing, disponibilidad), así que lo siguiente está verificado a la fecha, no solo basado en conocimiento previo.

**Resultados/fixtures históricos**
- **football-data.co.uk** (recomendado como fuente principal): dataset público en CSV, gratuito, sin API key. Cubre 20+ ligas europeas con resultados de tiempo completo/medio tiempo **y cuotas de apuestas de 15+ casas en el mismo archivo** — resuelve entrenamiento histórico y benchmark de calibración contra el mercado a la vez. Se actualiza a los pocos días de cada jornada. Provisto explícitamente para descarga pública gratuita (sin fricción legal).
- **API-Football** (api-sports.io / RapidAPI): free tier de 100 requests/día, cubre 1,236 ligas, útil para traer fixtures próximos en producción (no para descargar todo el histórico, la quota no alcanza). Ojo: las respuestas sin cobertura devuelven array vacío con status 200, hay que validar el cuerpo de la respuesta, no solo el status code. Plan Pro en $19/mes si necesitas más volumen (7,500 req/día).
- **football-data.org**: alternativa más limitada — 12 ligas principales, 10 req/min, gratis. Útil si football-data.co.uk no cubre la liga que necesitas, pero no da estadísticas de jugadores ni marcadores en vivo en el tier gratuito.

**Expected Goals (xG) y estadísticas avanzadas**
- **Understat**: la mejor fuente gratuita de xG para fútbol europeo (Premier League, La Liga, Bundesliga, Serie A, Ligue 1, RFPL, datos desde 2014/15). **Riesgo real a aceptar:** no tiene API oficial, es scraping de HTML — sin protección anti-bot agresiva (a diferencia de FBref, que está detrás de Cloudflare y exige scraping con navegador), pero cualquier cambio de estructura HTML del sitio rompe la ingesta sin aviso previo. Por eso xG debe tratarse como **feature opcional/nullable** en el pipeline: si el scraping falla, el modelo sigue funcionando sin xG (con degradación de calidad, no con caída del sistema) — nunca como dependencia dura del pipeline.

**Cálculo real de presupuesto de API-Football (free tier)**
El endpoint de fixtures por jornada/rango de fechas devuelve varios partidos en una sola llamada (no es 1 request por partido) — traer la próxima jornada de las 5 ligas Tier 1 cuesta ~5-6 requests, no ~50. Donde sí se dispara el consumo es en **estadísticas o alineaciones por partido individual** (eso sí es 1 request por fixture) — pero ese detalle solo se necesita para el mercado de goleador (Grupo C, Fase 3), fuera del alcance actual. Para Fase 1-2 (fixtures + resultados para resolver `tracked`), el presupuesto de 100 req/día es holgado; si más adelante se agrega LigaPro Ecuador y/o estadísticas por partido, hay que recalcular explícitamente antes de asumir que "alcanza".

**Fallback si football-data.co.uk deja de estar disponible o cambia de formato**
No hay una fuente equivalente gratuita que combine resultados+cuotas+córners+tarjetas en un solo archivo — por eso el módulo de ingesta debe **validar la presencia de las columnas esperadas antes de procesar cualquier CSV nuevo** (falla ruidosamente y detiene el sync si faltan columnas, en vez de continuar con datos parciales silenciosos). Si la fuente deja de estar disponible por completo, el fallback documentado es degradar a **solo resultados** vía API-Football/ESPN (sin benchmark de cuotas ni córners/tarjetas) hasta resolver manualmente.

**Cuotas de mercado en tiempo real (opcional, no crítico para el alcance actual)**
- **The Odds API**: free tier limitado a NBA/MLB (no cubre fútbol en el tier gratuito), Professional $29/mes, Business $99/mes con cuotas históricas incluidas. Dado que football-data.co.uk ya trae cuotas históricas gratis, esto solo se justificaría si más adelante quieres cuotas de mercado en tiempo real para partidos por venir.

**Recomendación concreta para el alcance del proyecto (sin presupuesto de producción):**
1. Entrenamiento/histórico → football-data.co.uk (resultados + cuotas) + Understat (xG vía scraping respetuoso, con throttling).
2. Predicciones sobre próximos partidos → API-Football free tier (100 req/día alcanza si solo consultas la próxima jornada, no todo el histórico).
3. Cuotas de mercado en tiempo real → solo evaluar The Odds API más adelante si el proyecto crece, ya que para fútbol requiere plan pago.

---

## 3.2. Cobertura de ligas: qué ofrece Ecuabet vs. dónde hay datos reales disponibles

Ecuabet no publica un catálogo estático de ligas — como la mayoría de casas de apuestas, el listado completo vive dentro de un feed de cuotas en vivo de un proveedor externo (típico de plataformas de este tipo: cientos de ligas, desde las top hasta divisiones menores), no es contenido indexable. Lo que sí se confirma desde sus propias páginas es que cubren la Serie A/LigaPro de Ecuador, la Premier League, La Liga y varias ligas internacionales de primer nivel, además de ligas de menor perfil.

Dado eso, la pregunta útil no es "qué ligas tiene Ecuabet" (un catálogo imposible de igualar), sino la inversa: **de las ligas que con certeza tienen, ¿en cuáles hay datos históricos de calidad gratuita?** Ese cruce determina el alcance real y ordenado del proyecto:

| Nivel | Ligas | Datos disponibles gratis |
|---|---|---|
| **Tier 1 — stack completo** | Premier League (Inglaterra), La Liga (España), Bundesliga (Alemania), Serie A (Italia), Ligue 1 (Francia) | football-data.co.uk (resultados + cuotas históricas + córners + tarjetas + marcador HT) **+** Understat (xG). El único set con datos suficientes para los Motores 1 y 2 completos con buena calidad. |
| **Tier 2 — resultados + cuotas, sin xG** | Championship y divisiones inferiores de Inglaterra, 4 divisiones de Escocia, Bundesliga 2, Serie B (Italia), La Liga 2, Ligue 2, Eredivisie (Países Bajos), Jupiler Pro League (Bélgica), Primeira Liga (Portugal), Süper Lig (Turquía), Super League (Grecia) | football-data.co.uk sí las cubre (resultados, cuotas, córners, tarjetas), pero Understat no da xG para estas — modelos algo menos ricos, siguen siendo viables. |
| **Tier 3 — solo resultados básicos** | Argentina, Austria, Brasil, China, Dinamarca, Finlandia, Irlanda, Japón, México, Noruega, Polonia, Rumania, Rusia, Suecia, Suiza, MLS (EE.UU.) | football-data.co.uk las agrega en una sección con menos columnas — verificar caso por caso si trae cuotas/córners/tarjetas antes de asumir cobertura completa. |
| **Tier 4 — sin fuente gratuita confiable** | **LigaPro Ecuador** y la mayoría de ligas sudamericanas/menores que Ecuabet ofrece | Ninguna de las fuentes recomendadas (football-data.co.uk, Understat) las cubre. |

**Punto importante sobre LigaPro Ecuador (Tier 4):** probablemente la liga más relevante para el mercado local de Ecuabet, pero no cubierta por football-data.co.uk ni Understat. El prototipo ya sincroniza desde ESPN, y la API no documentada de ESPN (`site.api.espn.com`) sí tiene cobertura de LigaPro Ecuador (slug `ecu.1`) y de un rango amplio de ligas globales — eso resuelve fixtures/resultados. Lo que **no** resuelve: cuotas de mercado históricas (benchmark de calibración) ni xG (feature de calidad) para esta liga vía fuentes gratuitas. El modelo sobre LigaPro será estructuralmente más débil que uno de Tier 1 — menos features, sin forma barata de validar contra el mercado — y eso debe quedar documentado explícitamente en el dashboard para no dar una falsa sensación de confianza uniforme entre ligas.

**Recomendación de alcance por fases:**
1. Construir y validar el pipeline completo (Fase 1-2 del prompt) sobre **Tier 1** primero — mejor feature set, mejor forma de demostrar calidad de calibración.
2. Extender a **Tier 2** una vez el pipeline esté probado — mismo esfuerzo de datos, solo sin xG.
3. **LigaPro Ecuador** entra como caso aparte con expectativas de calidad distintas, no como "una liga más" del mismo nivel que el Tier 1.

---

## 3.3. Aspectos operativos adicionales (todos abordables sin costo)

Estos son problemas que no aparecen hasta que ya estás construyendo, pero que conviene prevenir desde el diseño en vez de parchear después. Los seis se resuelven con trabajo de ingeniería, no con herramientas de pago.

**1. Resolución de identidad entre fuentes**
Football-data.co.uk, Understat, API-Football y ESPN nombran al mismo equipo de forma distinta ("Man United" vs "Manchester United" vs "Man Utd") y usan IDs internos distintos. Sin un mapeo explícito, los joins entre fuentes se rompen silenciosamente — el modelo entrena mal sin ningún error visible.
*Abordaje gratuito:* una tabla `team_aliases` en tu SQLite (`canonical_team_id`, `source`, `source_name`/`source_id`) construida una sola vez por liga (son un puñado de equipos por temporada) y mantenida a mano o con un script de fuzzy matching (`rapidfuzz`, librería Python gratuita) que solo *sugiere* candidatos — la confirmación final la haces tú, nunca automática, para evitar falsos positivos silenciosos.

**2. Cold start: equipos recién ascendidos y LigaPro Ecuador**
Elo y "forma reciente" asumen historial previo en la liga top. Un ascendido no lo tiene — sin una regla explícita de inicialización, las predicciones para ese equipo son erráticas las primeras jornadas.
*Abordaje gratuito:* regla determinista y documentada en el código, sin necesidad de datos externos — por ejemplo, Elo inicial de un ascendido = promedio del Elo final de los equipos descendidos la temporada anterior (o, a falta de eso, el percentil 10 de la liga). Mismo criterio para LigaPro Ecuador si el histórico local es corto: iniciar en el promedio de la liga en vez de en un valor neutro arbitrario.

**3. Copa vs. liga — el modelo asume la estructura equivocada para algunas competiciones**
Dixon-Coles, Elo y ventaja de localía están pensados para formato liga (round-robin). Copas de eliminación directa (Champions League, Copa Libertadores) rompen esos supuestos: cancha neutral, alineaciones rotadas, definición por penales.
*Abordaje gratuito:* agregar `competition_type` (liga/copa/copa-neutral) como feature categórica explícita desde el inicio del esquema, y considerar entrenar el modelo de copas por separado una vez tengas suficiente volumen — no requiere datos adicionales, football-data.co.uk y ESPN ya indican la competición de cada partido.

**4. Training-serving skew**
Si el cálculo de features en el pipeline de entrenamiento y en el endpoint de inferencia no comparten el mismo código, divergen con el tiempo sin que nadie lo note, y el modelo en producción termina viendo features distintas a las de entrenamiento.
*Abordaje gratuito:* un único módulo Python de feature engineering (ej. `features/build_features.py`) importado tanto por el script de entrenamiento como por el servicio FastAPI — nunca dos implementaciones paralelas de "Elo actual del equipo X". Es una decisión de estructura de carpetas, no una herramienta nueva.

**5. Zonas horarias**
Ecuador está en GMT-5; las fuentes de datos vienen en UTC o en el huso horario del país de la liga. Sin normalización cuidadosa, el bucketing de "última jornada" / "próximos partidos" del cron y del endpoint `/api/fixtures` puede desplazar partidos un día.
*Abordaje gratuito:* almacenar **siempre** timestamps en UTC en SQLite (columna `TEXT` en formato ISO 8601), y convertir a hora local solo en la capa de presentación (frontend), nunca en la lógica de negocio ni en las queries de agregación. Es una convención de diseño, cero costo — solo disciplina de no mezclar zonas horarias en el mismo campo.

**6. Nota de branding**
El proyecto se inspira explícitamente en Ecuabet. Está bien como referencia en documentación o conversación, pero si en algún momento se comparte públicamente (portafolio, GitHub), evitar usar el nombre/marca de Ecuabet como nombre del proyecto o en el UI, para no generar confusión de marca. Sin costo, solo elegir un nombre propio para la plataforma.

---

## 3.4. Aspectos operativos adicionales (segunda ronda)

**1. Cambios de plantilla dentro de temporada (fichajes)**
Elo y "forma reciente" asumen que la fuerza del equipo es relativamente estable, pero un equipo que vende a su jugador clave en la ventana de enero es, en la práctica, un equipo distinto al que jugó en agosto. No hay fuente gratuita confiable de "fuerza de plantilla ajustada por fichajes", así que esta es una limitación aceptada del MVP, no algo a resolver ahora.
*Abordaje:* documentarla explícitamente como limitación conocida (en el README y en los comentarios del módulo de features), para que una caída de precisión después de una ventana de transferencias se reconozca como esperada y no como un bug a perseguir.

**2. Validación de calidad de datos ingeridos**
Ninguna fuente es perfecta — pueden llegar valores erróneos (córners = 50, marcador negativo, fechas inconsistentes) que contaminan el entrenamiento sin que se note.
*Abordaje gratuito:* un módulo propio de validaciones de rango (sin necesidad de `great_expectations` ni herramientas de pago) que se ejecuta antes de insertar en SQLite — rechaza o marca para revisión cualquier fila fuera de rangos plausibles por columna (goles 0-15, córners 0-25, tarjetas 0-11, etc.).

**3. Partidos suspendidos, reprogramados o abandonados**
Casos borde que rompen scripts ingenuos: un partido suspendido por clima y reprogramado para otra fecha, uno abandonado a los 60 minutos por un incidente, o uno duplicado en la fuente tras la reprogramación.
*Abordaje gratuito:* una regla explícita en el módulo de ingesta — excluir partidos abandonados del entrenamiento (no tratar el marcador parcial como resultado final), y deduplicar por combinación de equipos+fecha+competición al reprogramar.

**4. Reproducibilidad determinista**
Sin semillas fijas y versiones pineadas, no se puede reproducir un resultado de hace dos meses ni comparar honestamente dos versiones del modelo — la variabilidad de librería puede superar la mejora real que se cree haber logrado.
*Abordaje gratuito:* fijar semillas aleatorias (LightGBM, Optuna, splits de validación) y pinear dependencias exactas en `requirements.txt` (`==`, no `>=`). Cero costo, es disciplina de configuración.

**5. Gestión de secretos**
El token de `/api/refresh` y las API keys (ej. API-Football) no deben vivir en el código ni commitearse a git.
*Abordaje gratuito:* archivo `.env` con `.gitignore`, cargado vía `python-dotenv` (librería gratuita). Simple, pero es el descuido más común en proyectos personales que luego se suben a GitHub.

**6. Árbitro como feature**
Football-data.co.uk ya incluye el nombre del árbitro de cada partido — un dato gratis, ya disponible, que no se había explotado. Es directamente relevante para el mercado de tarjetas (Motor 2 / Grupo B, ya identificado como "el más ruidoso" de los grupos por depender de decisiones arbitrales).
*Abordaje gratuito:* agregar tasa histórica de tarjetas mostradas por árbitro como feature adicional en el módulo de feature engineering — mismo dataset, sin fuente nueva.

**7. Monitoreo de degradación del modelo durante la temporada**
Un modelo entrenado en agosto tiende a degradarse hacia el final de la temporada si no se reentrena — sin trackear esto, no hay señal de cuándo toca reentrenar más allá de un calendario fijo arbitrario.
*Abordaje gratuito:* trackear Brier Score/Log Loss por jornada a medida que se resuelven predicciones (ya se calcula esto en la tabla `tracked`), y graficarlo en el tiempo con Recharts (ya está en el stack del frontend) — una señal visual simple de cuándo el modelo empieza a perder calibración.

---

## 4. Arquitectura propuesta

```
┌─────────────────────┐
│  Fuentes de datos    │  APIs (API-Football, football-data), scraping histórico
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Ingesta (Python)    │  scripts programados (cron / APScheduler)
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Almacenamiento      │  SQLite (archivo único, WAL activado) —
│  (raw + features)    │  ver sección 5.1 para el diseño detallado
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Feature engineering │  pandas / polars → tabla de features por partido
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Entrenamiento       │  LightGBM/CatBoost + Dixon-Coles (implementación propia),
│  (offline, batch)    │  walk-forward CV, calibración, versionado con carpetas+JSON
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Servicio de         │  FastAPI (Python, único backend) → expone /predict
│  inferencia          │  devolviendo probabilidades + explicación SHAP
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Frontend             │  React + TypeScript, dashboard de predicciones,
│  (sin gestión de      │  gráficos de calibración y confianza — consume
│  usuarios/roles)      │  FastAPI directo, sin capa intermedia
└─────────────────────┘
```

**Decisión de arquitectura (reemplaza la ambigüedad anterior de "backend dual"):** todo el sistema —ingesta, feature engineering, entrenamiento, API de inferencia— es **Python end-to-end**, un único backend en FastAPI. El prototipo previo en Node/Express + `node:sqlite` se usó únicamente como referencia del *patrón* de base de datos (qué tablas, qué índices, qué estrategia de backup) en la sección 5.1 — no se reimplementa literalmente en Node. Esto evita mantener dos lenguajes, dos frameworks de testing y dos posibles dueños del esquema de BD al mismo tiempo. React consume ese único FastAPI directamente.

---

## 5. Stack recomendado (alineado a lo que ya usas)

- **ML/Datos:** Python 3.11+, pandas/polars, scikit-learn, LightGBM, CatBoost (opcional), SHAP, Optuna (tuning). Versionado de modelos: carpetas versionadas + `metrics.json` por corrida (sin MLflow — para un solo desarrollador y un modelo principal, MLflow agrega overhead de instalación sin beneficio real sobre la alternativa simple).
- **Modelos estadísticos:** implementación propia de Dixon-Coles vía `scipy.optimize` (ajuste de máxima verosimilitud, ~100 líneas, bien documentado en la literatura) — se evita depender de librerías de terceros de mantenimiento incierto (ej. `penaltyblog`) para el componente estadístico central del sistema.
- **API:** FastAPI + Pydantic (validación de esquemas de predicción).
- **Base de datos:** SQLite como elección por defecto para la nueva app — no hay usuarios concurrentes ni múltiples procesos escribiendo, así que un motor cliente-servidor como PostgreSQL es infraestructura innecesaria para este alcance. Ver sección 5.1 para el diseño concreto (esquema, WAL, backups, migraciones ligeras) tomando como base el patrón ya validado en el prototipo.
- **Frontend:** React + TypeScript + Vite, Recharts o visx para curvas de calibración.
- **Contenedores:** Docker Compose solo para ingesta + API + frontend (SQLite no necesita contenedor propio, es un archivo).
- **Testing:** un solo stack — **pytest** para ingesta/features/modelo/API (todo es Python), **Vitest + React Testing Library** para el frontend. Ver sección 5.2 para el desglose de casos.
- Tu entorno local de Ollama/OpenCode no es necesario para la inferencia del modelo en sí (esto es ML clásico, no LLM), pero sí es perfecto como *asistente de desarrollo* para generar el código de este pipeline — que es justo para lo que armamos el prompt de abajo.

---

## 5.1. Manejo de base de datos (patrón de referencia del prototipo, reimplementado en Python)

El prototipo usa **SQLite embebido vía `node:sqlite`** (módulo nativo de Node). El **patrón** de diseño de BDD es correcto y se conserva — pero, dado que la nueva app es Python end-to-end (ver decisión de arquitectura en la sección 4), se reimplementa con el módulo estándar **`sqlite3`** de Python, no literalmente en Node. Lo que se hereda del prototipo es el esquema, los flujos de escritura/lectura y la estrategia de backup — no el lenguaje.

**Esquema (3 tablas, referencia del prototipo + `team_aliases` necesaria desde Fase 1)**

- `fixtures` — partidos: `id`, liga, fecha, equipos (+short), status (pre/post), marcador, `prediction` (JSON como TEXT), `result_checked` (bit). Índice en `(league, date)`.
- `tracked` — predicciones resueltas para el historial de precisión: `fixture_id`, `pick` (H/A/D), `confidence`, `outcome` real, `hit` (0/1), `resolved_at`.
- `team_aliases` — resolución de identidad entre fuentes: `canonical_team_id`, `source`, `source_name`, `source_id` (el prompt la requiere desde el punto 1, no es una tabla futura).

**Flujo de escritura** (solo el servicio de ingesta/sync escribe):
1. **Sync:** en cada arranque + cron diario + manual vía `POST /api/refresh` (con token de servicio). Upsert de fixtures desde la fuente configurada; predice solo partidos `pre` sin predicción aún, guarda el JSON.
2. **Resolución:** partidos `post` con predicción y marcador, `result_checked=0` → calcula outcome real, inserta en `tracked` (`INSERT OR IGNORE` por id) y marca revisado. Idempotente, evita reprocesos.

**Flujo de lectura:**
- `GET /api/fixtures` — últimos 2 días, orden por fecha, límite 100, `prediction` parseada o `null`.
- `GET /api/stats` — agregaciones sobre `tracked`: precisión global y por banda de confianza.

**Aislamiento en tests:** variable de entorno para apuntar a base en memoria (`:memory:`), con import/carga de configuración dinámica si el módulo de conexión cachea la ruta al importarse por primera vez.

### Ajustes acordados sobre el manejo de BDD (a partir del análisis de puntos a vigilar)

Estos son los cambios concretos que se van a incorporar al manejo de la base de datos, en orden de prioridad:

1. **Backup de `tracked` (prioridad más alta)** — `fixtures` es regenerable desde la fuente de datos, pero `tracked` es el único dato no reconstruible: es el historial real de aciertos/fallos que sostiene la métrica de calibración del producto. Se agrega una rutina de respaldo antes de cada sync (o en un cron semanal separado) usando `VACUUM INTO 'backups/tracked-YYYYMMDD.db'` sobre el archivo completo, o exportando `tracked` a JSON/CSV como respaldo adicional legible fuera de SQLite. Sin infraestructura nueva, solo unas líneas en el flujo de sync.

2. **Modo WAL explícito** — activar `PRAGMA journal_mode=WAL` al inicializar la conexión. Con escrituras del cron potencialmente coincidiendo con lecturas del dashboard, WAL evita bloqueos tipo "database is locked" sin cambiar nada más de la arquitectura.

3. **Integridad referencial** — activar `PRAGMA foreign_keys = ON` y declarar formalmente la FK `tracked.fixture_id → fixtures.id`. Ayuda a detectar bugs de integridad en desarrollo (p. ej. un `tracked` huérfano por un fixture eliminado o mal sincronizado) sin costo de mantenimiento adicional.

4. **Migraciones ligeras** — sin adoptar un ORM, usar `PRAGMA user_version` con un script simple de migración incremental (`migrations/001_init.sql`, `002_...`) para cuando se agregue una cuarta tabla o cambie la forma del JSON de `prediction`. Evita tener que borrar y regenerar el archivo completo en cada cambio de esquema. (El módulo estándar `sqlite3` de Python es parte de la librería estándar desde hace años, sin las etapas experimentales que sí tenía `node:sqlite` — no aplica aquí ninguna verificación de versión mínima del lenguaje por este motivo.)

5. **Política de retención (baja prioridad, solo si el archivo crece mucho)** — `fixtures` crece indefinidamente aunque el endpoint solo lea los últimos 2 días. A la escala actual (miles de filas) SQLite lo maneja sin esfuerzo; si en 1-2 años el archivo se vuelve grande, archivar `fixtures` antiguos a un archivo separado, pero **nunca purgar `tracked`** — es el activo histórico que le da valor al producto.

## 5.2. Estrategia de testing (stack único: Python + Vitest para frontend)

Con la decisión de arquitectura de la sección 4 (Python end-to-end, sin dualidad de lenguajes), la estrategia de testing se simplifica a dos frameworks, no tres:

**Backend/ingesta/modelo (todo Python) — pytest**
- Ingesta: upsert de fixtures no debe duplicar ni pisar una `prediction` ya calculada; validación de rangos rechaza filas fuera de lo plausible (ver sección 3.4); deduplicación correcta ante partidos reprogramados.
- Resolución de resultados: idempotencia (correr dos veces no duplica filas en `tracked`, valida el `INSERT OR IGNORE`), cálculo correcto de `outcome`/`hit` a partir del marcador real.
- Modelo: tests de validez —las probabilidades de cada predicción suman 1, ausencia de leakage temporal en el split walk-forward, dataset dorado con resultados conocidos para detectar regresiones silenciosas al reentrenar. El dataset dorado se construye congelando las predicciones de una corrida de referencia ya validada (inputs exactos + outputs esperados, serializados a un JSON en `tests/fixtures/golden_predictions.json`) — el test de regresión falla si una corrida nueva produce probabilidades que se desvían más de una tolerancia pequeña (ej. ±0.01) de esos valores congelados, para detectar cambios silenciosos de comportamiento al modificar código, no para validar la calidad del modelo en sí (eso ya lo cubre la evaluación contra el mercado).
- API: agregaciones de `/api/stats` contra un dataset de `tracked` fijo y conocido, rate-limit/token en `/api/refresh`.
- Aislamiento de BDD en tests: base en memoria (`:memory:`) inyectada vía variable de entorno, con la configuración de conexión cargada de forma que no cachee la ruta antes de que el test pueda sobreescribirla.

**Frontend — Vitest + React Testing Library**
- Igual que se propuso originalmente, sin cambios.

**Test de integración**
- Uno que levante el servicio completo con BDD en memoria y verifique el flujo sync → predict → resolve → stats de punta a punta, para detectar roturas de contrato entre módulos sin depender de que el modelo real esté entrenado.

---

## 6. Proceso ordenado (fases)

1. **Definición de éxito:** métricas objetivo (Log Loss, Brier Score, calibración) y benchmark contra probabilidad implícita del mercado.
2. **Recolección y almacenamiento de datos históricos** (mínimo 2 temporadas completas por liga como piso aceptable, idealmente 3-5; ver sección 3.1 para fuentes recomendadas y sección 6.1 para el criterio de suficiencia).
3. **EDA:** distribución de resultados, tasa de empates, ventaja de localía, valores faltantes.
4. **Feature engineering:** forma reciente (últimos N partidos), Elo dinámico, descanso entre partidos, H2H, localía (ajustada a 0 en cancha neutral — ver sección 6.1), (opcional) lesiones/plantilla.
5. **Modelo baseline:** regresión logística simple → establece piso de referencia.
6. **Modelo principal:** LightGBM + Dixon-Coles, con validación walk-forward (nunca random split — parámetros concretos en sección 6.1).
7. **Calibración:** isotonic regression / Platt scaling sobre las probabilidades de salida.
8. **Evaluación:** backtesting cronológico, comparación vs. odds de mercado (benchmark concreto en sección 6.1), análisis por clase (local/empate/visitante).
9. **Explicabilidad:** SHAP por predicción.
10. **Servicio de inferencia:** API con endpoint `/predict` y `/explain`.
11. **Frontend:** dashboard de predicciones + visualización de calibración/confianza (con manejo explícito de cold-start — sección 6.1).
12. **Testing integral:** unitarios, integración, validación de modelo (no-leakage, sumas de probabilidad, dataset dorado de regresión).
13. **Reentrenamiento periódico** con criterio numérico explícito (sección 6.1), no solo calendario fijo.

---

## 6.1. Parámetros concretos y decisiones de diseño resueltas

Estos eran los puntos que quedaban abiertos a "criterio del desarrollador" — se resuelven aquí con valores concretos para que la implementación no dependa de interpretación.

**Parámetros de walk-forward validation**
- Ventana de entrenamiento: **expanding** (crece con el tiempo), no fija — se usa todo el historial disponible hasta el punto de corte, en vez de una ventana deslizante de tamaño constante. Es más simple de implementar y aprovecha todo el histórico en un dataset que ya de por sí es limitado (2-5 temporadas).
- Tamaño mínimo de entrenamiento antes de generar la primera predicción evaluable: **2 temporadas completas** de la liga en cuestión.
- Cada fold de validación: **1 jornada completa** como conjunto de prueba (no partido por partido), avanzando jornada a jornada — refleja cómo se usaría el sistema en la realidad (predices toda la próxima jornada con lo que sabes hasta hoy).
- **Costo computacional del walk-forward (dimensionado, no solo protocolo):** con fold = 1 jornada y ~38 jornadas por temporada en 5 ligas, evaluar una temporada completa implica ~190 reentrenamientos si cada fold repitiera el tuning de Optuna — inviable en un i7-1255U sin GPU (puede tomar días). La mitigación es la distinción entre reentrenamiento ligero y completo definida abajo: **Optuna solo corre en el reentrenamiento completo** (mensual o disparado por degradación), y cada fold del walk-forward diario/semanal reutiliza esos mismos hiperparámetros ya tuneados, haciendo solo un refit barato (sin búsqueda de hiperparámetros) — el costo por fold pasa de "entrenar + tunear" a "solo entrenar", que en CPU con LightGBM toma segundos a low minutos, no horas.

**Dos niveles de reentrenamiento (reemplaza la contradicción anterior "semanal" vs. "cada 4 semanas")**
- **Reentrenamiento ligero (semanal, alineado al cron):** refit del modelo con los hiperparámetros ya tuneados en el último reentrenamiento completo, incorporando los partidos de la semana. Barato — sin Optuna, es la operación que corre por defecto.
- **Reentrenamiento completo (mensual, cada 4 semanas, o antes si se dispara el criterio de degradación de abajo):** repite el tuning de Optuna desde cero sobre el historial expandido. Caro — por eso no corre semanalmente, solo con esta cadencia más espaciada o cuando la métrica lo justifica.

**Suficiencia de datos por liga**
- Piso aceptable: **2 temporadas completas**. Por debajo de eso, no se lanza el modelo de esa liga — se muestra explícitamente como "sin datos suficientes" en el dashboard en vez de servir una predicción de baja confianza sin advertencia.
- Para **LigaPro Ecuador** (Tier 4, sección 3.2): si al revisar la fuente disponible (ESPN vía el prototipo) no hay 2 temporadas completas accesibles, la liga queda fuera del alcance del MVP hasta acumular suficiente historial — no se intenta transfer learning desde otra liga (agrega complejidad y riesgo de sesgo sin garantía de mejora, para un proyecto de este alcance no se justifica).

**Benchmark de calibración (reemplaza el umbral absoluto no definido)**
- No se usa un valor absoluto de Brier Score/Log Loss como "bueno" o "malo" de forma aislada — ese número depende demasiado de la liga y la temporada para ser un umbral universal confiable.
- El benchmark real es **relativo al mercado**: dado que football-data.co.uk ya trae cuotas históricas, se calcula la probabilidad implícita del mercado (normalizada por el overround) para el mismo conjunto de partidos, y se compara el Brier Score/Log Loss del modelo contra el del mercado en esa métrica. Un modelo "útil" es uno que se acerca al desempeño del mercado (no necesariamente lo supera — superar al mercado de forma consistente es difícil incluso para casas de apuestas profesionales); un modelo muy por debajo del mercado indica que algo está mal en el pipeline, no que el problema sea irresolvable.
- Piso mínimo adicional (más fácil de verificar): el modelo debe superar a un **baseline constante** (predecir siempre las frecuencias históricas de la liga: ~45% local / ~27% empate / ~28% visitante, aprox.) — si no le gana ni a esto, hay un bug, no un problema de calidad de modelo.

**Método de calibración: isotonic vs. Platt scaling (decisión por volumen de datos, ya no abierta)**
- **Isotonic regression por defecto** — más flexible, aprovecha mejor la forma real de la curva de calibración cuando hay suficientes datos.
- **Platt scaling como excepción** cuando el mercado en cuestión tiene **menos de 500 muestras resueltas** en el set de calibración — isotonic tiende a sobreajustar (escalones erráticos) con pocos datos, relevante para mercados nicho como córners/tarjetas que acumulan menos historial resuelto que 1X2.

**Peso del blend Dixon-Coles + LightGBM (ya no fijo/arbitrario)**
- El peso no se fija a mano (nada de 50/50 arbitrario): se optimiza con un **grid search 1D** (pesos de 0 a 1 en pasos de 0.05) sobre los folds de validación walk-forward, eligiendo el peso que minimiza el Brier Score conjunto. Para evitar sobreestimación de métricas por optimizar y reportar sobre los mismos folds, los folds de walk-forward se dividen en dos tramos: el peso del blend se optimiza sobre el **tramo más antiguo** (ej. jornadas 1 a N-5), y las métricas finales reportadas (Brier Score, Log Loss, comparación contra mercado) se calculan solo sobre las **últimas 5 jornadas** como holdout no visto por la optimización del peso. Se recalcula en cada reentrenamiento completo (mensual), no en cada refit ligero.

**Incertidumbre / intervalos de confianza (mecanismo concreto, no solo mención)**
- Se implementa vía un **ensemble de 5 semillas** de LightGBM (ya se fijan semillas por reproducibilidad — aquí se entrenan 5 variantes con semillas distintas sobre el mismo dataset) y se reporta la **desviación estándar entre las 5 predicciones** como medida simple de confianza, expuesta como campo `model_agreement` en la respuesta de `/predict`. Es más barato que bootstrap sobre el dataset completo y da una señal utilizable sin agregar mucho más cómputo (5 entrenamientos en vez de 1, no 100).

**Cold-start del sistema (no solo de equipos — el dashboard mismo al arrancar)**
- Mientras existan menos de **30 predicciones resueltas** en `tracked`, el dashboard de calibración y el gráfico de Brier Score por jornada muestran explícitamente un estado de "datos insuficientes para evaluar calibración todavía" en vez de un gráfico vacío o engañoso con pocos puntos.

**Zonas horarias por fuente (normalización explícita, no genérica)**
- Cada adaptador de fuente de datos declara explícitamente el huso horario de origen de sus timestamps y los convierte a UTC **en el momento de la ingesta**, antes de insertar en SQLite — nunca se asume ni se difiere la conversión a una capa posterior. football-data.co.uk reporta hora local del Reino Unido (GMT/BST, con cambio de horario de verano); la API de ESPN reporta en UTC directamente. Cada adaptador debe documentar y testear explícitamente cuál es el caso que maneja.

**Localía en canchas neutrales**
- Cuando `competition_type = copa-neutral`, la feature de ventaja de localía se **fuerza a 0 estructuralmente** (no se deja que el modelo la infiera de los datos) — es un hecho físico (no hay equipo local en una final en cancha neutral), no algo que deba aprenderse de un historial que además es escaso para este caso específico.

**Clima/viaje como features (reconsiderado tras la revisión)**
- Sí son viables gratis: **Open-Meteo** ofrece datos históricos de clima gratuitos desde 1940, sin necesidad de API key, con un límite generoso de ~10,000 llamadas/día — mejor opción que OpenWeatherMap (cuyo histórico vía One Call requiere plan pago). Coordenadas de estadios son de dominio público, y la distancia entre ciudades es un cálculo trivial (fórmula de Haversine).
- Se agregan como **features de Fase 2** (no Fase 1, para no inflar el alcance inicial): temperatura/precipitación del día del partido en la ciudad sede, y distancia recorrida por el equipo visitante desde su ciudad de origen — con mayor relevancia esperada en ligas con climas más variables (ej. Norte de Europa) que en ligas de clima estable.

**Mecanismo HT/FT del Motor 2 (la brecha técnica más grande identificada, ahora resuelta)**
El diagnóstico de la sección 2.2 era correcto (1ª y 2ª mitad están correlacionadas, no son independientes) pero le faltaba mecanismo. La solución **no es una cópula bivariada completa** (demasiado compleja para el alcance) — es un enfoque de dos etapas:
1. Dixon-Coles independiente para el marcador de **1ª mitad** (marginal), igual que ya se hace para el partido completo.
2. La tasa de gol esperada de cada equipo en la **2ª mitad** se ajusta con un multiplicador estimado empíricamente según el estado del marcador al descanso (equipo ganando / perdiendo / empatado al entretiempo). **Importante:** para evitar confusión causal entre el estado del marcador y la calidad real del equipo, el multiplicador se estima como **residual** — la diferencia entre la tasa de gol real en 2ª mitad y la tasa esperada según el Elo/forma del equipo (que ya captura su calidad base), condicionada al estado al descanso. Así el multiplicador captura el efecto *incremental* del estado del marcador, no la calidad del equipo mezclada con él. Se calcula sobre el mismo histórico, sin fuentes de datos adicionales.
3. De ahí se deriva la distribución conjunta HT×FT necesaria para "Mitad/Final" y "Mitad/Final marcador exacto" vía una **simulación acotada solo sobre el espacio de marcadores de la 2ª mitad** (no sobre minutos de juego — eso sigue siendo el Motor 3 descartado). Es computacionalmente barato porque el espacio de combinaciones de marcador es finito y pequeño, muy distinto del motor de simulación de eventos en el tiempo que se dejó fuera de alcance.

**Mercados combinados ("No-motor") — entregable explícito, no solo mencionados**
Los mercados que combinan condiciones que ya dependen únicamente de los Motores 1 y 2 (ej. doble oportunidad + total de goles, Mitad/Final + total) se implementan en Fase 2 leyendo la probabilidad conjunta directamente de las distribuciones ya calculadas (la matriz de marcador completo del Motor 1, y la distribución HT×FT del punto anterior) — nunca multiplicando probabilidades marginales de mercados por separado, dado que estos eventos están correlacionados.

**Scaffold de carpetas de referencia**
No hay estructura completa definida hasta ahora, solo módulos puntuales mencionados dispersos en el prompt. Referencia sugerida (Python end-to-end, un solo repo):

```
prediccion-ml/
├── .env                      # secretos (API keys, token de /api/refresh) — en .gitignore
├── requirements.txt          # dependencias con versión exacta (==)
├── docker-compose.yml
├── data/
│   └── futbol.db             # SQLite, un solo archivo
├── migrations/
│   ├── 001_init.sql
│   └── 002_...sql
├── ingestion/
│   ├── adapters/              # uno por fuente: football_data.py, understat.py,
│   │                          # api_football.py, espn.py
│   ├── team_aliases.py
│   └── validation.py         # validación de rangos y de columnas esperadas
├── features/
│   └── build_features.py     # único módulo, importado por training e inference
├── models/
│   ├── dixon_coles.py         # implementación propia vía scipy.optimize
│   ├── train.py               # walk-forward, Optuna, blend, ensemble de semillas
│   └── runs/                  # carpetas versionadas + metrics.json (sin MLflow)
├── api/
│   ├── main.py                 # FastAPI app
│   └── routers/                 # predict, stats, refresh
├── tests/
│   ├── test_ingestion.py
│   ├── test_features.py
│   ├── test_models.py
│   └── test_api.py
└── frontend/                   # React + TypeScript + Vite
```

## 6.2. Decisiones de precisión (ajustes menores resueltas)

Estos son ajustes de detalle no bloqueantes que surgieron del análisis del spec. Los cambios concretos ya están incorporados en las secciones correspondientes del documento (5.1, 5.2, 6.1 y los puntos 8/9 del prompt). Se documentan aquí como referencia.

**1. Sesgo del multiplicador de 2ª mitad (Motor 2)**
El multiplicador empírico "según estado al descanso" tiene un problema de identificación causal: mezcla el efecto incremental del estado del marcador con la calidad real del equipo (los que van ganando suelen ser más fuertes per se). La solución es estimar el multiplicador como **residual** — la diferencia entre la tasa de gol real en 2ª mitad y la tasa esperada según el Elo/forma del equipo, condicionada al estado al descanso. Captura el efecto incremental del marcador, no la calidad del equipo. Se calcula sobre el mismo histórico, sin fuentes adicionales. *(Incorporado en 6.1, mecanismo HT/FT)*

**2. Contrato de `/predict` unificado**
El endpoint `/predict` devuelve 4 campos explícitos: (a) probabilidades calibradas de 1X2, (b) marcador probable (moda Dixon-Coles), (c) top features SHAP, (d) `model_agreement` (std del ensemble de 5 semillas). *(Incorporado en prompt punto 8)*

**3. Dos indicadores de confianza en el frontend**
`confidence` (probabilidad máxima entre 1X2) se muestra como número principal ("el modelo da 62% a que gane el local"). `model_agreement` (std entre semillas) como indicador secundario de robustez, útil para detectar cuando el modelo está "seguro pero frágil" (alta confidence con alto desacuerdo entre semillas). *(Incorporado en prompt punto 9)*

**4. Dataset dorado para tests de regresión**
Se construye congelando las predicciones de una corrida de referencia ya validada (inputs + outputs serializados en `tests/fixtures/golden_predictions.json`). El test falla si una corrida nueva se desvía más de ±0.01 de esos valores congelados. Detecta cambios silenciosos de comportamiento al modificar código, no valida la calidad del modelo (eso lo cubre la evaluación contra el mercado). *(Incorporado en 5.2)*

**5. Esquema real: 3 tablas, no 2**
`team_aliases` es parte del esquema mínimo desde Fase 1 (el prompt la pide desde el punto 1). Sección 5.1 actualizada para reflejar 3 tablas. Las migraciones futuras se refieren a una cuarta tabla, no a una tercera. *(Incorporado en 5.1)*

**6. Separación holdout en la optimización del peso del blend**
El peso del blend se optimiza sobre el tramo más antiguo de los folds de walk-forward, y las métricas finales se reportan solo sobre las últimas 5 jornadas como holdout no visto. Evita la sobreestimación sutil que proviene de optimizar y reportar sobre los mismos datos. *(Incorporado en 6.1)*

---

## 7. Prompt final para OpenCode

Copia y pega esto en OpenCode (ajusta la liga/deporte inicial si no es fútbol):

```
Actúa como ingeniero de ML/software senior. Vamos a construir, de forma incremental
y probada en cada etapa, una plataforma de estimación de probabilidades de resultados
deportivos (fútbol) usando ML clásico. El alcance incluye múltiples mercados (1X2,
doble oportunidad, over/under, BTTS, hándicap, córners, tarjetas, primera mitad,
goleador), pero se construye en fases — NO intentes abordar todos los mercados a la
vez, la Fase 1 (solo 1X2) debe quedar sólida y bien calibrada antes de avanzar. NO
construyas ningún motor de simulación de eventos en el tiempo (mercados de tipo
"primer gol", "racha de goles consecutivos", "remontada", etc.) — queda fuera de
alcance por ahora. NO requiere gestión de usuarios, autenticación ni pagos — es una
herramienta analítica de un solo usuario.

Contexto de mi entorno: laptop Windows 11, CPU-only (Intel i7-1255U, sin GPU dedicada,
16GB RAM). Todo el código debe funcionar sin GPU. Stack: Python 3.11 para el pipeline
de ML/API, React + TypeScript para el frontend, SQLite como base de datos (sin motor
cliente-servidor, un solo archivo), Docker Compose para orquestar ingesta/API/frontend.
Usa FastAPI para el servicio de inferencia. Gestiona todos los secretos (API keys,
tokens de endpoints de escritura) vía un archivo .env cargado con python-dotenv,
nunca hardcodeados en el código ni commiteados a git (agrega .env a .gitignore desde
el primer commit). Usa como estructura de carpetas de referencia:

prediccion-ml/
├── .env / requirements.txt (versiones exactas, ==) / docker-compose.yml
├── data/futbol.db
├── migrations/ (001_init.sql, 002_...)
├── ingestion/adapters/ (football_data.py, understat.py, api_football.py, espn.py),
│   team_aliases.py, validation.py
├── features/build_features.py (único módulo, importado por training e inference)
├── models/dixon_coles.py, train.py, runs/ (carpetas versionadas + metrics.json)
├── api/main.py, routers/
├── tests/
└── frontend/ (React + TypeScript + Vite)

Requisitos de base de datos (validados ya en un prototipo previo, replicar este patrón):
- SQLite como archivo único, con `PRAGMA journal_mode=WAL` activado desde el inicio
  para evitar bloqueos entre escrituras del cron/sync y lecturas del dashboard.
- Activar `PRAGMA foreign_keys=ON` y declarar las FKs explícitamente en el esquema.
- Sin ORM pesado ni Alembic: migraciones ligeras vía `PRAGMA user_version` con scripts
  incrementales (`migrations/001_init.sql`, `002_...`).
- Separar claramente en el esquema los datos regenerables (ej. partidos/fixtures, que
  se pueden volver a traer de la fuente) de los datos no regenerables (ej. historial
  de predicciones ya resueltas con su resultado real — la base de la métrica de
  calibración del producto). Sobre estos últimos, implementar una rutina de backup
  (`VACUUM INTO` a un archivo con fecha, o export a JSON/CSV) antes de cada sync o en
  un cron semanal separado.
- Tests con aislamiento vía variable de entorno para apuntar a base en memoria
  (`:memory:`), con import dinámico de la configuración de conexión si el lenguaje
  del backend lo requiere (para evitar que un import estático cachee la ruta del
  archivo antes de poder sobreescribirla en tests).

Requisitos funcionales del pipeline, en este orden y como entregables incrementales:

1. Módulo de ingesta de datos históricos de partidos, empezando por las 5 ligas top
   europeas (Premier League, La Liga, Bundesliga, Serie A, Ligue 1 — las de mejor
   cobertura de datos gratuita: resultados, cuotas, córners, tarjetas vía
   football-data.co.uk, y xG vía Understat). football-data.co.uk NO sirve para
   partidos futuros (solo se actualiza después de cada jornada jugada) — usa
   API-Football para traer los fixtures programados de las 5 ligas top que aún no
   se han jugado (los que se van a predecir). Diseña un adaptador claro por fuente de
   datos para poder agregar más ligas/tiers sin reescribir el resto del sistema —
   en particular deja previsto que LigaPro Ecuador se agregará más adelante con un
   feature set más limitado (sin cuotas históricas ni xG, solo fixtures/resultados
   vía la API de ESPN que ya usa el prototipo), y solo si hay al menos 2 temporadas
   completas de histórico disponibles — si no las hay, la liga queda fuera del MVP.
   Almacenar en SQLite siguiendo el patrón de BDD descrito arriba. Requisitos
   adicionales de este módulo:
   - Cada adaptador de fuente valida que las columnas esperadas del CSV/respuesta
     existan antes de procesar cualquier archivo/respuesta nuevo — si football-data.co.uk
     cambia su formato (agrega/quita/renombra columnas), el sync debe fallar
     ruidosamente y detenerse, nunca continuar silenciosamente con datos parciales.
   - Trata el xG de Understat como feature opcional/nullable: si el scraping falla,
     el pipeline sigue funcionando sin xG para esos partidos, en vez de romperse.
   - Crea una tabla `team_aliases` (canonical_team_id, source, source_name/source_id)
     para resolver que el mismo equipo tiene nombres/IDs distintos en cada fuente
     (ej. "Manchester United" en una fuente y "Man Utd" en otra). No la llenes de
     forma automática sin revisión: usa una librería de fuzzy matching (rapidfuzz)
     solo para sugerir candidatos, la confirmación final debe ser explícita.
   - Agrega una columna `competition_type` (liga / copa / copa-neutral) en el
     esquema de partidos desde el inicio, ya que copas de eliminación directa violan
     los supuestos del modelo de liga (cancha neutral, alineaciones rotadas).
   - Cada adaptador de fuente declara explícitamente el huso horario de origen de
     sus timestamps (ej. football-data.co.uk reporta hora local UK con horario de
     verano; ESPN reporta UTC directamente) y convierte a UTC en el momento de la
     ingesta, antes de insertar en SQLite — nunca de forma implícita ni diferida a
     una capa posterior.
   - Implementa un módulo propio de validación de rangos (goles 0-15, córners 0-25,
     tarjetas 0-11, fechas coherentes, etc.) que se ejecuta antes de insertar
     cualquier fila en SQLite — sin necesidad de librerías de terceros, solo
     validaciones explícitas que rechacen o marquen para revisión datos fuera de
     rango plausible.
   - Maneja explícitamente partidos suspendidos/abandonados/reprogramados: excluye
     del entrenamiento los partidos abandonados (no trates el marcador parcial como
     resultado final), y deduplica por equipos+fecha+competición al detectar una
     reprogramación.

2. Módulo de feature engineering: forma reciente (rolling N partidos), rating Elo
   dinámico por equipo, ventaja de localía (forzada a 0 estructuralmente cuando
   `competition_type = copa-neutral`, nunca inferida de los datos para ese caso),
   descanso entre partidos, historial head-to-head, y tasa histórica de tarjetas
   mostradas por árbitro (columna ya disponible en football-data.co.uk, relevante
   para el mercado de tarjetas de la Fase 2). Debe generar una tabla de features
   por partido lista para modelado, con separación estricta cronológica para evitar
   data leakage. Este módulo debe vivir en un único archivo/paquete importado tanto
   por el pipeline de entrenamiento como por el servicio de inferencia (Fase
   posterior) — nunca dos implementaciones separadas del mismo cálculo de features,
   para evitar discrepancias entre entrenamiento y producción (training-serving
   skew). Define también una regla explícita y determinista de inicialización de
   Elo para equipos sin historial (recién ascendidos, o LigaPro Ecuador si el
   histórico es corto): usar el promedio de Elo final de los equipos descendidos la
   temporada anterior, o el percentil 10 de la liga si no hay ese dato disponible.
   Documenta explícitamente en el código (docstring/comentario) que el modelo NO
   captura cambios de plantilla dentro de temporada (fichajes) — es una limitación
   aceptada del alcance actual, no un bug a corregir.

3. Modelo baseline: regresión logística multiclase (1X2) con validación walk-forward
   de ventana expanding (no fija), con al menos 2 temporadas completas de
   entrenamiento antes de generar la primera predicción evaluable, y cada fold de
   validación correspondiente a una jornada completa (NUNCA split aleatorio).
   Reportar Log Loss, Brier Score y accuracy por clase como referencia mínima, y
   comparar contra un baseline constante (frecuencias históricas de la liga:
   ~45% local / ~27% empate / ~28% visitante aprox.) — el modelo debe superar
   claramente este piso antes de considerarse funcional.

4. Modelo principal: LightGBM (o CatBoost) para 1X2, más una implementación PROPIA
   de Dixon-Coles vía scipy.optimize (ajuste de máxima verosimilitud, no dependas
   de librerías de terceros de mantenimiento incierto para este componente) para
   modelar goles/marcador exacto. Combínalos con un promedio ponderado (no stacking
   por ahora — mantenlo simple para el MVP), pero NO fijes el peso a mano: encuéntralo
   con un grid search 1D (pesos de 0 a 1 en pasos de 0.05) sobre los folds de
   validación walk-forward, minimizando el Brier Score conjunto. Implementa además
   un ensemble de 5 semillas de LightGBM (mismo dataset, 5 semillas distintas) para
   estimar incertidumbre: reporta la desviación estándar entre las 5 predicciones
   como campo `model_agreement` en la respuesta de `/predict`.

   Distingue explícitamente DOS niveles de reentrenamiento para no disparar Optuna
   en cada fold (sería inviable en CPU sin GPU — sal del cómputo de ~190 corridas
   completas por temporada/liga si se repitiera el tuning en cada jornada):
   - Reentrenamiento LIGERO (semanal, alineado al cron): refit con los
     hiperparámetros ya tuneados del último reentrenamiento completo, sin Optuna.
   - Reentrenamiento COMPLETO (cada 4 semanas, o antes si el Brier Score móvil de
     las últimas 10 jornadas se degrada más de 15% relativo respecto al Brier Score
     de validación del entrenamiento más reciente): repite el tuning de Optuna y
     recalcula el peso del blend del grid search de arriba.

   Guarda cada corrida (modelo, métricas, parámetros, hash del dataset) en una
   carpeta versionada con un metrics.json — NO uses MLflow ni ninguna herramienta de
   tracking adicional, es overhead innecesario para un solo desarrollador y un
   modelo principal. Fija semillas aleatorias en todos los componentes estocásticos
   (LightGBM, Optuna, splits de validación) y pinea las versiones exactas de
   dependencias en requirements.txt (con ==, no >=), para que cualquier corrida sea
   reproducible.

5. Calibración de probabilidades: usa **isotonic regression por defecto**; si el
   mercado en cuestión tiene menos de 500 muestras resueltas en el set de
   calibración, usa **Platt scaling** en su lugar (isotonic sobreajusta con pocos
   datos). Genera curvas de calibración (reliability diagrams) como artefacto de
   evaluación.

6. Evaluación: backtesting cronológico completo, comparación de las probabilidades
   del modelo contra la probabilidad implícita de cuotas de mercado (normalizada por
   el overround, ya disponible en football-data.co.uk) — el benchmark de calidad no
   es un valor absoluto de Brier Score/Log Loss, es qué tan cerca queda el modelo del
   desempeño del mercado en esas mismas métricas. Desglosa también por clase
   (local/empate/visitante) dado el desbalance típico de empates.

7. Explicabilidad: integra SHAP para explicar cada predicción individual (qué
   features empujaron la probabilidad hacia arriba/abajo).

8. API de inferencia con FastAPI: endpoint POST /predict que reciba identificadores
   de equipos/fecha y devuelva 4 campos explícitos: (a) probabilidades calibradas
   de 1X2, (b) marcador probable (moda de la matriz Dixon-Coles), (c) top features
   explicativas (SHAP), y (d) `model_agreement` (desviación estándar del ensemble
   de 5 semillas, como indicador de robustez). Incluye validación de esquema con
   Pydantic y tests con pytest (incluyendo test de que las probabilidades sumen 1,
   y test de ausencia de leakage temporal en el pipeline de entrenamiento).

9. Frontend en React + TypeScript (sin gestión de usuarios/roles — sí hay un token
   simple de servicio para el endpoint de escritura, ver más abajo): una vista que
   permita seleccionar un partido/fecha y muestre las probabilidades estimadas, con
   dos indicadores de confianza etiquetados sin ambigüedad: `confidence` (la
   probabilidad máxima entre 1X2, como el número principal: "el modelo da 62% a
   que gane el local") y `model_agreement` (la desviación estándar del ensemble de
   5 semillas, como indicador secundario de robustez — útil para detectar cuando
   el modelo está "seguro pero frágil": alta confidence con alto desacuerdo entre
   semillas). Muestra también un gráfico simple de calibración histórica del modelo.
   Mientras existan menos de 30 predicciones resueltas en `tracked`, este gráfico
   debe mostrar explícitamente un estado de "datos insuficientes para evaluar
   calibración todavía" en vez de un gráfico vacío o engañoso. Agrega también un
   gráfico con Recharts de Brier Score/Log Loss por jornada a lo largo de la
   temporada (usando los datos ya disponibles en la tabla `tracked`), con el mismo
   manejo de cold-start.

10. Dockeriza todo el sistema (ingesta, DB, API, frontend) con docker-compose para
    que se pueda levantar con un solo comando.

11. Documenta en un README el proceso de reentrenamiento periódico recomendado y
    cómo interpretar las métricas de calibración, dejando explícito que es una
    herramienta analítica y no una recomendación de apuesta. Documenta los dos
    niveles de reentrenamiento (ligero semanal sin Optuna, completo cada 4 semanas
    o antes si el Brier Score móvil de las últimas 10 jornadas se degrada más de
    15% relativo respecto al Brier Score de validación del entrenamiento más
    reciente). Documenta también, como limitaciones conocidas del alcance actual: (a)
    el modelo no captura cambios de plantilla dentro de temporada (fichajes), y (b)
    LigaPro Ecuador opera con un feature set más limitado que las ligas top europeas
    (sin cuotas históricas ni xG).

FASE 2 (solo después de que la Fase 1 esté completa, probada y con métricas de
calibración aceptables — no empezar en paralelo):

12. Extiende el modelo de goles (Dixon-Coles) para derivar, de la misma matriz de
    probabilidad de marcador ya calculada, sin entrenar modelos nuevos: doble
    oportunidad, over/under de goles, ambos equipos marcan (BTTS), y hándicap
    asiático/europeo. Expón cada uno como su propio endpoint bajo el mismo servicio
    (/predict/double-chance, /predict/goals-ou, /predict/btts, /predict/handicap),
    reutilizando el modelo ya entrenado en la Fase 1.

13. Entrena modelos adicionales especializados para córners y tarjetas (conteos vía
    Poisson o clasificación por umbral con LightGBM), reutilizando el feature set
    base de Fase 1 (forma, Elo, xG) y agregando historial de córners/tarjetas por
    equipo como features nuevas. Aplica el mismo proceso de walk-forward validation
    y calibración que en la Fase 1. Expón como /predict/corners y /predict/cards.

14. Entrena un modelo de mercados de primera mitad usando el mecanismo de dos etapas
    (NO dos modelos independientes de mitad — eso no captura la correlación entre
    HT y FT que necesitan estos mercados):
    (a) Dixon-Coles independiente para el marcador de 1ª mitad (mismo enfoque que
        el modelo de partido completo, pero con goles de 1ª mitad como objetivo).
    (b) Ajusta la tasa de gol esperada de cada equipo en la 2ª mitad con un
        multiplicador estimado empíricamente según el estado del marcador al
        descanso (ganando/perdiendo/empatado) — estimar este multiplicador a partir
        del historial (comparar la tasa de gol real de 2ª mitad de equipos en cada
        estado de descanso contra su tasa base).
    (c) Deriva la distribución conjunta HT×FT necesaria para "Mitad/Final" y
        "Mitad/Final marcador exacto" simulando SOLO el espacio de marcadores de
        2ª mitad (no minutos de juego — no reabras el motor de timing descartado),
        combinando la distribución de 1ª mitad del punto (a) con la tasa ajustada
        del punto (b) para cada posible marcador de descanso.
    De esta misma distribución conjunta deriva también: over/under 1ª mitad, BTTS
    1ª mitad, ambas mitades más/menos de X.5, team gana ambas/cualquier mitad.
    Expón como /predict/first-half y /predict/half-time-full-time.

14b. Implementa los mercados combinados que dependen únicamente de los Motores 1/2
    (ej. doble oportunidad + total de goles, Mitad/Final + total, resultado + BTTS)
    leyendo la probabilidad conjunta directamente de las distribuciones ya
    calculadas en los puntos 12 y 14 — NUNCA multiplicando probabilidades
    marginales de mercados por separado, ya que estos eventos están
    correlacionados. Expón como /predict/combo/{tipo}.

FASE 3 (la más compleja, dejar para el final, requiere rediseño de esquema de datos
a nivel jugador — solo abordar si las fases anteriores están sólidas; NO construyas
motor de simulación de eventos en el tiempo por ahora, queda fuera de alcance):

15. Modelos de eventos raros a nivel de equipo (penalti en el partido, gol en propia
    meta) vía tasa histórica por equipo (Poisson/logística simple). Expón como
    /predict/rare-events.

16. Diseña un módulo separado para predicción de goleador (anytime/primer goleador),
    a nivel de jugador en vez de equipo: tasa de goles esperados por 90 minutos por
    jugador (usando xG individual), ajustada por minutos esperados a jugar según si
    es titular confirmado. Este módulo requiere su propia tabla de features (una
    fila por jugador por partido, no por partido), su propia fuente de datos de
    lineups confirmados, y su propio pipeline de entrenamiento independiente del
    resto. Expón como /predict/scorer.

Trabaja fase por fase, mostrándome el código y explicando brevemente las decisiones
de diseño en cada paso antes de avanzar a la siguiente fase. Prioriza código simple,
testeado, y que corra bien en CPU sin dependencias de GPU.
```

---

### Notas finales
- Si el deporte no es fútbol, ajusta el punto de Dixon-Coles (es específico para deportes de bajo scoring tipo fútbol/hockey); para básquet, por ejemplo, conviene un modelo de márgenes de puntos en vez de Poisson de goles.
- Si luego quieres usar tus modelos locales de Ollama (codeqwen/qwen2.5-coder) para asistir en la generación de código en OpenCode, este prompt funciona igual — la elección de modelo LLM no afecta el diseño técnico del sistema ML en sí.
- El proyecto se inspira explícitamente en Ecuabet para el diseño de mercados. Está bien como referencia de documentación/desarrollo, pero si se comparte públicamente (portafolio, GitHub), evitar usar el nombre/marca de Ecuabet como nombre del proyecto o en el UI, para no generar confusión de marca — usar un nombre propio para la plataforma.

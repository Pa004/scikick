/* eslint-disable react-refresh/only-export-components -- Context + hook must live together by design */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { MarketCategoryKey } from '../components/marketCategories'

export type Locale = 'en' | 'es'

const DICTIONARIES = {
  en: {
    tagline: 'Football Probability Estimation Engine',
    allLeagues: 'All Leagues',
    premierLeague: 'Premier League',
    laLiga: 'La Liga',
    bundesliga: 'Bundesliga',
    serieA: 'Serie A',
    ligue1: 'Ligue 1',
    loading: 'Loading...',
    backendError: 'Backend not running. Start with: uvicorn app.api.main:app --reload',
    fixtures: 'Fixtures',
    noFixtures: 'No fixtures found. Run sync first.',
    predicted: 'predicted',
    match: 'Match',
    goalscorer: 'Goalscorer',
    prediction: 'Prediction',
    model: 'Model',
    agreement: 'Agreement',
    probableScore: 'Probable score',
    topFeatures: 'Top Features',
    home: 'Home',
    draw: 'Draw',
    away: 'Away',
    over: 'Over',
    under: 'Under',
    stats: 'Stats',
    noStats: 'No stats yet. Train models first.',
    predictions: 'Predictions',
    accuracy: 'Accuracy',
    avgConfidence: 'Avg Confidence',
    byMarket: 'By Market',
    byLeague: 'By League',
    market: 'Market',
    total: 'Total',
    cold: 'cold',
    noMatchday: 'Need at least 5 matchdays of data.',
    noCalibration: 'Need at least 30 resolved predictions.',
    selectFixture: 'Select a fixture to see predictions.',
    loadingScorer: 'Loading scorer data...',
    noScorerData: 'No scorer data available for this fixture.',
    lineupConfirmed: 'Lineup confirmed',
    lineupUnavailable: 'Lineup unavailable — projected from historical starters',
    player: 'Player',
    team: 'Team',
    xg90: 'xG90',
    min: 'Min',
    prob: 'Prob',
    league: 'League',
    marketResults: 'Results',
    marketGoals: 'Goals',
    marketHandicap: 'Handicap',
    marketCorners: 'Corners',
    marketCards: 'Cards',
    marketFirstHalf: '1st Half',
    marketHalfFull: 'Half/Full',
    marketCombined: 'Combined',
    noCalibrationData: 'No calibration data available.',
    noMatchdayData: 'No matchday data available.',
    predictedPct: 'Predicted',
    actualPct: 'Actual',
    perfect: 'Perfect',
    brierScore: 'Brier Score',
    accuracyPct: 'Accuracy',
    baseline: 'baseline',
    other: 'Other',
  },
  es: {
    tagline: 'Motor de Estimación de Probabilidades de Fútbol',
    allLeagues: 'Todas las Ligas',
    premierLeague: 'Premier League',
    laLiga: 'La Liga',
    bundesliga: 'Bundesliga',
    serieA: 'Serie A',
    ligue1: 'Ligue 1',
    loading: 'Cargando...',
    backendError: 'Backend no activo. Inicia con: uvicorn app.api.main:app --reload',
    fixtures: 'Partidos',
    noFixtures: 'No hay partidos. Ejecuta sync primero.',
    predicted: 'predicho',
    match: 'Partido',
    goalscorer: 'Goleador',
    prediction: 'Predicción',
    model: 'Modelo',
    agreement: 'Acuerdo',
    probableScore: 'Marcador probable',
    topFeatures: 'Principales Características',
    home: 'Local',
    draw: 'Empate',
    away: 'Visitante',
    over: 'Más',
    under: 'Menos',
    stats: 'Estadísticas',
    noStats: 'Aún sin estadísticas. Entrena los modelos primero.',
    predictions: 'Predicciones',
    accuracy: 'Precisión',
    avgConfidence: 'Confianza Prom.',
    byMarket: 'Por Mercado',
    byLeague: 'Por Liga',
    market: 'Mercado',
    total: 'Total',
    cold: 'frío',
    noMatchday: 'Se necesitan al menos 5 jornadas de datos.',
    noCalibration: 'Se necesitan al menos 30 predicciones resueltas.',
    selectFixture: 'Selecciona un partido para ver predicciones.',
    loadingScorer: 'Cargando datos del goleador...',
    noScorerData: 'No hay datos de goleador para este partido.',
    lineupConfirmed: 'Alineación confirmada',
    lineupUnavailable: 'Alineación no disponible — proyectada de titulares históricos',
    player: 'Jugador',
    team: 'Equipo',
    xg90: 'xG90',
    min: 'Min',
    prob: 'Prob',
    league: 'Liga',
    marketResults: 'Resultados',
    marketGoals: 'Goles',
    marketHandicap: 'Handicap',
    marketCorners: 'Esquinas',
    marketCards: 'Tarjetas',
    marketFirstHalf: '1ª Mitad',
    marketHalfFull: 'Mitad/Final',
    marketCombined: 'Combinados',
    noCalibrationData: 'No hay datos de calibración.',
    noMatchdayData: 'No hay datos de jornada.',
    predictedPct: 'Predicho',
    actualPct: 'Real',
    perfect: 'Perfecto',
    brierScore: 'Brier Score',
    accuracyPct: 'Precisión',
    baseline: 'base',
    other: 'Otro',
  },
} as const

export type TranslationKey = keyof typeof DICTIONARIES['en']
type Dictionary = (typeof DICTIONARIES)['en']

const MARKET_CATEGORY_KEY_TO_I18N: Record<MarketCategoryKey, TranslationKey> = {
  results: 'marketResults',
  goals: 'marketGoals',
  handicap: 'marketHandicap',
  corners: 'marketCorners',
  cards: 'marketCards',
  firstHalf: 'marketFirstHalf',
  halfFull: 'marketHalfFull',
  combined: 'marketCombined',
}

export function marketCategoryLabel(category: MarketCategoryKey): TranslationKey {
  return MARKET_CATEGORY_KEY_TO_I18N[category]
}

const STORAGE_KEY = 'scikick.locale'

function detectInitialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'es') return saved
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

interface LanguageContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(detectInitialLocale)

  useEffect(() => {
    document.documentElement.lang = locale
    localStorage.setItem(STORAGE_KEY, locale)
  }, [locale])

  const t = (key: TranslationKey): string => DICTIONARIES[locale][key as keyof Dictionary]

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}

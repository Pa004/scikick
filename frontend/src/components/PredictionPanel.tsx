import type { Prediction } from '../types'
import { useLanguage } from '../i18n'
import MarketRenderer from './MarketRenderer'
import MarketSelector from './MarketSelector'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

interface PredictionPanelProps {
  prediction: Prediction
  selectedMarket: string
  onMarketChange: (market: string) => void
}

export default function PredictionPanel({ prediction, selectedMarket, onMarketChange }: PredictionPanelProps) {
  const { t } = useLanguage()
  const availableMarkets = Object.keys(prediction.probabilities)

  return (
    <div>
      <h2 style={{ color: 'var(--text)', marginBottom: '1rem', fontSize: '1.1rem' }}>{t('prediction')}</h2>

      <div className="card-flat" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {t('model')}: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{prediction.model_version}</span>
          {' | '}
          {t('agreement')}: <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{formatProb(prediction.model_agreement)}</span>
        </div>
        {prediction.probable_score && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {t('probableScore')}:{' '}
            <span
              className="badge badge-accent"
              style={{ fontSize: '0.9rem', padding: '0.25rem 0.75rem' }}
            >
              {prediction.probable_score.home} - {prediction.probable_score.away}
            </span>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <MarketSelector selected={selectedMarket} onChange={onMarketChange} availableMarkets={availableMarkets} />
      </div>

      <div className="card-flat" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--text)', fontSize: '1rem' }}>
          {selectedMarket.replace(/_/g, ' ')}
        </h3>
        <MarketRenderer market={selectedMarket} probabilities={prediction.probabilities} />
      </div>

      {prediction.top_features && prediction.top_features.length > 0 && (
        <div className="card-flat" style={{ padding: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', color: 'var(--text)', fontSize: '1rem' }}>{t('topFeatures')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {prediction.top_features.map((f, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{f.feature.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>{f.value.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

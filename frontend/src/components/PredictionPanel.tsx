import type { Prediction } from '../types'
import MarketRenderer from './MarketRenderer'
import MarketSelector from './MarketSelector'

const formatProb = (p: number) => `${(p * 100).toFixed(1)}%`

interface PredictionPanelProps {
  prediction: Prediction
  selectedMarket: string
  onMarketChange: (market: string) => void
}

export default function PredictionPanel({ prediction, selectedMarket, onMarketChange }: PredictionPanelProps) {
  const availableMarkets = Object.keys(prediction.probabilities)

  return (
    <div>
      <h2 style={{ color: '#333', marginBottom: '1rem' }}>Prediction</h2>

      <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.85rem', color: '#666' }}>
          Model: {prediction.model_version} | Agreement: {formatProb(prediction.model_agreement)}
        </div>
        {prediction.probable_score && (
          <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#333' }}>
            Probable score: <strong>{prediction.probable_score.home} - {prediction.probable_score.away}</strong>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <MarketSelector selected={selectedMarket} onChange={onMarketChange} availableMarkets={availableMarkets} />
      </div>

      <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
        <h3 style={{ margin: '0 0 0.75rem 0', color: '#333', fontSize: '1rem' }}>
          {selectedMarket.replace(/_/g, ' ')}
        </h3>
        <MarketRenderer market={selectedMarket} probabilities={prediction.probabilities} />
      </div>

      {prediction.top_features && prediction.top_features.length > 0 && (
        <div style={{ background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', color: '#333', fontSize: '1rem' }}>Top Features</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {prediction.top_features.map((f, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#666' }}>{f.feature.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 500 }}>{f.value.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

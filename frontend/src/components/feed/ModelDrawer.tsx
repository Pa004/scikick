import { useEffect, useState } from 'react'
import type { CalibrationData, MatchdayData, Stats } from '../../types'
import { fetchCalibration, fetchMatchdayStats, fetchStats } from '../../api'
import { useLanguage } from '../../i18n'
import StatsDashboard from '../StatsDashboard'
import { Button } from '../ui/button'
import { Drawer, DrawerContent } from '../ui/drawer'
import { Skeleton } from '../ui/skeleton'

// Model trust lives outside the story flow: a side drawer with its
// own data lifecycle. Open state is lifted so header tabs, the overflow
// menu and shortcuts can all open the same drawer.
export function ModelDrawer({ league, open, onOpenChange }: {
  league: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useLanguage()
  const [stats, setStats] = useState<Stats | null>(null)
  const [matchdayData, setMatchdayData] = useState<MatchdayData | null>(null)
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    let active = true
    setStats(null)
    setMatchdayData(null)
    setCalibrationData(null)
    setFailed(false)
    const scope = league || undefined
    Promise.all([
      fetchStats('1x2', scope),
      fetchMatchdayStats('1x2', scope),
      fetchCalibration('1x2', scope),
    ])
      .then(([s, m, c]) => {
        if (!active) return
        setStats(s)
        setMatchdayData(m)
        setCalibrationData(c)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [open, league, attempt])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title={t('modelTrust')}
        description={t('trustTitle')}
        closeLabel={t('close')}
      >
        {failed ? (
          <div role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger">
            <p className="mb-2">{t('matchError')}</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => setAttempt(a => a + 1)}>
              {t('retry')}
            </Button>
          </div>
        ) : stats ? (
          <StatsDashboard
            stats={stats}
            matchdayData={matchdayData}
            calibrationData={calibrationData}
            selectedMarket="1x2"
          />
        ) : (
          <div role="status" aria-label={t('loading')} className="flex flex-col gap-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}

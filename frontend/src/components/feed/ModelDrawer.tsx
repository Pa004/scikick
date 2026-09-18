import { useEffect, useState } from 'react'
import type { CalibrationData, MatchdayData, Stats } from '../../types'
import { fetchCalibration, fetchMatchdayStats, fetchStats } from '../../api'
import { useLanguage } from '../../i18n'
import { LEAGUES } from '../layout/LeagueSwitcher'
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
          closeLabel={t('close')}
        >
        <div className="mb-4">
          <h2 className="text-[26px] leading-tight font-bold text-foreground">{t('drawerHow')}</h2>
          <p className="mt-2 max-w-[65ch] text-[15px] text-muted">{t('drawerB1')}</p>
          <p className="mt-2 max-w-[65ch] text-[15px] text-muted">{t('drawerB2')}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface-alt px-3.5 py-2 text-sm font-bold text-foreground">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />
            {t('drawerCalib')}
          </p>
        </div>
        {failed ? (
          <div role="alert" className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
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
            scopeName={t(LEAGUES.find(l => l.code === league)?.labelKey ?? 'allLeagues')}
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

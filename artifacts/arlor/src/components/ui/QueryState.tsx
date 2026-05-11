import { ReactNode, useEffect, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type QueryStateProps<T> = {
  isLoading: boolean
  error: Error | null
  data: T | undefined | null
  loadingLabel?: string
  emptyLabel?: string
  loadingTimeoutMs?: number
  onRetry?: () => void
  isEmpty?: (data: T) => boolean
  children: (data: T) => ReactNode
}

export function QueryState<T>({
  isLoading,
  error,
  data,
  loadingLabel = 'Chargement...',
  emptyLabel = 'Aucun résultat',
  loadingTimeoutMs = 5000,
  onRetry,
  isEmpty,
  children,
}: QueryStateProps<T>) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setSlow(false)
      return
    }
    const t = setTimeout(() => setSlow(true), loadingTimeoutMs)
    return () => clearTimeout(t)
  }, [isLoading, loadingTimeoutMs])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">{loadingLabel}</p>
        {slow && (
          <p className="text-sm text-amber-500">
            Le chargement prend du temps. Vérifie ta connexion.
          </p>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-semibold">Erreur de chargement</p>
        <p className="text-sm text-muted-foreground max-w-md break-words">
          {error.message}
        </p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Réessayer
          </Button>
        )}
      </div>
    )
  }

  if (data === undefined || data === null) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  if (isEmpty && isEmpty(data)) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return <>{children(data)}</>
}

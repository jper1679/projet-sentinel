// =============================================================================
// Projet Sentinel — Utilitaire de formatage sécurisé des erreurs API / Pydantic
// =============================================================================

/**
 * Format n'importe quelle erreur backend ou exception (y compris les structures 422 de Pydantic)
 * sous forme de chaîne de caractères valide pour React JSX.
 */
export function formatErrorMessage(err: unknown, fallback = 'Une erreur est survenue.'): string {
  if (!err) return fallback

  // Si l'erreur est déjà un string
  if (typeof err === 'string') return err

  // Si c'est une objet AxiosError / response
  const responseData = (err as { response?: { data?: unknown } })?.response?.data

  if (responseData) {
    const detail = (responseData as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object') {
            const loc = Array.isArray(item.loc) ? item.loc.filter((l: any) => l !== 'body').join('.') : ''
            const msg = item.msg || item.message || JSON.stringify(item)
            return loc ? `${loc}: ${msg}` : msg
          }
          return String(item)
        })
        .join(', ')
    }
    if (detail && typeof detail === 'object') {
      return (detail as any).msg || (detail as any).message || JSON.stringify(detail)
    }
  }

  // Si c'est une instance de Error standard
  if (err instanceof Error) {
    return err.message
  }

  // Fallback si c'est un objet inconnu
  if (typeof err === 'object') {
    try {
      return JSON.stringify(err)
    } catch {
      return fallback
    }
  }

  return String(err)
}

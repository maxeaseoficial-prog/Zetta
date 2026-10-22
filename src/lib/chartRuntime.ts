type ChartRenderer = typeof import('./chartRenderer')

let loaded: ChartRenderer | null = null
let pending: Promise<ChartRenderer> | null = null

/** The pure layout helpers never import this engine. Only visible charts do. */
export function getLoadedChartRenderer(): ChartRenderer | null {
  return loaded
}

export function loadChartRenderer(): Promise<ChartRenderer> {
  if (loaded) return Promise.resolve(loaded)
  if (!pending) {
    pending = import('./chartRenderer')
      .then((module) => {
        loaded = module
        return module
      })
      .catch((error) => {
        pending = null
        throw error
      })
  }
  return pending
}

export interface Timing {
  name: string
  duration: number
  description?: string
}

export class Logger {
  private timers: Map<string, number> = new Map()
  private completedTimings: Map<string, Timing> = new Map()

  time(label: string): void {
    this.timers.set(label, performance.now())
  }

  timeEnd(label: string): void {
    const startTime = this.timers.get(label)
    if (startTime) {
      const elapsed = performance.now() - startTime
      // Ensure we always show at least 1ms for any measurable duration
      const duration = elapsed > 0 && elapsed < 1 ? 1 : Math.round(elapsed)
      console.log(`[TIMER] ${label}: ${duration}ms`)
      
      // Store completed timing
      const cleanLabel = label.replace(/^[a-z0-9]+ /, '') // Remove request ID prefix
      this.completedTimings.set(label, {
        name: cleanLabel.replace(/ /g, '-'),
        duration
      })
      
      this.timers.delete(label)
    }
  }

  getTimings(): Timing[] {
    return Array.from(this.completedTimings.values())
  }

  clearTimings(): void {
    this.completedTimings.clear()
  }

  // Generate Server-Timing header value
  getServerTimingHeader(): string {
    const timings = this.getTimings()
    return timings
      .map(t => {
        let value = t.name
        if (t.duration !== undefined) {
          value += `;dur=${t.duration}`
        }
        if (t.description) {
          value += `;desc="${t.description}"`
        }
        return value
      })
      .join(', ')
  }

  error(message: string, error?: any): void {
    console.error(`[ERROR] ${message}`, error)
  }

  log(message: string, ...args: any[]): void {
    console.log(`[LOG] ${message}`, ...args)
  }
}

// Create a singleton logger instance
export const logger = new Logger()

// Create scoped logger for request-specific timings
export function createRequestLogger(): Logger {
  return new Logger()
}
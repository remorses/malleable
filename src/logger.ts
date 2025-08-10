export class Logger {
  private timers: Map<string, number> = new Map()

  time(label: string): void {
    this.timers.set(label, Date.now())
  }

  timeEnd(label: string): void {
    const startTime = this.timers.get(label)
    if (startTime) {
      const duration = Date.now() - startTime
      console.log(`[TIMER] ${label}: ${duration}ms`)
      this.timers.delete(label)
    }
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
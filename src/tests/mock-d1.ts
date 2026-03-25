export interface D1Call {
  sql: string
  bindings: unknown[]
}

class MockD1Statement {
  private bindings: unknown[] = []

  constructor (
    private readonly sql: string,
    private readonly result: unknown,
    private readonly calls: D1Call[],
    private readonly matched: boolean
  ) {}

  bind (...args: unknown[]): this {
    this.bindings = args
    this.calls.push({ sql: this.sql, bindings: args })
    return this
  }

  async first<T> (): Promise<T | null> {
    return this.result as T | null
  }

  async run (): Promise<{ meta: { last_row_id: number, changes: number } }> {
    if (!this.matched) {
      throw new Error(`MockD1: no result registered for query: ${this.sql}`)
    }
    return this.result as { meta: { last_row_id: number, changes: number } }
  }

  async all (): Promise<{ results: unknown[] }> {
    if (!this.matched) {
      throw new Error(`MockD1: no result registered for query: ${this.sql}`)
    }
    return this.result as { results: unknown[] }
  }
}

export class MockD1Database {
  private responses: Array<{ fragment: string, result: unknown }> = []
  calls: D1Call[] = []

  onQuery (sqlFragment: string, result: unknown): void {
    this.responses.push({ fragment: sqlFragment, result })
  }

  prepare (sql: string): MockD1Statement {
    for (const { fragment, result } of this.responses) {
      if (sql.includes(fragment)) {
        return new MockD1Statement(sql, result, this.calls, true)
      }
    }
    return new MockD1Statement(sql, null, this.calls, false)
  }

  reset (): void {
    this.responses = []
    this.calls = []
  }
}

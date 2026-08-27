import { describe, expect, it } from 'vitest'
import { parseAnswerKeyCsv, validateAnswerKeys, type AdminAnswerKey } from './admin'
import type { Subject } from './data'

const subject = (overrides: Partial<Subject> = {}): Subject => ({
  id: 1,
  area: '사회탐구',
  name: '생활과 윤리',
  question_count: 20,
  duration_seconds: 1800,
  sort_order: 1,
  created_at: new Date(0).toISOString(),
  ...overrides,
})

describe('parseAnswerKeyCsv', () => {
  it('parses a header and rows', () => {
    expect(parseAnswerKeyCsv('question_number,answer,points\n1,3,5\n2,1,5')).toEqual([
      { question_number: 1, answer: '3', points: 5 },
      { question_number: 2, answer: '1', points: 5 },
    ])
  })

  it('rejects malformed rows', () => {
    expect(() => parseAnswerKeyCsv('question_number,answer,points\n1,3')).toThrow('열 개수')
  })
})

describe('validateAnswerKeys', () => {
  const validRows: AdminAnswerKey[] = Array.from({ length: 20 }, (_, index) => ({ question_number: index + 1, answer: String(index % 5 + 1), points: 5 }))

  it('accepts a complete 100-point answer key', () => {
    expect(validateAnswerKeys(subject(), validRows)).toBeNull()
  })

  it('rejects incomplete keys and invalid totals', () => {
    expect(validateAnswerKeys(subject(), validRows.slice(1))).toContain('20개')
    expect(validateAnswerKeys(subject(), validRows.map(row => ({ ...row, points: 4 })))).toContain('100점')
  })

  it('validates math short answers separately', () => {
    const math = subject({ area: '수학', name: '수학', question_count: 30 })
    const rows = Array.from({ length: 30 }, (_, index) => ({ question_number: index + 1, answer: index + 1 >= 16 && index + 1 <= 22 || index + 1 >= 29 ? '123' : '1', points: index < 10 ? 4 : 3 }))
    expect(validateAnswerKeys(math, rows)).toBeNull()
    rows[15].answer = '정답'
    expect(validateAnswerKeys(math, rows)).toContain('16번')
  })
})

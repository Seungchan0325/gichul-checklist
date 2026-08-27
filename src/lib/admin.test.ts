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
  const validRows: AdminAnswerKey[] = Array.from({ length: 20 }, (_, index) => ({ question_number: index + 1, answer: String(index % 5 + 1), points: index < 10 ? 2 : 3 }))

  it('accepts a complete 50-point inquiry answer key', () => {
    expect(validateAnswerKeys(subject(), validRows)).toBeNull()
  })

  it('rejects incomplete keys and invalid totals', () => {
    expect(validateAnswerKeys(subject(), validRows.slice(1))).toContain('20개')
    expect(validateAnswerKeys(subject(), validRows.map(row => ({ ...row, points: 2 })))).toContain('50점')
    expect(validateAnswerKeys(subject(), validRows.map(row => ({ ...row, points: 5 })))).toContain('2·3점')
  })

  it('validates math short answers separately', () => {
    const math = subject({ area: '수학', name: '수학', question_count: 30 })
    const rows = Array.from({ length: 30 }, (_, index) => ({ question_number: index + 1, answer: index + 1 >= 16 && index + 1 <= 22 || index + 1 >= 29 ? '123' : '1', points: index < 10 ? 4 : 3 }))
    expect(validateAnswerKeys(math, rows)).toBeNull()
    rows[15].answer = '정답'
    expect(validateAnswerKeys(math, rows)).toContain('16번')
  })

  it('applies the correct total and allowed points to each subject group', () => {
    const korean = subject({ area: '국어', name: '화법과 작문', question_count: 45 })
    const koreanRows = Array.from({ length: 45 }, (_, index) => ({ question_number: index + 1, answer: '1', points: index < 35 ? 2 : 3 }))
    expect(validateAnswerKeys(korean, koreanRows)).toBeNull()

    const secondLanguage = subject({ area: '제2외국어/한문', name: '독일어Ⅰ', question_count: 30 })
    const secondLanguageRows = Array.from({ length: 30 }, (_, index) => ({ question_number: index + 1, answer: '1', points: index < 10 ? 1 : 2 }))
    expect(validateAnswerKeys(secondLanguage, secondLanguageRows)).toBeNull()
    expect(validateAnswerKeys(secondLanguage, secondLanguageRows.map(row => ({ ...row, points: 2 })))).toContain('50점')
  })
})

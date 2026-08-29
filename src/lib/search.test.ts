import { describe, expect, it } from 'vitest'
import { searchExamItems } from './search'
import type { CategorizedExamItem } from './data'

const exam = (overrides: Partial<CategorizedExamItem> = {}) => ({
  id: 1, year: 2025, month: 3, title: '전국연합학력평가', examSubjectId: 1, subjectId: 1,
  question_pdf_path: null, explanation_pdf_path: null, is_development_data: false,
  subjectName: '화법과 작문', status: 'new', progress: 0, subject: { id: 1, area: '국어', name: '화법과 작문' }, ...overrides,
} as CategorizedExamItem)

describe('searchExamItems', () => {
  it('matches multiple whitespace-separated tokens', () => expect(searchExamItems([exam()], '2025 3 국어')).toHaveLength(1))
  it('matches year, month, and area independently', () => expect(searchExamItems([exam({ year: 2024 })], '2024 3 국어')).toHaveLength(1))
  it('matches any combination of year, month, and subject tokens', () => {
    const current = exam({ year: 2024 })
    expect(searchExamItems([current], '2024 국어')).toHaveLength(1)
    expect(searchExamItems([current], '2024 3')).toHaveLength(1)
    expect(searchExamItems([current], '2024년 3월 국어')).toHaveLength(1)
    expect(searchExamItems([exam({ year: 2023, month: 6 })], '2023 6')).toHaveLength(1)
  })
  it('matches standard subject aliases', () => expect(searchExamItems([exam()], '화작')).toHaveLength(1))
  it('matches roman numeral subject names with Arabic aliases', () => expect(searchExamItems([exam({ subjectId: 19, subject: { id: 19, area: '과학탐구', name: '화학Ⅱ', created_at: '', duration_seconds: 1800, question_count: 20, sort_order: 19 } })], '화2')).toHaveLength(1))
  it('requires every token to match', () => expect(searchExamItems([exam()], '2024 6')).toHaveLength(0))
  it('matches an area exactly without leaking into similarly named areas', () => {
    const german = exam({ subjectId: 31, subject: { id: 31, area: '제2외국어/한문', name: '독일어Ⅰ', created_at: '', duration_seconds: 2400, question_count: 30, sort_order: 31 } })
    const hanmun = exam({ subjectId: 39, subject: { id: 39, area: '제2외국어/한문', name: '한문Ⅰ', created_at: '', duration_seconds: 2400, question_count: 30, sort_order: 39 } })
    expect(searchExamItems([exam(), german, hanmun], '국어')).toEqual([exam()])
    expect(searchExamItems([german, hanmun], '한문')).toEqual([hanmun])
  })
  it('returns no results for an empty query', () => expect(searchExamItems([exam()], '   ')).toHaveLength(0))
})

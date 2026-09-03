import { describe, expect, it } from 'vitest'
import { createExamPdfUrl } from './data'

describe('createExamPdfUrl', () => {
  it('creates an encoded public PDF URL', () => {
    expect(createExamPdfUrl('exams/1/subjects/2/문제.pdf')).toBe('/pdfs/exams/1/subjects/2/%EB%AC%B8%EC%A0%9C.pdf')
  })

  it('rejects unsafe paths', () => {
    expect(() => createExamPdfUrl('../secret.pdf')).toThrow('올바르지 않습니다')
    expect(() => createExamPdfUrl('/absolute.pdf')).toThrow('올바르지 않습니다')
    expect(() => createExamPdfUrl('exams\\secret.pdf')).toThrow('올바르지 않습니다')
  })
})

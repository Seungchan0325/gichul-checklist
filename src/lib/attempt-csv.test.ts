import { describe, expect, it } from 'vitest'
import { attemptCsvFileName, createAttemptCsv } from './attempt-csv'

describe('attempt CSV', () => {
  const input = {
    year: 2022,
    month: 3,
    title: '3월 학평, 서울',
    subjectName: '물리학Ⅰ',
    roundNumber: 2,
    questionCount: 4,
    answers: { 1: 2, 2: 5, 3: 1 },
    answerKeys: [
      { question_number: 1, answer: '2', points: 2 },
      { question_number: 2, answer: '1,2,3,4,5', points: 3 },
      { question_number: 3, answer: '4', points: 3 },
      { question_number: 4, answer: '1', points: 3 },
    ],
  }

  it('정답, 복수 정답, 미응답을 문항별로 기록한다', () => {
    const csv = createAttemptCsv(input)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"정답"')
    expect(csv).toContain('"오답"')
    expect(csv).toContain('"미응답"')
    expect(csv).toContain('"1,2,3,4,5"')
    expect(csv).toContain('"2회독"')
  })

  it('CSV 값의 따옴표와 쉼표를 안전하게 이스케이프한다', () => {
    expect(createAttemptCsv({ ...input, title: '"쉼표, 시험"' })).toContain('"""쉼표, 시험"""')
  })

  it('파일명에 사용할 수 없는 문자를 제거한다', () => {
    expect(attemptCsvFileName({ ...input, title: '3/6: 모평?' })).toBe('2022-03_3_6__모평__물리학Ⅰ_2회독_정오분석.csv')
  })
})

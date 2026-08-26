import { describe, expect, it } from 'vitest'
import { answeredCount, expectedQuestionCount, getAttemptStatus, isMathShortAnswer, scoreAnswers } from './exam'

describe('exam rules', () => {
  it.each([
    ['국어', 45], ['영어', 45], ['수학', 30], ['제2외국어/한문', 30],
    ['한국사', 20], ['사회탐구', 20], ['과학탐구', 20], ['직업탐구', 20],
  ])('%s 문항 수는 %i개다', (area, count) => {
    expect(expectedQuestionCount(area)).toBe(count)
  })

  it('수학의 객관식과 단답형 구간을 구분한다', () => {
    expect(isMathShortAnswer('수학', 15)).toBe(false)
    expect(isMathShortAnswer('수학', 16)).toBe(true)
    expect(isMathShortAnswer('수학', 22)).toBe(true)
    expect(isMathShortAnswer('수학', 23)).toBe(false)
    expect(isMathShortAnswer('수학', 29)).toBe(true)
    expect(isMathShortAnswer('국어', 16)).toBe(false)
  })
})

describe('grading', () => {
  const keys = [
    { question_number: 1, answer: '2', points: 2 },
    { question_number: 2, answer: '15', points: 4 },
    { question_number: 3, answer: '4', points: 3 },
  ]

  it('정답 문항의 배점만 합산한다', () => {
    expect(scoreAnswers({ 1: 2, 2: '15', 3: 1 }, keys)).toBe(6)
  })

  it('빈 문자열은 응답한 문항에서 제외한다', () => {
    expect(answeredCount({ 1: 2, 2: '', 3: '15' })).toBe(2)
  })

  it('채점하면 미응답 문항이 있어도 완료 상태가 된다', () => {
    expect(getAttemptStatus(0, 3, false)).toBe('new')
    expect(getAttemptStatus(1, 3, false)).toBe('doing')
    expect(getAttemptStatus(0, 3, true)).toBe('done')
    expect(getAttemptStatus(1, 3, true)).toBe('done')
    expect(getAttemptStatus(3, 3, false)).toBe('doing')
    expect(getAttemptStatus(3, 3, true)).toBe('done')
  })
})

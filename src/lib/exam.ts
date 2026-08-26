export type AnswerValue = number | string
export type AnswerMap = Record<number, AnswerValue>
export type AnswerKey = { question_number: number; answer: string; points: number }

export const expectedQuestionCount = (area: string) => {
  if (area === '국어' || area === '영어') return 45
  if (area === '수학' || area === '제2외국어/한문') return 30
  return 20
}

export const isMathShortAnswer = (area: string, number: number) =>
  area === '수학' && ((number >= 16 && number <= 22) || number >= 29)

export function scoreAnswers(answers: AnswerMap, answerKeys: AnswerKey[]) {
  return answerKeys.reduce((score, key) => (
    String(answers[key.question_number] ?? '').trim() === key.answer.trim()
      ? score + key.points
      : score
  ), 0)
}

export function getAttemptStatus(answeredCount: number, questionCount: number, graded: boolean) {
  if (graded) return 'done' as const
  if (answeredCount === 0) return 'new' as const
  return 'doing' as const
}

export function answeredCount(answers: AnswerMap) {
  return Object.values(answers).filter(answer => String(answer).trim() !== '').length
}

export function parseAnswers(value: unknown): AnswerMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([, answer]) => typeof answer === 'string' || typeof answer === 'number'),
  ) as AnswerMap
}

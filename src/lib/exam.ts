export type AnswerValue = number | string
export type AnswerMap = Record<number, AnswerValue>
export type AnswerKey = { question_number: number; answer: string; points: number }

export const expectedQuestionCount = (area: string) => {
  if (area === '국어' || area === '영어') return 45
  if (area === '수학' || area === '제2외국어/한문') return 30
  return 20
}

export type ScoreRule = { total: number; allowedPoints: number[] }

export const scoreRuleForArea = (area: string): ScoreRule => {
  if (area === '수학') return { total: 100, allowedPoints: [2, 3, 4] }
  if (area === '국어' || area === '영어') return { total: 100, allowedPoints: [2, 3] }
  if (area === '제2외국어/한문') return { total: 50, allowedPoints: [1, 2] }
  return { total: 50, allowedPoints: [2, 3] }
}

export const isMathShortAnswer = (area: string, number: number) =>
  area === '수학' && ((number >= 16 && number <= 22) || number >= 29)

export function acceptedAnswers(answer: string) {
  return answer.split(/[\s,|/]+/).map(value => value.trim()).filter(Boolean)
}

export function isAnswerCorrect(answer: AnswerValue | undefined, answerKey: string) {
  const submitted = String(answer ?? '').trim()
  return submitted !== '' && acceptedAnswers(answerKey).includes(submitted)
}

export function scoreAnswers(answers: AnswerMap, answerKeys: AnswerKey[]) {
  return answerKeys.reduce((score, key) => (
    isAnswerCorrect(answers[key.question_number], key.answer)
      ? score + key.points
      : score
  ), 0)
}

export function getAttemptStatus(answeredCount: number, questionCount: number, graded: boolean, timerStarted = false) {
  if (graded) return 'done' as const
  return timerStarted || answeredCount > 0 ? 'doing' as const : 'new' as const
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

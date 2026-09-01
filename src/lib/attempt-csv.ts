import { isAnswerCorrect, type AnswerKey, type AnswerMap } from './exam'

type AttemptCsvInput = {
  year: number
  month: number
  title: string
  subjectName: string
  roundNumber: number
  questionCount: number
  answers: AnswerMap
  answerKeys: AnswerKey[]
}

const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`

export function createAttemptCsv(input: AttemptCsvInput) {
  const keys = new Map(input.answerKeys.map(key => [key.question_number, key]))
  const rows = Array.from({ length: input.questionCount }, (_, index) => {
    const questionNumber = index + 1
    const key = keys.get(questionNumber)
    const answer = String(input.answers[questionNumber] ?? '').trim()
    const result = !answer ? '미응답' : key && isAnswerCorrect(answer, key.answer) ? '정답' : '오답'
    return [input.year, input.month, input.title, input.subjectName, `${input.roundNumber}회독`, questionNumber, answer, key?.answer ?? '', result, key?.points ?? '']
  })
  return `\uFEFF${[['시험연도', '시험월', '시험명', '과목', '회독', '문항번호', '내 답', '정답', '판정', '배점'], ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n')}`
}

export function attemptCsvFileName(input: Pick<AttemptCsvInput, 'year' | 'month' | 'title' | 'subjectName' | 'roundNumber'>) {
  const safe = `${input.year}-${String(input.month).padStart(2, '0')}_${input.title}_${input.subjectName}_${input.roundNumber}회독`
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
  return `${safe}.csv`
}

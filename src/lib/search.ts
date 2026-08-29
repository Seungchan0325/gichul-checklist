import type { CategorizedExamItem } from './data'

const aliases: Record<string, string[]> = {
  '화법과 작문': ['화작'], '언어와 매체': ['언매'], '확률과 통계': ['확통'], 미적분: ['미적'], 기하: ['기하'],
  '생활과 윤리': ['생윤'], '윤리와 사상': ['윤사'], 한국지리: ['한지'], 세계지리: ['세지'], 동아시아사: ['동사'], 세계사: ['세사'], '정치와 법': ['정법'], '사회·문화': ['사문', '사회문화'],
  '물리학Ⅰ': ['물1', '물리1'], '물리학Ⅱ': ['물2', '물리2'], '화학Ⅰ': ['화1', '화학1'], '화학Ⅱ': ['화2', '화학2'], '생명과학Ⅰ': ['생1', '생명1'], '생명과학Ⅱ': ['생2', '생명2'], '지구과학Ⅰ': ['지1', '지구1'], '지구과학Ⅱ': ['지2', '지구2'],
  '농업 기초 기술': ['농기'], '공업 일반': ['공일'], '상업 경제': ['상경'], '수산·해운 산업 기초': ['수산'], '인간 발달': ['인발'], '성공적인 직업 생활': ['성직'],
}

const normalize = (value: string) => value.toLocaleLowerCase('ko-KR').replace(/[ⅠⅡⅢⅣⅤ]/g, numeral => ({ 'Ⅰ': '1', 'Ⅱ': '2', 'Ⅲ': '3', 'Ⅳ': '4', 'Ⅴ': '5' })[numeral] ?? numeral).replace(/[·・]/g, '').replace(/\s+/g, ' ').trim()
const normalizeToken = (token: string) => token.replace(/^(\d{1,4})(년|월)$/, '$1')

export function searchExamItems(exams: CategorizedExamItem[], query: string) {
  const tokens = normalize(query).split(/[^\p{L}\p{N}]+/u).map(normalizeToken).filter(Boolean)
  if (!tokens.length) return []
  return exams.filter(exam => {
    const subjectAliases = aliases[exam.subject.name] ?? []
    const area = normalize(exam.subject.area)
    const fields = [String(exam.year), String(exam.month), exam.title, exam.subject.name, ...subjectAliases].map(normalize)
    return tokens.every(token => area === token || fields.some(field => field.includes(token)))
  })
}

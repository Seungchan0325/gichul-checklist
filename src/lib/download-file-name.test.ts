import { describe, expect, it } from 'vitest'
import { createDownloadFileName } from './download-file-name'

describe('download file names', () => {
  it('문제와 해설 PDF에 시험 정보를 모두 포함한다', () => {
    const shared = { year: 2022, month: 3, title: '3월 학평 서울', subjectName: '물리학Ⅰ', extension: 'pdf' as const }
    expect(createDownloadFileName({ ...shared, kind: '문제' })).toBe('2022-03_3월_학평_서울_물리학Ⅰ_문제.pdf')
    expect(createDownloadFileName({ ...shared, kind: '정답및해설' })).toBe('2022-03_3월_학평_서울_물리학Ⅰ_정답및해설.pdf')
  })

  it('CSV에는 회독과 정오 분석 종류를 포함한다', () => {
    expect(createDownloadFileName({ year: 2022, month: 3, title: '3월 학평', subjectName: '물리학Ⅰ', roundNumber: 2, kind: '정오분석', extension: 'csv' })).toBe('2022-03_3월_학평_물리학Ⅰ_2회독_정오분석.csv')
  })

  it('파일명에 쓸 수 없는 문자를 치환한다', () => {
    expect(createDownloadFileName({ year: 2022, month: 3, title: '3/6: 모평?', subjectName: '물리학Ⅰ', kind: '문제', extension: 'pdf' })).toBe('2022-03_3_6__모평__물리학Ⅰ_문제.pdf')
  })
})

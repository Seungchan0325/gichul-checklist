export type DownloadKind = '문제' | '정답및해설' | '정오분석'

type DownloadFileNameInput = {
  year: number
  month: number
  title: string
  subjectName: string
  kind: DownloadKind
  extension: 'pdf' | 'csv'
  roundNumber?: number
}

const safeFilePart = (value: string) => value
  .replace(/[\\/:*?"<>|]/g, '_')
  .replace(/\s+/g, '_')

export function createDownloadFileName(input: DownloadFileNameInput) {
  const parts = [
    `${input.year}-${String(input.month).padStart(2, '0')}`,
    input.title,
    input.subjectName,
    ...(input.roundNumber ? [`${input.roundNumber}회독`] : []),
    input.kind,
  ]
  return `${parts.map(safeFilePart).join('_')}.${input.extension}`
}

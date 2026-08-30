import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { AnswerMap } from './exam'
import type { Database, Json } from '../types/database.generated'

export type Subject = Database['public']['Tables']['subjects']['Row']
export type Attempt = Database['public']['Tables']['attempts']['Row']
export type ExamRecord = Database['public']['Tables']['exams']['Row']

export type ExamListItem = Omit<ExamRecord, 'status'> & {
  examSubjectId: number
  subjectId: number
  question_pdf_path: string | null
  explanation_pdf_path: string | null
  subjectName?: string
  status: 'new' | 'doing' | 'done'
  score?: number
  progress: number
  attempt?: Attempt
}

export type AttemptedExamItem = ExamListItem & { subject: Subject }
export type CategorizedExamItem = ExamListItem & { subject: Subject }

export type BootstrapData = {
  subjects: Subject[]
  shortcutSubjectIds: number[]
  displayName: string
  theme: string
}

type CategorizedExamSubjectLink = {
  id: number
  subject_id: number
  question_pdf_path: string | null
  explanation_pdf_path: string | null
  exams: ExamRecord
  subjects: Subject
}

const examSubjectPageSize = 1000

const client = () => {
  if (!supabase) throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
  return supabase
}

export async function loadBootstrap(user: User): Promise<BootstrapData> {
  const db = client()
  const [subjectsResult, shortcutsResult, profileResult] = await Promise.all([
    db.from('subjects').select('*').order('sort_order'),
    db.from('user_shortcuts').select('subject_id').eq('user_id', user.id),
    db.from('profiles').select('display_name, theme').eq('id', user.id).maybeSingle(),
  ])
  const error = subjectsResult.error ?? shortcutsResult.error ?? profileResult.error
  if (error) throw error

  return {
    subjects: subjectsResult.data ?? [],
    shortcutSubjectIds: (shortcutsResult.data ?? []).map(row => row.subject_id),
    displayName: profileResult.data?.display_name ?? user.email?.split('@')[0] ?? '수험생',
    theme: profileResult.data?.theme ?? 'system',
  }
}

export async function loadExamsForSubject(userId: string, subjectId: number) {
  const db = client()
  const [linksResult, attemptsResult] = await Promise.all([
    db.from('exam_subjects').select('id, exam_id, subject_id, question_pdf_path, explanation_pdf_path, exams(*)').eq('subject_id', subjectId),
    db.from('attempts').select('*').eq('user_id', userId),
  ])
  if (linksResult.error) throw linksResult.error
  if (attemptsResult.error) throw attemptsResult.error
  const attempts = new Map((attemptsResult.data ?? []).map(attempt => [attempt.exam_subject_id, attempt]))
  const links = (linksResult.data ?? []) as unknown as Array<{ id: number; exam_id: number; subject_id: number; question_pdf_path: string | null; explanation_pdf_path: string | null; exams: ExamRecord }>
  return links.map(link => {
    const attempt = attempts.get(link.id)
    const rawAnswers = attempt?.answers && typeof attempt.answers === 'object' && !Array.isArray(attempt.answers) ? attempt.answers : {}
    return { ...link.exams, examSubjectId: link.id, subjectId, question_pdf_path: link.question_pdf_path, explanation_pdf_path: link.explanation_pdf_path, status: attempt?.status ?? 'new', score: attempt?.score ?? undefined, progress: Object.values(rawAnswers).filter(value => String(value).trim()).length, attempt } as ExamListItem
  }).sort((a, b) => b.year - a.year || a.month - b.month)
}

export async function loadAttemptedExams(userId: string): Promise<AttemptedExamItem[]> {
  const result = await client()
    .from('attempts')
    .select('*, exam_subjects(id, subject_id, question_pdf_path, explanation_pdf_path, exams(*), subjects(*))')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (result.error) throw result.error

  const attempts = (result.data ?? []) as unknown as Array<Attempt & {
    exam_subjects: { id: number; subject_id: number; question_pdf_path: string | null; explanation_pdf_path: string | null; exams: ExamRecord; subjects: Subject } | null
  }>
  return attempts.flatMap(attempt => {
    const link = attempt.exam_subjects
    if (!link?.exams || !link.subjects) return []
    const rawAnswers = attempt.answers && typeof attempt.answers === 'object' && !Array.isArray(attempt.answers) ? attempt.answers : {}
    return [{
      ...link.exams,
      examSubjectId: link.id,
      subjectId: link.subject_id,
      question_pdf_path: link.question_pdf_path,
      explanation_pdf_path: link.explanation_pdf_path,
      subjectName: link.subjects.name,
      subject: link.subjects,
      status: attempt.status,
      score: attempt.score ?? undefined,
      progress: Object.values(rawAnswers).filter(value => String(value).trim()).length,
      attempt,
    }]
  })
}

export async function loadAllExamSubjects(userId: string): Promise<CategorizedExamItem[]> {
  const db = client()
  const [links, attemptsResult] = await Promise.all([
    loadAllExamSubjectLinks(),
    db.from('attempts').select('*').eq('user_id', userId),
  ])
  if (attemptsResult.error) throw attemptsResult.error

  const attempts = new Map((attemptsResult.data ?? []).map(attempt => [attempt.exam_subject_id, attempt]))
  return links.flatMap(link => {
    if (!link.exams || !link.subjects) return []
    const attempt = attempts.get(link.id)
    const rawAnswers = attempt?.answers && typeof attempt.answers === 'object' && !Array.isArray(attempt.answers) ? attempt.answers : {}
    return [{
      ...link.exams,
      examSubjectId: link.id,
      subjectId: link.subject_id,
      question_pdf_path: link.question_pdf_path,
      explanation_pdf_path: link.explanation_pdf_path,
      subjectName: link.subjects.name,
      subject: link.subjects,
      status: attempt?.status ?? 'new',
      score: attempt?.score ?? undefined,
      progress: Object.values(rawAnswers).filter(value => String(value).trim()).length,
      attempt,
    }]
  }).sort((a, b) => b.year - a.year || b.month - a.month || a.subject.sort_order - b.subject.sort_order)
}

async function loadAllExamSubjectLinks(): Promise<CategorizedExamSubjectLink[]> {
  const db = client()
  const links: CategorizedExamSubjectLink[] = []
  for (let from = 0; ; from += examSubjectPageSize) {
    const result = await db.from('exam_subjects')
      .select('id, subject_id, question_pdf_path, explanation_pdf_path, exams(*), subjects(*)')
      .order('id', { ascending: true })
      .range(from, from + examSubjectPageSize - 1)
    if (result.error) throw result.error
    const page = (result.data ?? []) as unknown as CategorizedExamSubjectLink[]
    links.push(...page)
    if (page.length < examSubjectPageSize) return links
  }
}

export async function saveAttempt(userId: string, examSubjectId: number, values: {
  answers: AnswerMap
  status: 'new' | 'doing' | 'done'
  score?: number | null
  remainingSeconds?: number | null
  gradedAt?: string | null
}) {
  const result = await client().from('attempts').upsert({
    user_id: userId,
    exam_subject_id: examSubjectId,
    answers: values.answers as unknown as Json,
    status: values.status,
    ...(values.score !== undefined ? { score: values.score } : {}),
    ...(values.remainingSeconds !== undefined ? { remaining_seconds: values.remainingSeconds } : {}),
    ...(values.gradedAt !== undefined ? { graded_at: values.gradedAt } : {}),
  }, { onConflict: 'user_id,exam_subject_id' }).select().single()
  if (result.error) throw result.error
  return result.data
}

export async function loadAnswerKeys(examSubjectId: number) {
  const result = await client().from('answer_keys').select('question_number, answer, points').eq('exam_subject_id', examSubjectId).order('question_number')
  if (result.error) throw result.error
  return result.data
}

export type AnswerKeyIssueType = 'answer' | 'points' | 'both' | 'other'

export async function createAnswerKeyReport(userId: string, values: {
  examSubjectId: number
  questionNumber: number
  issueType: AnswerKeyIssueType
  details: string
}) {
  const result = await client().from('answer_key_reports').insert({
    reporter_user_id: userId,
    exam_subject_id: values.examSubjectId,
    question_number: values.questionNumber,
    issue_type: values.issueType,
    details: values.details.trim(),
  })
  if (result.error?.code === '23505') throw new Error('이 문항에 대해 이미 확인 중인 제보가 있습니다.')
  if (result.error) throw result.error
}


export async function toggleShortcut(userId: string, subjectId: number, enabled: boolean) {
  const result = enabled
    ? await client().from('user_shortcuts').insert({ user_id: userId, subject_id: subjectId })
    : await client().from('user_shortcuts').delete().eq('user_id', userId).eq('subject_id', subjectId)
  if (result.error) throw result.error
}

export async function saveTheme(userId: string, theme: 'light' | 'dark') {
  const result = await client().from('profiles').update({ theme }).eq('id', userId)
  if (result.error) throw result.error
}

/** Permanently deletes the currently authenticated user's account. */
export async function deleteAccount() {
  const result = await client().functions.invoke('delete-account')
  if (result.error) {
    const response = (result.error as { context?: unknown }).context
    if (response instanceof Response) {
      const body = await response.json().catch(() => null) as { error?: string; message?: string } | null
      if (body?.error || body?.message) throw new Error(body.error ?? body.message)
    }
    throw result.error
  }
}

export async function createExamPdfUrl(path: string) {
  const result = await client().storage.from('exam-pdfs').createSignedUrl(path, 60 * 10)
  if (result.error) throw result.error
  return result.data.signedUrl
}

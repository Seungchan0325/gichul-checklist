import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { AnswerMap } from './exam'
import type { Database, Json } from '../types/database.generated'

export type Subject = Database['public']['Tables']['subjects']['Row']
export type Attempt = Database['public']['Tables']['attempts']['Row']
export type ExamRecord = Database['public']['Tables']['exams']['Row']

export type ExamListItem = ExamRecord & {
  examSubjectId: number
  subjectId: number
  subjectName?: string
  status: 'new' | 'doing' | 'done'
  score?: number
  progress: number
  attempt?: Attempt
}

export type AttemptedExamItem = ExamListItem & { subject: Subject }

export type BootstrapData = {
  subjects: Subject[]
  shortcutSubjectIds: number[]
  displayName: string
  theme: string
}

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
    db.from('exam_subjects').select('id, exam_id, subject_id, exams(*)').eq('subject_id', subjectId),
    db.from('attempts').select('*').eq('user_id', userId),
  ])
  if (linksResult.error) throw linksResult.error
  if (attemptsResult.error) throw attemptsResult.error
  const attempts = new Map((attemptsResult.data ?? []).map(attempt => [attempt.exam_subject_id, attempt]))
  const links = (linksResult.data ?? []) as unknown as Array<{ id: number; exam_id: number; subject_id: number; exams: ExamRecord }>
  return links.map(link => {
    const attempt = attempts.get(link.id)
    const rawAnswers = attempt?.answers && typeof attempt.answers === 'object' && !Array.isArray(attempt.answers) ? attempt.answers : {}
    return { ...link.exams, examSubjectId: link.id, subjectId, status: attempt?.status ?? 'new', score: attempt?.score ?? undefined, progress: Object.values(rawAnswers).filter(value => String(value).trim()).length, attempt } as ExamListItem
  }).sort((a, b) => b.year - a.year || a.month - b.month)
}

export async function loadAttemptedExams(userId: string): Promise<AttemptedExamItem[]> {
  const result = await client()
    .from('attempts')
    .select('*, exam_subjects(id, subject_id, exams(*), subjects(*))')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (result.error) throw result.error

  const attempts = (result.data ?? []) as unknown as Array<Attempt & {
    exam_subjects: { id: number; subject_id: number; exams: ExamRecord; subjects: Subject } | null
  }>
  return attempts.flatMap(attempt => {
    const link = attempt.exam_subjects
    if (!link?.exams || !link.subjects) return []
    const rawAnswers = attempt.answers && typeof attempt.answers === 'object' && !Array.isArray(attempt.answers) ? attempt.answers : {}
    return [{
      ...link.exams,
      examSubjectId: link.id,
      subjectId: link.subject_id,
      subjectName: link.subjects.name,
      subject: link.subjects,
      status: attempt.status,
      score: attempt.score ?? undefined,
      progress: Object.values(rawAnswers).filter(value => String(value).trim()).length,
      attempt,
    }]
  })
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

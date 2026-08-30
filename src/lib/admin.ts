import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Database, Json } from '../types/database.generated'
import type { Subject } from './data'
import { acceptedAnswers, isMathShortAnswer, scoreRuleForArea } from './exam'

type Exam = Database['public']['Tables']['exams']['Row']
type ExamSubject = Database['public']['Tables']['exam_subjects']['Row']
export type AdminAnswerKey = Pick<Database['public']['Tables']['answer_keys']['Row'], 'question_number' | 'answer' | 'points'>
export type AdminAuditLog = Database['public']['Tables']['admin_audit_logs']['Row']
type AnswerKeyReport = Database['public']['Tables']['answer_key_reports']['Row']
type ManagedExamSubjectRow = ExamSubject & { exams: Exam; subjects: Subject; answer_keys: AdminAnswerKey[]; attempts: Array<{ id: string }> }

const examSubjectPageSize = 1000

export type ManagedExamSubject = ExamSubject & {
  exam: Exam
  subject: Subject
  answerKeys: AdminAnswerKey[]
  attemptCount: number
}

export type AdminAnswerKeyReport = AnswerKeyReport & {
  examSubject: { id: number; exam: Exam; subject: Subject }
}

const client = () => {
  if (!supabase) throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
  return supabase
}

const audit = async (userId: string, action: string, examId: number, details: Json = {}) => {
  const result = await client().from('admin_audit_logs').insert({ admin_user_id: userId, action, exam_id: examId, details })
  if (result.error) throw result.error
}

export async function isAdmin(userId: string) {
  const result = await client().from('admin_users').select('user_id').eq('user_id', userId).maybeSingle()
  if (result.error) throw result.error
  return Boolean(result.data)
}

export async function loadManagedExamSubjects(): Promise<ManagedExamSubject[]> {
  const rows: ManagedExamSubjectRow[] = []
  for (let from = 0; ; from += examSubjectPageSize) {
    const result = await client().from('exam_subjects')
      .select('*, exams(*), subjects(*), answer_keys(question_number, answer, points), attempts(id)')
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + examSubjectPageSize - 1)
    if (result.error) throw result.error
    const page = (result.data ?? []) as unknown as ManagedExamSubjectRow[]
    rows.push(...page)
    if (page.length < examSubjectPageSize) break
  }
  return rows.map(({ exams, subjects, answer_keys, attempts, ...link }) => ({ ...link, exam: exams, subject: subjects, answerKeys: answer_keys.sort((a, b) => a.question_number - b.question_number), attemptCount: attempts.length }))
}

export async function loadAdminAuditLogs(): Promise<AdminAuditLog[]> {
  const result = await client().from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(50)
  if (result.error) throw result.error
  return result.data
}

export async function loadOpenAnswerKeyReports(): Promise<AdminAnswerKeyReport[]> {
  const result = await client().from('answer_key_reports')
    .select('*, exam_subjects(id, exams(*), subjects(*))')
    .eq('status', 'open')
    .order('created_at', { ascending: true })
    .limit(100)
  if (result.error) throw result.error
  const rows = result.data as unknown as Array<AnswerKeyReport & { exam_subjects: { id: number; exams: Exam; subjects: Subject } }>
  return rows.map(({ exam_subjects, ...report }) => ({ ...report, examSubject: { id: exam_subjects.id, exam: exam_subjects.exams, subject: exam_subjects.subjects } }))
}

export async function closeAnswerKeyReport(user: User, report: AdminAnswerKeyReport, status: 'resolved' | 'dismissed') {
  const result = await client().from('answer_key_reports').update({ status, resolved_by: user.id, resolved_at: new Date().toISOString() }).eq('id', report.id).eq('status', 'open')
  if (result.error) throw result.error
  await audit(user.id, `${status}_answer_key_report`, report.examSubject.exam.id, { report_id: report.id, exam_subject_id: report.exam_subject_id, question_number: report.question_number })
  const notification = await client().functions.invoke('notify-answer-key-report', { body: { reportId: report.id, status } })
  if (notification.error) {
    let detail = notification.error.message
    const response = 'context' in notification.error ? (notification.error as { context?: unknown }).context : undefined
    if (response && typeof (response as { clone?: unknown }).clone === 'function') { const body = await (response as Response).clone().json().catch(() => null) as { error?: string } | null; if (body?.error) detail = body.error }
    throw new Error(detail)
  }
  if (!notification.data?.sent) throw new Error('제보 처리 메일을 발송하지 못했습니다.')
}

export async function createManagedExamSubject(user: User, values: { year: number; month: number; title: string; isDevelopmentData: boolean; subjectId: number }) {
  const db = client()
  const existing = await db.from('exams').select('*').eq('year', values.year).eq('month', values.month).eq('title', values.title.trim()).maybeSingle()
  if (existing.error) throw existing.error
  let exam = existing.data
  let createdExam = false
  if (!exam) {
    const examResult = await db.from('exams').insert({ year: values.year, month: values.month, title: values.title.trim(), is_development_data: values.isDevelopmentData, status: 'draft' }).select().single()
    if (examResult.error) throw examResult.error
    exam = examResult.data; createdExam = true
  }
  const linkResult = await db.from('exam_subjects').insert({ exam_id: exam.id, subject_id: values.subjectId, status: 'draft' }).select().single()
  if (linkResult.error) {
    if (createdExam) await db.from('exams').delete().eq('id', exam.id)
    throw linkResult.error
  }
  await audit(user.id, 'create_exam_subject', exam.id, { exam_subject_id: linkResult.data.id, subject_id: values.subjectId, year: values.year, month: values.month, title: values.title.trim() })
  return linkResult.data.id
}

export async function updateManagedExamSubject(user: User, item: ManagedExamSubject, values: { year: number; month: number; title: string; isDevelopmentData: boolean }) {
  const result = await client().from('exams').update({ year: values.year, month: values.month, title: values.title.trim(), is_development_data: values.isDevelopmentData }).eq('id', item.exam_id)
  if (result.error) throw result.error
  await audit(user.id, 'update_exam_subject_metadata', item.exam_id, { exam_subject_id: item.id, subject_id: item.subject_id, ...values })
}

export function validateAnswerKeys(subject: Subject, rows: AdminAnswerKey[]) {
  const scoreRule = scoreRuleForArea(subject.area)
  if (rows.length !== subject.question_count) return `${subject.question_count}개 문항을 모두 입력해 주세요.`
  const numbers = new Set(rows.map(row => row.question_number))
  if (numbers.size !== subject.question_count || rows.some(row => row.question_number < 1 || row.question_number > subject.question_count)) return '문항 번호가 중복되었거나 범위를 벗어났습니다.'
  for (const row of rows) {
    const answers = acceptedAnswers(row.answer)
    const validAnswer = isMathShortAnswer(subject.area, row.question_number)
      ? answers.length === 1 && /^\d{1,3}$/.test(answers[0])
      : answers.length > 0 && answers.every(answer => /^[1-5]$/.test(answer)) && new Set(answers).size === answers.length
    if (!validAnswer) return `${row.question_number}번 정답 형식이 올바르지 않습니다.`
    if (!scoreRule.allowedPoints.includes(row.points)) return `${row.question_number}번 배점은 ${scoreRule.allowedPoints.join('·')}점만 사용할 수 있습니다.`
  }
  if (rows.reduce((sum, row) => sum + row.points, 0) !== scoreRule.total) return `배점 합계가 ${scoreRule.total}점이어야 합니다.`
  return null
}

export function parseAnswerKeyCsv(csv: string): AdminAnswerKey[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const start = lines[0].toLowerCase().replace(/\s/g, '') === 'question_number,answer,points' ? 1 : 0
  return lines.slice(start).map((line, index) => {
    const columns = line.split(',').map(value => value.trim())
    if (columns.length !== 3) throw new Error(`${index + start + 1}행의 열 개수가 올바르지 않습니다.`)
    const questionNumber = Number(columns[0]); const points = Number(columns[2])
    if (!Number.isInteger(questionNumber) || !Number.isInteger(points)) throw new Error(`${index + start + 1}행에 숫자가 아닌 값이 있습니다.`)
    return { question_number: questionNumber, answer: columns[1], points }
  })
}

export async function saveManagedAnswerKeys(user: User, item: ManagedExamSubject, rows: AdminAnswerKey[]) {
  const validationError = validateAnswerKeys(item.subject, rows)
  if (validationError) throw new Error(validationError)
  const db = client()
  const deleteResult = await db.from('answer_keys').delete().eq('exam_subject_id', item.id)
  if (deleteResult.error) throw deleteResult.error
  const insertResult = await db.from('answer_keys').insert(rows.map(row => ({ ...row, exam_subject_id: item.id })))
  if (insertResult.error) throw insertResult.error
  await audit(user.id, 'update_answer_keys', item.exam_id, { exam_subject_id: item.id, subject_id: item.subject_id, question_count: rows.length })
}

export async function uploadManagedPdf(user: User, item: ManagedExamSubject, kind: 'question' | 'explanation', file: File) {
  if (file.type !== 'application/pdf') throw new Error('PDF 파일만 업로드할 수 있습니다.')
  if (file.size > 50 * 1024 * 1024) throw new Error('PDF 파일은 50MB 이하여야 합니다.')
  const db = client()
  const path = `exams/${item.exam_id}/subjects/${item.subject_id}/${kind}.pdf`
  const uploadResult = await db.storage.from('exam-pdfs').upload(path, file, { contentType: 'application/pdf', upsert: true })
  if (uploadResult.error) throw uploadResult.error
  const update = kind === 'question' ? { question_pdf_path: path } : { explanation_pdf_path: path }
  const updateResult = await db.from('exam_subjects').update(update).eq('id', item.id)
  if (updateResult.error) throw updateResult.error
  await audit(user.id, `upload_${kind}_pdf`, item.exam_id, { exam_subject_id: item.id, subject_id: item.subject_id, path, size: file.size })
}

export async function removeManagedPdf(user: User, item: ManagedExamSubject, kind: 'question' | 'explanation') {
  const db = client()
  const path = kind === 'question' ? item.question_pdf_path : item.explanation_pdf_path
  if (!path) return
  const storageResult = await db.storage.from('exam-pdfs').remove([path])
  if (storageResult.error) throw storageResult.error
  const update = kind === 'question' ? { question_pdf_path: null, status: 'draft' as const, published_at: null } : { explanation_pdf_path: null, status: 'draft' as const, published_at: null }
  const linkResult = await db.from('exam_subjects').update(update).eq('id', item.id)
  if (linkResult.error) throw linkResult.error
  await audit(user.id, `remove_${kind}_pdf`, item.exam_id, { exam_subject_id: item.id, subject_id: item.subject_id, path })
}

export async function publishManagedExamSubject(user: User, item: ManagedExamSubject) {
  if (!item.question_pdf_path || !item.explanation_pdf_path) throw new Error('문제·해설 PDF가 모두 필요합니다.')
  const validationError = validateAnswerKeys(item.subject, item.answerKeys)
  if (validationError) throw new Error(validationError)
  const result = await client().from('exam_subjects').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', item.id)
  if (result.error) throw result.error
  await audit(user.id, 'publish_exam_subject', item.exam_id, { exam_subject_id: item.id, subject_id: item.subject_id })
}

export async function unpublishManagedExamSubject(user: User, item: ManagedExamSubject) {
  const result = await client().from('exam_subjects').update({ status: 'draft', published_at: null }).eq('id', item.id)
  if (result.error) throw result.error
  await audit(user.id, 'unpublish_exam_subject', item.exam_id, { exam_subject_id: item.id, subject_id: item.subject_id })
}

export async function deleteManagedExamSubject(user: User, item: ManagedExamSubject) {
  const db = client()
  const paths = [item.question_pdf_path, item.explanation_pdf_path].filter((path): path is string => Boolean(path))
  const deleteResult = await db.from('exam_subjects').delete().eq('id', item.id)
  if (deleteResult.error) throw deleteResult.error
  const remainingResult = await db.from('exam_subjects').select('id').eq('exam_id', item.exam_id).limit(1)
  if (remainingResult.error) throw remainingResult.error
  if (!remainingResult.data.length) {
    const parentResult = await db.from('exams').delete().eq('id', item.exam_id)
    if (parentResult.error) throw parentResult.error
  }
  await audit(user.id, 'delete_exam_subject', item.exam_id, { exam_subject_id: item.id, subject_id: item.subject_id, year: item.exam.year, month: item.exam.month, title: item.exam.title, attempt_count: item.attemptCount, pdf_paths: paths })
  if (paths.length) {
    const storageResult = await db.storage.from('exam-pdfs').remove(paths)
    if (storageResult.error) await audit(user.id, 'pdf_cleanup_failed', item.exam_id, { exam_subject_id: item.id, paths, message: storageResult.error.message })
  }
}

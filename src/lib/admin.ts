import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Database, Json } from '../types/database.generated'
import type { Subject } from './data'
import { isMathShortAnswer } from './exam'

type Exam = Database['public']['Tables']['exams']['Row']
type ExamSubject = Database['public']['Tables']['exam_subjects']['Row']
export type AdminAnswerKey = Pick<Database['public']['Tables']['answer_keys']['Row'], 'question_number' | 'answer' | 'points'>

export type AdminExamSubject = ExamSubject & {
  subject: Subject
  answerKeys: AdminAnswerKey[]
  attemptCount: number
}

export type AdminExam = Exam & { examSubjects: AdminExamSubject[] }
export type AdminAuditLog = Database['public']['Tables']['admin_audit_logs']['Row']

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

export async function loadAdminExams(): Promise<AdminExam[]> {
  const result = await client().from('exams').select('*, exam_subjects(*, subjects(*), answer_keys(question_number, answer, points), attempts(id))').order('updated_at', { ascending: false })
  if (result.error) throw result.error
  const rows = result.data as unknown as Array<Exam & { exam_subjects: Array<ExamSubject & { subjects: Subject; answer_keys: AdminAnswerKey[]; attempts: Array<{ id: string }> }> }>
  return rows.map(({ exam_subjects, ...exam }) => ({
    ...exam,
    examSubjects: exam_subjects.map(({ subjects, answer_keys, attempts, ...link }) => ({ ...link, subject: subjects, answerKeys: answer_keys.sort((a, b) => a.question_number - b.question_number), attemptCount: attempts.length })).sort((a, b) => a.subject.sort_order - b.subject.sort_order),
  }))
}

export async function loadAdminAuditLogs(): Promise<AdminAuditLog[]> {
  const result = await client().from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(50)
  if (result.error) throw result.error
  return result.data
}

export async function createAdminExam(user: User, values: { year: number; month: number; title: string; isDevelopmentData: boolean; subjectIds: number[] }) {
  const db = client()
  const examResult = await db.from('exams').insert({ year: values.year, month: values.month, title: values.title, is_development_data: values.isDevelopmentData, status: 'draft' }).select().single()
  if (examResult.error) throw examResult.error
  const exam = examResult.data
  const linksResult = await db.from('exam_subjects').insert(values.subjectIds.map(subjectId => ({ exam_id: exam.id, subject_id: subjectId })))
  if (linksResult.error) { await db.from('exams').delete().eq('id', exam.id); throw linksResult.error }
  await audit(user.id, 'create_exam', exam.id, { year: exam.year, month: exam.month, title: exam.title, subject_ids: values.subjectIds })
  return exam.id
}

export async function updateAdminExam(user: User, exam: AdminExam, values: { year: number; month: number; title: string; isDevelopmentData: boolean; subjectIds: number[] }) {
  const db = client()
  const result = await db.from('exams').update({ year: values.year, month: values.month, title: values.title, is_development_data: values.isDevelopmentData }).eq('id', exam.id)
  if (result.error) throw result.error
  const previous = new Set(exam.examSubjects.map(item => item.subject_id))
  const next = new Set(values.subjectIds)
  const removed = exam.examSubjects.filter(item => !next.has(item.subject_id))
  const added = values.subjectIds.filter(id => !previous.has(id))
  const paths = removed.flatMap(item => [item.question_pdf_path, item.explanation_pdf_path]).filter((path): path is string => Boolean(path))
  if (removed.length) {
    const deleteResult = await db.from('exam_subjects').delete().in('id', removed.map(item => item.id))
    if (deleteResult.error) throw deleteResult.error
  }
  if (paths.length) {
    const storageResult = await db.storage.from('exam-pdfs').remove(paths)
    if (storageResult.error) await audit(user.id, 'pdf_cleanup_failed', exam.id, { paths, message: storageResult.error.message })
  }
  if (added.length) {
    const insertResult = await db.from('exam_subjects').insert(added.map(subjectId => ({ exam_id: exam.id, subject_id: subjectId })))
    if (insertResult.error) throw insertResult.error
  }
  if (added.length && exam.status === 'published') {
    const draftResult = await db.from('exams').update({ status: 'draft', published_at: null }).eq('id', exam.id)
    if (draftResult.error) throw draftResult.error
  }
  await audit(user.id, 'update_exam', exam.id, { year: values.year, month: values.month, title: values.title, added_subject_ids: added, removed_subject_ids: removed.map(item => item.subject_id) })
}

export function validateAnswerKeys(subject: Subject, rows: AdminAnswerKey[]) {
  if (rows.length !== subject.question_count) return `${subject.question_count}개 문항을 모두 입력해 주세요.`
  const numbers = new Set(rows.map(row => row.question_number))
  if (numbers.size !== subject.question_count || rows.some(row => row.question_number < 1 || row.question_number > subject.question_count)) return '문항 번호가 중복되었거나 범위를 벗어났습니다.'
  for (const row of rows) {
    const validAnswer = isMathShortAnswer(subject.area, row.question_number) ? /^\d{1,3}$/.test(row.answer) : /^[1-5]$/.test(row.answer)
    if (!validAnswer) return `${row.question_number}번 정답 형식이 올바르지 않습니다.`
    if (!Number.isInteger(row.points) || row.points <= 0) return `${row.question_number}번 배점이 올바르지 않습니다.`
  }
  if (rows.reduce((sum, row) => sum + row.points, 0) !== 100) return '배점 합계가 100점이어야 합니다.'
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

export async function saveAdminAnswerKeys(user: User, exam: AdminExam, link: AdminExamSubject, rows: AdminAnswerKey[]) {
  const validationError = validateAnswerKeys(link.subject, rows)
  if (validationError) throw new Error(validationError)
  const db = client()
  const deleteResult = await db.from('answer_keys').delete().eq('exam_subject_id', link.id)
  if (deleteResult.error) throw deleteResult.error
  const insertResult = await db.from('answer_keys').insert(rows.map(row => ({ ...row, exam_subject_id: link.id })))
  if (insertResult.error) throw insertResult.error
  await audit(user.id, 'update_answer_keys', exam.id, { subject_id: link.subject_id, question_count: rows.length })
}

export async function uploadAdminPdf(user: User, examId: number, link: AdminExamSubject, kind: 'question' | 'explanation', file: File) {
  if (file.type !== 'application/pdf') throw new Error('PDF 파일만 업로드할 수 있습니다.')
  if (file.size > 50 * 1024 * 1024) throw new Error('PDF 파일은 50MB 이하여야 합니다.')
  const db = client()
  const path = `exams/${examId}/subjects/${link.subject_id}/${kind}.pdf`
  const uploadResult = await db.storage.from('exam-pdfs').upload(path, file, { contentType: 'application/pdf', upsert: true })
  if (uploadResult.error) throw uploadResult.error
  const pdfUpdate: Database['public']['Tables']['exam_subjects']['Update'] = kind === 'question' ? { question_pdf_path: path } : { explanation_pdf_path: path }
  const updateResult = await db.from('exam_subjects').update(pdfUpdate).eq('id', link.id)
  if (updateResult.error) throw updateResult.error
  await audit(user.id, `upload_${kind}_pdf`, examId, { subject_id: link.subject_id, path, size: file.size })
}

export async function removeAdminPdf(user: User, exam: AdminExam, link: AdminExamSubject, kind: 'question' | 'explanation') {
  const db = client()
  const path = kind === 'question' ? link.question_pdf_path : link.explanation_pdf_path
  if (!path) return
  const storageResult = await db.storage.from('exam-pdfs').remove([path])
  if (storageResult.error) throw storageResult.error
  const pdfUpdate: Database['public']['Tables']['exam_subjects']['Update'] = kind === 'question' ? { question_pdf_path: null } : { explanation_pdf_path: null }
  const linkResult = await db.from('exam_subjects').update(pdfUpdate).eq('id', link.id)
  if (linkResult.error) throw linkResult.error
  if (exam.status === 'published') {
    const draftResult = await db.from('exams').update({ status: 'draft', published_at: null }).eq('id', exam.id)
    if (draftResult.error) throw draftResult.error
  }
  await audit(user.id, `remove_${kind}_pdf`, exam.id, { subject_id: link.subject_id, path })
}

export async function publishAdminExam(user: User, exam: AdminExam) {
  if (!exam.examSubjects.length) throw new Error('최소 한 과목을 선택해 주세요.')
  for (const link of exam.examSubjects) {
    if (!link.question_pdf_path || !link.explanation_pdf_path) throw new Error(`${link.subject.name}의 문제·해설 PDF가 모두 필요합니다.`)
    const validationError = validateAnswerKeys(link.subject, link.answerKeys)
    if (validationError) throw new Error(`${link.subject.name}: ${validationError}`)
  }
  const result = await client().from('exams').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', exam.id)
  if (result.error) throw result.error
  await audit(user.id, 'publish_exam', exam.id, { subject_count: exam.examSubjects.length })
}

export async function unpublishAdminExam(user: User, examId: number) {
  const result = await client().from('exams').update({ status: 'draft', published_at: null }).eq('id', examId)
  if (result.error) throw result.error
  await audit(user.id, 'unpublish_exam', examId)
}

export async function deleteAdminExam(user: User, exam: AdminExam) {
  const db = client()
  const paths = exam.examSubjects.flatMap(item => [item.question_pdf_path, item.explanation_pdf_path]).filter((path): path is string => Boolean(path))
  const deleteResult = await db.from('exams').delete().eq('id', exam.id)
  if (deleteResult.error) throw deleteResult.error
  await audit(user.id, 'delete_exam', exam.id, { year: exam.year, month: exam.month, title: exam.title, subject_ids: exam.examSubjects.map(item => item.subject_id), attempt_count: exam.examSubjects.reduce((sum, item) => sum + item.attemptCount, 0), pdf_paths: paths })
  if (paths.length) {
    const storageResult = await db.storage.from('exam-pdfs').remove(paths)
    if (storageResult.error) await audit(user.id, 'pdf_cleanup_failed', exam.id, { paths, message: storageResult.error.message })
  }
}

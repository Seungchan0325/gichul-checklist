import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_ROOT = '/mnt/c/Users/imcha/Documents/Codex/2026-08-28/plugin-browser-openai-bundled-ebsi-3/outputs'
const FIRST_YEAR = 2022
const LAST_YEAR = 2026
const MAX_PDF_BYTES = 50 * 1024 * 1024
const CONCURRENCY = 4

const args = new Set(process.argv.slice(2))
const sourceRoot = process.argv.find((value, index) => index > 1 && !value.startsWith('--')) ?? DEFAULT_ROOT
const apply = args.has('--apply')
const publish = args.has('--publish')

const normalize = value => value.replace(/[\s·]/gu, '')
const aliasesFor = subject => {
  const aliases = new Set([subject.name, subject.name.replace(/\s/gu, '')])
  if (subject.name === '한문Ⅰ') aliases.add('한문')
  return [...aliases]
}
const areaSuffix = area => ({
  사회탐구: '사회탐구(사탐)',
  과학탐구: '과학탐구(과탐)',
  직업탐구: '직업탐구(직탐)',
  '제2외국어/한문': '제2외국어(제2외국어)',
})[area]
const areaRule = area => {
  if (area === '수학') return { total: 100, points: [2, 3, 4] }
  if (area === '국어' || area === '영어') return { total: 100, points: [2, 3] }
  if (area === '제2외국어/한문') return { total: 50, points: [1, 2] }
  return { total: 50, points: [2, 3] }
}
const isMathShort = (area, number) => area === '수학' && ((number >= 16 && number <= 22) || number >= 29)

function parseCsv(text, filename) {
  const lines = text.replace(/^\uFEFF/u, '').trim().split(/\r?\n/u).filter(Boolean)
  if (lines[0]?.replace(/[\s"]/gu, '').toLowerCase() === 'question_number,answer,points') lines.shift()
  return lines.map((line, index) => {
    const columns = line.split(',').map(value => value.trim().replace(/^"|"$/gu, ''))
    if (columns.length !== 3) throw new Error(`${filename}: CSV ${index + 2}행의 열 개수가 올바르지 않습니다.`)
    const question_number = Number(columns[0])
    const points = Number(columns[2])
    if (!Number.isInteger(question_number) || !Number.isInteger(points)) throw new Error(`${filename}: CSV ${index + 2}행에 숫자가 아닌 값이 있습니다.`)
    return { question_number, answer: columns[1], points }
  })
}

function validateRows(subject, rows, filename) {
  const rule = areaRule(subject.area)
  if (rows.length !== subject.question_count) throw new Error(`${filename}: ${subject.question_count}개 문항이 필요하지만 ${rows.length}개입니다.`)
  const seen = new Set()
  for (const row of rows) {
    if (seen.has(row.question_number) || row.question_number < 1 || row.question_number > subject.question_count) throw new Error(`${filename}: 문항 번호가 중복되었거나 범위를 벗어났습니다.`)
    seen.add(row.question_number)
    const valid = isMathShort(subject.area, row.question_number) ? /^\d{1,3}$/u.test(row.answer) : /^[1-5]$/u.test(row.answer)
    if (!valid) throw new Error(`${filename}: ${row.question_number}번 정답 형식이 올바르지 않습니다.`)
    if (!rule.points.includes(row.points)) throw new Error(`${filename}: ${row.question_number}번 배점이 올바르지 않습니다.`)
  }
  const total = rows.reduce((sum, row) => sum + row.points, 0)
  if (total !== rule.total) throw new Error(`${filename}: 배점 합계가 ${rule.total}점이어야 하지만 ${total}점입니다.`)
}

function parseManifest(text) {
  const rows = text.replace(/^\uFEFF/u, '').trim().split(/\r?\n/u)
  const header = rows.shift()?.split(',').map(value => value.trim()) ?? []
  const pathIndex = header.indexOf('path')
  const statusIndex = header.indexOf('status')
  const bytesIndex = header.indexOf('bytes')
  if (pathIndex < 0 || statusIndex < 0 || bytesIndex < 0) throw new Error('manifest.csv에 path, bytes, status 열이 필요합니다.')
  return new Map(rows.filter(Boolean).map(line => {
    const columns = line.split(',').map(value => value.trim())
    return [columns[pathIndex].replaceAll('\\', '/'), { bytes: Number(columns[bytesIndex]), status: columns[statusIndex] }]
  }))
}

function identifyBundle(stem, subjects) {
  const grouped = stem.match(/^(.*) (국어|수학|영어|한국사|사회탐구|과학탐구|직업탐구|제2외국어)\((.+)\)$/u)
  if (grouped) {
    const [, title, rawArea, rawLabel] = grouped
    const form = rawLabel.endsWith(' 짝수형') ? 'even' : rawLabel.endsWith(' 홀수형') ? 'odd' : null
    const label = rawLabel.replace(/ (?:짝수형|홀수형)$/u, '')
    const subject = subjects.find(item => aliasesFor(item).some(alias => normalize(alias) === normalize(label)))
    if (subject && (subject.area === rawArea || (rawArea === '제2외국어' && subject.area === '제2외국어/한문'))) return { title, subject, form }
  }

  for (const subject of subjects) {
    const suffixes = []
    for (const alias of aliasesFor(subject)) {
      if (subject.area === '국어' || subject.area === '수학') suffixes.push(`${subject.area}(${alias})`)
      if (areaSuffix(subject.area)) suffixes.push(`${alias} ${areaSuffix(subject.area)}`)
    }
    if (subject.area === '영어') suffixes.push('영어')
    if (subject.area === '한국사') suffixes.push('한국사')
    for (const suffix of suffixes.sort((a, b) => b.length - a.length)) {
      if (stem.endsWith(` ${suffix}`)) return { title: stem.slice(0, -suffix.length - 1), subject, form: null }
    }
  }
  return null
}

async function validatePdf(filename, expectedBytes) {
  const stat = await fs.stat(filename)
  if (stat.size <= 0 || stat.size > MAX_PDF_BYTES) throw new Error(`${filename}: PDF 크기가 허용 범위를 벗어났습니다.`)
  if (Number.isFinite(expectedBytes) && stat.size !== expectedBytes) throw new Error(`${filename}: manifest의 파일 크기와 실제 크기가 다릅니다.`)
  const handle = await fs.open(filename, 'r')
  try {
    const header = Buffer.alloc(5)
    await handle.read(header, 0, header.length, 0)
    if (header.toString() !== '%PDF-') throw new Error(`${filename}: PDF 헤더가 올바르지 않습니다.`)
  } finally {
    await handle.close()
  }
}

async function discoverBundles(subjects) {
  const exams = new Map()
  let skippedEvenForms = 0
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year += 1) {
    const yearRoot = path.join(sourceRoot, String(year))
    const manifest = parseManifest(await fs.readFile(path.join(yearRoot, 'manifest.csv'), 'utf8'))
    const months = (await fs.readdir(yearRoot, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort((a, b) => Number(a) - Number(b))
    for (const monthName of months) {
      const month = Number(monthName)
      const monthRoot = path.join(yearRoot, monthName)
      const names = await fs.readdir(monthRoot)
      const problemFiles = names.filter(name => name.endsWith(' 문제.pdf')).sort((a, b) => a.localeCompare(b, 'ko'))
      for (const problemFile of problemFiles) {
        const stem = problemFile.slice(0, -' 문제.pdf'.length)
        const identified = identifyBundle(stem, subjects)
        if (!identified) throw new Error(`과목과 시험명을 판별하지 못했습니다: ${year}/${month}/${problemFile}`)
        if (identified.form === 'even') {
          skippedEvenForms += 1
          continue
        }
        const csvFile = `${stem} [정답].csv`
        const explanationFile = `${stem} 해설.pdf`
        for (const required of [csvFile, explanationFile]) {
          if (!names.includes(required)) throw new Error(`필수 파일이 없습니다: ${year}/${month}/${required}`)
        }
        for (const pdfFile of [problemFile, explanationFile]) {
          const relative = `${year}/${month}/${pdfFile}`
          const manifestEntry = manifest.get(relative)
          if (!manifestEntry || manifestEntry.status !== 'ok') throw new Error(`${relative}: manifest에서 정상 파일로 확인되지 않았습니다.`)
          await validatePdf(path.join(monthRoot, pdfFile), manifestEntry.bytes)
        }
        const rows = parseCsv(await fs.readFile(path.join(monthRoot, csvFile), 'utf8'), `${year}/${month}/${csvFile}`)
        validateRows(identified.subject, rows, `${year}/${month}/${csvFile}`)
        const examKey = `${year}\u0000${month}\u0000${identified.title}`
        if (!exams.has(examKey)) exams.set(examKey, { year, month, title: identified.title, bundles: [] })
        const exam = exams.get(examKey)
        if (exam.bundles.some(bundle => bundle.subject.id === identified.subject.id)) throw new Error(`${year}/${month}/${identified.title}: ${identified.subject.name} 과목이 중복되었습니다.`)
        exam.bundles.push({ ...identified, monthRoot, stem, problemFile, explanationFile, csvFile, rows })
      }
    }
  }
  return { exams: [...exams.values()].sort((a, b) => a.year - b.year || a.month - b.month || a.title.localeCompare(b.title, 'ko')), skippedEvenForms }
}

function ensure(result) {
  if (result.error) throw result.error
  return result.data
}

async function mapConcurrent(items, limit, worker) {
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next
      next += 1
      await worker(items[index], index)
    }
  })
  await Promise.all(runners)
}

async function retry(operation, label, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt < attempts) console.warn(`${label}: 재시도 ${attempt}/${attempts - 1}`)
    }
  }
  throw lastError
}

async function uploadBundle(db, exam, bundle) {
  const existing = ensure(await db.from('exam_subjects')
    .select('id, status, question_pdf_path, explanation_pdf_path, answer_keys(count)')
    .eq('exam_id', exam.id)
    .eq('subject_id', bundle.subject.id)
    .maybeSingle())
  const isComplete = existing
    && existing.question_pdf_path
    && existing.explanation_pdf_path
    && existing.answer_keys[0]?.count === bundle.rows.length
    && (!publish || existing.status === 'published')
  if (isComplete) return false

  const link = ensure(await db.from('exam_subjects').upsert({ exam_id: exam.id, subject_id: bundle.subject.id }, { onConflict: 'exam_id,subject_id' }).select().single())
  const uploads = [
    [bundle.problemFile, `exams/${exam.id}/subjects/${bundle.subject.id}/question.pdf`],
    [bundle.explanationFile, `exams/${exam.id}/subjects/${bundle.subject.id}/explanation.pdf`],
  ]
  await Promise.all(uploads.map(async ([filename, storagePath]) => {
    const body = new Blob([await fs.readFile(path.join(bundle.monthRoot, filename))], { type: 'application/pdf' })
    ensure(await db.storage.from('exam-pdfs').upload(storagePath, body, { contentType: 'application/pdf', upsert: true }))
  }))
  const publication = publish ? { status: 'published', published_at: new Date().toISOString() } : {}
  ensure(await db.from('exam_subjects').update({ question_pdf_path: uploads[0][1], explanation_pdf_path: uploads[1][1], ...publication }).eq('id', link.id))
  ensure(await db.from('answer_keys').upsert(bundle.rows.map(row => ({ ...row, exam_subject_id: link.id })), { onConflict: 'exam_subject_id,question_number' }))
  return true
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('VITE_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 환경변수로 설정해 주세요.')
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const subjects = ensure(await db.from('subjects').select('id, area, name, question_count, duration_seconds').order('sort_order'))
  const { exams, skippedEvenForms } = await discoverBundles(subjects)
  const bundleCount = exams.reduce((sum, exam) => sum + exam.bundles.length, 0)
  const answerCount = exams.reduce((sum, exam) => sum + exam.bundles.reduce((subtotal, bundle) => subtotal + bundle.rows.length, 0), 0)
  console.log(`검증 완료: ${exams.length}개 시험, ${bundleCount}개 과목, PDF ${bundleCount * 2}개, 정답 ${answerCount}개`)
  console.log(`수능 짝수형 ${skippedEvenForms}개는 동일 과목 중복을 피하기 위해 제외하고 홀수형을 사용합니다.`)
  if (!apply) {
    console.log('dry-run입니다. 실제 업로드는 --apply를 붙여 실행하세요.')
    return
  }

  let completed = 0
  let skipped = 0
  for (const examData of exams) {
    const exam = ensure(await db.from('exams').upsert({ year: examData.year, month: examData.month, title: examData.title, is_development_data: false }, { onConflict: 'year,month,title' }).select().single())
    await mapConcurrent(examData.bundles, CONCURRENCY, async bundle => {
      const uploaded = await retry(() => uploadBundle(db, exam, bundle), `${examData.year}.${examData.month} ${bundle.subject.name}`)
      completed += 1
      if (!uploaded) skipped += 1
      console.log(`[${completed}/${bundleCount}] ${uploaded ? '업로드' : '기존'} · ${examData.year}.${String(examData.month).padStart(2, '0')} ${examData.title} · ${bundle.subject.name}`)
    })
  }
  console.log(`업로드 완료: ${exams.length}개 시험, ${bundleCount - skipped}개 신규·갱신, ${skipped}개 기존 (${publish ? '게시' : '초안'})`)
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })

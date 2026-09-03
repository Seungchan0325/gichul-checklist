import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const PDF_PATH = /^exams\/\d+\/subjects\/\d+\/(?:question|explanation)\.pdf$/u

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

async function retryStorage(operation, label, attempts = 5) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await operation()
      if (result.error) throw result.error
      return result.data
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        console.warn(`${label}: 재시도 ${attempt}/${attempts - 1}`)
        await wait(attempt * 500)
      }
    }
  }
  throw lastError
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.setEncoding('utf8'); child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} 실패 (${code}): ${stderr.trim()}`)))
    if (options.input) child.stdin.end(options.input)
    else child.stdin.end()
  })
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function sha256(filename) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filename)
    stream.on('error', reject)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export async function syncPdfFiles(files, {
  sshTarget = process.env.EXAM_PDF_SSH_TARGET || 'lsc-server-deploy',
  remoteRoot = process.env.EXAM_PDF_REMOTE_ROOT || '/var/www/gichul-checklist/pdfs',
} = {}) {
  if (!files.length) throw new Error('서버에 동기화할 PDF가 없습니다.')
  const destinations = new Set()
  for (const file of files) {
    if (!PDF_PATH.test(file.destination)) throw new Error(`허용되지 않은 PDF 대상 경로입니다: ${file.destination}`)
    if (destinations.has(file.destination)) throw new Error(`PDF 대상 경로가 중복되었습니다: ${file.destination}`)
    destinations.add(file.destination)
  }

  const stagingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gichul-pdfs-'))
  try {
    await fs.chmod(stagingRoot, 0o755)
    const manifestRows = []
    for (const file of files) {
      const destination = path.join(stagingRoot, file.destination)
      await fs.mkdir(path.dirname(destination), { recursive: true })
      await fs.symlink(path.resolve(file.source), destination)
      manifestRows.push(`${await sha256(file.source)}  ${file.destination}`)
    }
    const manifest = `${manifestRows.sort().join('\n')}\n`
    await run('ssh', [sshTarget, `mkdir -p ${shellQuote(remoteRoot)}`])
    await run('rsync', ['--archive', '--copy-links', '--compress', '--delete', '--delay-updates', '--chmod=D755,F644', `${stagingRoot}/`, `${sshTarget}:${remoteRoot}/`])
    const countResult = await run('ssh', [sshTarget, `find ${shellQuote(remoteRoot)} -type f -name '*.pdf' | wc -l`])
    const remoteCount = Number(countResult.stdout.trim())
    if (remoteCount !== files.length) throw new Error(`서버 PDF 수가 다릅니다: 로컬 ${files.length}개, 서버 ${remoteCount}개`)
    await run('ssh', [sshTarget, `cd ${shellQuote(remoteRoot)} && sha256sum --check --strict`], { input: manifest })
    console.log(`PDF 서버 동기화 및 SHA-256 검증 완료: ${files.length}개`)
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true })
  }
}

async function listStorageFiles(db, prefix = '') {
  const files = []
  for (let offset = 0; ; offset += 1000) {
    const rows = await retryStorage(() => db.storage.from('exam-pdfs').list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }), `Storage 목록 ${prefix || '/'}`) ?? []
    for (const row of rows) {
      const objectPath = prefix ? `${prefix}/${row.name}` : row.name
      if (row.id) files.push(objectPath)
      else files.push(...await listStorageFiles(db, objectPath))
    }
    if (rows.length < 1000) return files
  }
}

export async function purgeMigratedSupabasePdfs(db, migratedPaths) {
  const expected = new Set(migratedPaths)
  const stored = await listStorageFiles(db)
  const unexpected = stored.filter(objectPath => !expected.has(objectPath))
  const missing = [...expected].filter(objectPath => !stored.includes(objectPath))
  if (unexpected.length) {
    throw new Error(`서버로 이전하지 않은 Supabase Storage 객체가 ${unexpected.length}개 있습니다. Storage는 삭제하지 않았습니다.`)
  }
  if (missing.length) console.log(`Supabase Storage에 이미 없는 이전 대상: ${missing.length}개`)
  for (let index = 0; index < stored.length; index += 100) {
    await retryStorage(() => db.storage.from('exam-pdfs').remove(stored.slice(index, index + 100)), `Storage 삭제 ${index + 1}-${Math.min(index + 100, stored.length)}`)
  }
  const remaining = await listStorageFiles(db)
  if (remaining.length) throw new Error(`Supabase Storage 삭제 후 ${remaining.length}개 객체가 남았습니다.`)
  console.log(`Supabase Storage PDF 삭제 완료: ${stored.length}개`)
}

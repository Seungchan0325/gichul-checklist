import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = (request: Request) => {
  const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN')
  const origin = request.headers.get('Origin')
  const localOrigin = origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173'
  const originAllowed = localOrigin || Boolean(allowedOrigin && origin === allowedOrigin)
  if (!originAllowed) return null
  return { 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Origin': origin!, Vary: 'Origin' }
}

const sendLocalSmtp = async (to: string, from: string, subject: string, html: string) => {
  const connection = await Deno.connect({ hostname: Deno.env.get('INBUCKET_SMTP_HOST') ?? 'inbucket', port: Number(Deno.env.get('INBUCKET_SMTP_PORT') ?? 1025) })
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const readResponse = async () => { const buffer = new Uint8Array(4096); const size = await connection.read(buffer); return size ? decoder.decode(buffer.subarray(0, size)) : '' }
  const command = async (value: string) => { await connection.write(encoder.encode(`${value}\r\n`)); return readResponse() }
  try {
    await readResponse()
    await command('EHLO localhost')
    await command(`MAIL FROM:<${from.match(/<([^>]+)>/)?.[1] ?? from}>`)
    await command(`RCPT TO:<${to}>`)
    await command('DATA')
    const message = `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n.`
    await command(message)
    await command('QUIT')
  } finally { connection.close() }
}

Deno.serve(async request => {
  const headers = corsHeaders(request)
  if (!headers) return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers })
  const authorization = request.headers.get('Authorization')
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('REPORT_EMAIL_FROM') ?? '기출 체크리스트 <noreply@localhost>'
  if (!authorization || !url || !anonKey || !serviceRoleKey || !from) return Response.json({ error: 'Email notification is not configured' }, { status: 500, headers })
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return Response.json({ error: 'Authentication required' }, { status: 401, headers })
  const { data: admin, error: adminError } = await userClient.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
  if (adminError || !admin) return Response.json({ error: 'Admin access required' }, { status: 403, headers })
  const body = await request.json().catch(() => null) as { reportId?: number; status?: 'resolved' | 'dismissed' } | null
  if (!body?.reportId || (body.status !== 'resolved' && body.status !== 'dismissed')) return Response.json({ error: 'reportId and status are required' }, { status: 400, headers })
  const adminClient = createClient(url, serviceRoleKey)
  const reportResult = await userClient.from('answer_key_reports').select('reporter_user_id, exam_subject_id, question_number, details').eq('id', body.reportId).maybeSingle()
  if (reportResult.error) return Response.json({ error: `제보 조회 실패: ${reportResult.error.message}` }, { status: 500, headers })
  if (!reportResult.data?.reporter_user_id) return Response.json({ error: '제보자 계정 정보가 없습니다.' }, { status: 422, headers })
  const examSubjectResult = await userClient.from('exam_subjects').select('exam_id, subject_id').eq('id', reportResult.data.exam_subject_id).maybeSingle()
  if (examSubjectResult.error || !examSubjectResult.data) return Response.json({ error: `시험 과목 조회 실패: ${examSubjectResult.error?.message ?? '자료 없음'}` }, { status: 500, headers })
  const [examResult, subjectResult] = await Promise.all([
    userClient.from('exams').select('year, month, title').eq('id', examSubjectResult.data.exam_id).single(),
    userClient.from('subjects').select('name').eq('id', examSubjectResult.data.subject_id).single(),
  ])
  if (examResult.error || subjectResult.error) return Response.json({ error: `시험 정보 조회 실패: ${examResult.error?.message ?? subjectResult.error?.message}` }, { status: 500, headers })
  const { data: reporter } = await adminClient.auth.admin.getUserById(reportResult.data.reporter_user_id)
  const email = reporter.user?.email
  if (!email) return Response.json({ error: '제보자의 이메일 주소가 없습니다.' }, { status: 422, headers })
  const resolved = body.status === 'resolved'
  const subject = `${examResult.data.year}년 ${examResult.data.month}월 ${subjectResult.data.name}`
  const emailSubject = `[기출 체크리스트] 제보가 ${resolved ? '처리 완료' : '반려'}되었습니다`
  const html = `<p>안녕하세요.</p><p><strong>${subject}</strong> ${reportResult.data.question_number}번 문항에 대한 제보가 <strong>${resolved ? '처리 완료' : '반려'}</strong>되었습니다.</p>${reportResult.data.details ? `<p>제보 내용: ${reportResult.data.details}</p>` : ''}<p>기출 체크리스트</p>`
  let result: Response | null = null
  if (resendKey) {
    result = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [email], subject: emailSubject, html }) })
  } else {
    try { await sendLocalSmtp(email, from, emailSubject, html); result = new Response('ok', { status: 200 }) } catch (error) { console.warn('Inbucket SMTP request failed', error) }
  }
  if (!result?.ok) return Response.json({ error: resendKey ? 'Email delivery failed' : 'Inbucket SMTP에 연결할 수 없습니다. Supabase를 실행했는지 확인해 주세요.' }, { status: 502, headers })
  return Response.json({ sent: true }, { headers })
})

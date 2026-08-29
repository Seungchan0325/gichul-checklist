import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { BookOpen, Check, CircleX, Clock3, Download, ExternalLink, Home, LogOut, Menu, Moon, Pause, Play, RotateCcw, Settings, Sun, Trash2, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import { answeredCount, getAttemptStatus, isMathShortAnswer, parseAnswers, scoreAnswers, type AnswerKey, type AnswerMap } from './lib/exam'
import { createAnswerKeyReport, createExamPdfUrl, deleteAccount, loadAllExamSubjects, loadAnswerKeys, loadAttemptedExams, loadBootstrap, saveAttempt, saveTheme, toggleShortcut, type AnswerKeyIssueType, type AttemptedExamItem, type CategorizedExamItem, type ExamListItem, type Subject } from './lib/data'
import { isAdmin as checkIsAdmin } from './lib/admin'
import AdminPage from './AdminPage'

type Page = 'home' | 'subjects' | 'list' | 'exam' | 'settings' | 'admin'
type Route = { page: Page; subjectId?: number; examSubjectId?: number; adminExamSubjectId?: number }
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const cn = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(' ')
const multiAreas = new Set(['사회탐구', '과학탐구', '직업탐구'])
const googleAccountDeletionKey = 'gichul-checklist:google-account-deletion'

function readRoute(): Route {
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (parts[0] === 'subjects' && parts[1]) return { page: 'list', subjectId: Number(parts[1]) }
  if (parts[0] === 'exam' && parts[1]) return { page: 'exam', examSubjectId: Number(parts[1]) }
  if (parts[0] === 'subjects') return { page: 'subjects' }
  if (parts[0] === 'settings') return { page: 'settings' }
  if (parts[0] === 'admin') { const selected = Number(new URLSearchParams(window.location.search).get('examSubjectId')); return { page: 'admin', ...(selected ? { adminExamSubjectId: selected } : {}) } }
  return { page: 'home' }
}

function routePath(route: Route) {
  if (route.page === 'list' && route.subjectId) return `/subjects/${route.subjectId}`
  if (route.page === 'exam' && route.examSubjectId) return `/exam/${route.examSubjectId}`
  if (route.page === 'subjects') return '/subjects'
  if (route.page === 'settings') return '/settings'
  if (route.page === 'admin') return route.adminExamSubjectId ? `/admin?examSubjectId=${route.adminExamSubjectId}` : '/admin'
  return '/'
}

function ConfigError() {
  return <main className="grid min-h-screen place-items-center bg-surface px-5 text-ink dark:bg-neutral-950 dark:text-white"><div className="max-w-lg border-y border-line py-8 dark:border-neutral-800"><p className="text-sm font-bold text-red-600">Supabase 연결 필요</p><h1 className="mt-2 text-2xl font-bold">환경 변수를 설정해 주세요.</h1><p className="mt-3 text-sm leading-6 text-neutral-500"><code>.env.example</code>을 <code>.env.local</code>로 복사하고 로컬 Supabase의 anon key를 입력한 뒤 개발 서버를 다시 시작하세요.</p></div></main>
}

function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setMessage(''); setError('')
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (result.error) setError(result.error.message)
    else if (mode === 'signup') setMessage('확인 메일을 보냈습니다. 메일의 링크를 완료한 뒤 로그인해 주세요.')
  }

  const googleLogin = async () => {
    if (!supabase) return
    setError('')
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (authError) setError(authError.message)
  }

  return <main className="grid min-h-screen place-items-center bg-surface px-4 py-12 text-ink dark:bg-neutral-950 dark:text-white"><section className="w-full max-w-sm"><div className="mb-9"><span className="grid size-10 place-items-center bg-ink font-bold text-white dark:bg-white dark:text-black">기</span><h1 className="mt-5 text-3xl font-bold tracking-tight">{mode === 'signin' ? '다시 시작해 볼까요?' : '학습 기록을 시작하세요.'}</h1><p className="mt-2 text-sm text-neutral-500">기출 답안과 타이머를 안전하게 이어서 사용합니다.</p></div><form onSubmit={submit} className="space-y-4">{mode === 'signup' && <label className="block text-sm font-semibold">표시 이름<input required value={displayName} onChange={event => setDisplayName(event.target.value)} className="mt-2 h-11 w-full border border-line bg-transparent px-3 font-normal dark:border-neutral-700" /></label>}<label className="block text-sm font-semibold">이메일<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 h-11 w-full border border-line bg-transparent px-3 font-normal dark:border-neutral-700" /></label><label className="block text-sm font-semibold">비밀번호<input required minLength={6} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} className="mt-2 h-11 w-full border border-line bg-transparent px-3 font-normal dark:border-neutral-700" /></label>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}{message && <p role="status" className="bg-green-50 p-3 text-sm leading-5 text-green-800 dark:bg-green-950 dark:text-green-100">{message}</p>}<button disabled={busy} className="h-12 w-full bg-ink font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">{busy ? '처리 중…' : mode === 'signin' ? '로그인' : '가입하기'}</button></form><div className="my-5 flex items-center gap-3 text-xs text-neutral-400"><i className="h-px flex-1 bg-line dark:bg-neutral-800"/>또는<i className="h-px flex-1 bg-line dark:bg-neutral-800"/></div><button onClick={googleLogin} className="h-12 w-full border border-line text-sm font-bold dark:border-neutral-700">Google로 계속하기</button><button onClick={() => { setMode(value => value === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }} className="mt-6 w-full text-sm text-neutral-500 underline underline-offset-4">{mode === 'signin' ? '처음이신가요? 가입하기' : '이미 계정이 있나요? 로그인'}</button></section></main>
}

function Header({ page, setPage, dark, setDark, admin }: { page: Page; setPage: (page: Page) => void; dark: boolean; setDark: (value: boolean) => void; admin: boolean }) {
  const [mobile, setMobile] = useState(false)
  const navItems: Array<[Page, string]> = [['home', '홈'], ['subjects', '기출문제'], ['settings', '설정'], ...(admin ? [['admin', '관리'] as [Page, string]] : [])]
  return <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95"><div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6"><button onClick={() => setPage('home')} className="flex items-center gap-2 font-bold tracking-tight"><span className="grid size-8 place-items-center bg-ink text-sm text-white dark:bg-white dark:text-black">기</span><span>기출 체크리스트</span></button><nav className="ml-auto hidden items-center gap-1 md:flex">{navItems.map(([id, label]) => <button key={id} onClick={() => setPage(id)} className={cn('px-3 py-2 text-sm', page === id || (id === 'subjects' && page === 'list') ? 'font-bold' : 'text-neutral-500')}>{label}</button>)}<button aria-label="테마 변경" onClick={() => setDark(!dark)} className="ml-2 grid size-9 place-items-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button></nav><button className="ml-auto md:hidden" onClick={() => setMobile(!mobile)} aria-label="메뉴">{mobile ? <X/> : <Menu/>}</button></div>{mobile && <div className="border-t border-line px-4 py-3 md:hidden dark:border-neutral-800">{navItems.map(([id, label]) => <button key={id} onClick={() => { setPage(id); setMobile(false) }} className="block w-full py-3 text-left text-sm font-semibold">{label}</button>)}</div>}</header>
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: () => void }) { return <div className="mb-4 flex items-end justify-between"><div>{eyebrow && <p className="mb-1 text-xs font-bold text-neutral-500">{eyebrow}</p>}<h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2></div>{action && <button onClick={action} className="text-sm font-semibold underline underline-offset-4">전체보기</button>}</div> }

function ExamRow({ exam, onClick, compact = false }: { exam: ExamListItem; onClick: () => void; compact?: boolean }) {
  return <button onClick={onClick} className={cn('group flex w-full items-center border-t border-line text-left transition hover:bg-neutral-100/70 dark:border-neutral-800 dark:hover:bg-neutral-900', compact ? 'py-3' : 'py-4 sm:py-5')}><div className={cn('mr-3 h-9 w-1 shrink-0', exam.status === 'done' ? 'bg-green-500' : exam.status === 'doing' ? 'bg-orange-400' : 'bg-neutral-200 dark:bg-neutral-700')}/><div className="min-w-0 flex-1"><p className="truncate font-semibold">{exam.year}년 {exam.month}월</p><p className="mt-0.5 truncate text-sm text-neutral-500">{exam.subjectName ? `${exam.subjectName} · ` : ''}{exam.title}</p></div>{exam.score !== undefined && <div className="ml-3 text-right"><b className="text-lg tabular-nums">{exam.score}</b><span className="text-xs text-neutral-500">점</span><p className="text-xs text-neutral-400">{exam.progress}문항</p></div>}</button>
}

function HomePage({ go, exams, recommendation, shortcuts, displayName, selectShortcut, openExam }: { go: (page: Page, exam?: ExamListItem) => void; exams: AttemptedExamItem[]; recommendation?: CategorizedExamItem; shortcuts: Subject[]; displayName: string; selectShortcut: (subject: Subject) => void; openExam: (exam: CategorizedExamItem) => void }) {
  const doing = exams.filter(exam => exam.status === 'doing')
  const done = exams.filter(exam => exam.status === 'done').slice(0, 3)
  return <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12"><div className="mb-12 max-w-2xl"><p className="mb-2 text-sm font-semibold text-neutral-500">안녕하세요, {displayName}님</p><h1 className="text-3xl font-bold leading-tight tracking-[-0.04em] sm:text-4xl">오늘도 한 회씩,<br/>차근차근 풀어보세요.</h1></div><section className="mb-12"><SectionTitle eyebrow="내 과목" title="바로가기"/><div className={cn('grid gap-px border border-line bg-line dark:border-neutral-800 dark:bg-neutral-800', shortcuts.length ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1')}>{shortcuts.length ? shortcuts.map(item => <button key={item.id} onClick={() => selectShortcut(item)} className="flex min-h-24 flex-col justify-between bg-surface p-4 text-left hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-900"><BookOpen size={18}/><span className="font-bold">{item.name}</span></button>) : <p className="bg-surface p-5 text-sm text-neutral-500 dark:bg-neutral-950">설정에서 자주 풀 과목을 추가하면 바로가기가 표시됩니다.</p>}</div></section><div className="grid gap-12 lg:grid-cols-[1.25fr_0.75fr]"><section><SectionTitle title="풀고 있는 기출" action={() => go('subjects')}/>{doing.length ? doing.map(exam => <ExamRow key={exam.examSubjectId} exam={exam} onClick={() => openExam(exam)}/>) : <p className="border-t border-line py-6 text-sm text-neutral-500 dark:border-neutral-800">진행 중인 시험이 없습니다.</p>}</section><section><SectionTitle title="최근 풀었던 기출"/>{done.length ? done.map(exam => <ExamRow compact key={exam.examSubjectId} exam={exam} onClick={() => openExam(exam)}/>) : <p className="border-t border-line py-6 text-sm text-neutral-500 dark:border-neutral-800">채점 완료 기록이 없습니다.</p>}</section></div>{recommendation && <section className="mt-12 border-y border-line py-7 dark:border-neutral-800"><p className="text-xs font-bold text-neutral-500">기출 추천</p><div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-neutral-500">{recommendation.subject.area === recommendation.subject.name ? recommendation.subject.area : `${recommendation.subject.area}(${recommendation.subject.name})`}</p><h2 className="mt-1 text-xl font-bold">{recommendation.year}년 {recommendation.month}월 {recommendation.title}</h2><p className="mt-1 text-sm text-neutral-500">아직 풀지 않은 기출입니다.</p></div><button onClick={() => openExam(recommendation)} className="h-11 bg-ink px-5 text-sm font-bold text-white dark:bg-white dark:text-black">풀어보기</button></div></section>}</main>
}

function ListPage({ subject, exams, openExam }: { subject: Subject; exams: CategorizedExamItem[]; openExam: (exam: CategorizedExamItem) => void }) {
  const years = useMemo(() => [...new Set(exams.map(exam => exam.year))].sort((a, b) => b - a), [exams])
  return <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12"><div className="mb-8"><p className="mb-2 text-sm font-semibold text-neutral-500">{subject.area}</p><h1 className="text-3xl font-bold tracking-tight">{subject.name} 기출</h1></div><div className="space-y-10">{years.map(year => <section key={year}><h2 className="mb-3 text-lg font-bold">{year}년</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{exams.filter(exam => exam.year === year).sort((a, b) => a.month - b.month).map(exam => <button key={exam.examSubjectId} onClick={() => openExam(exam)} className={cn('relative min-h-32 border p-4 text-left transition hover:-translate-y-0.5 sm:min-h-36', exam.status === 'done' ? 'border-green-300 bg-done text-green-950' : exam.status === 'doing' ? 'border-orange-300 bg-doing text-orange-950' : 'border-line bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-white')}><p className="text-2xl font-bold">{exam.month}월</p><p className="mt-1 text-xs opacity-65">{exam.title}</p>{exam.score !== undefined && <div className="absolute bottom-3 right-3"><b className="text-xl">{exam.score}</b><span className="text-xs">점</span></div>}<span className="absolute bottom-4 left-4 text-xs font-semibold">{exam.status === 'done' ? '완료' : exam.status === 'doing' ? '진행 중' : '미응시'}</span></button>)}</div></section>)}</div></main>
}

function SubjectRequiredPage({ grouped, selectSubject }: { grouped: Map<string, Subject[]>; selectSubject: (subject: Subject) => void }) {
  return <main className="mx-auto max-w-3xl px-4 pb-24 pt-12 sm:px-6"><p className="text-sm font-semibold text-neutral-500">기출문제</p><h1 className="mt-2 text-3xl font-bold tracking-tight">과목을 선택해 주세요.</h1><p className="mt-3 text-sm text-neutral-500">선택한 과목의 기출을 확인할 수 있습니다.</p><div className="mt-10 space-y-6 border-t border-line pt-6 dark:border-neutral-800">{[...grouped].map(([area, items]) => <section key={area}><h2 className="mb-2 text-sm font-bold">{area}</h2><div className="flex flex-wrap gap-2">{items.map(item => <button key={item.id} onClick={() => selectSubject(item)} className="border border-line px-3 py-2 text-sm font-semibold hover:border-neutral-500 dark:border-neutral-700">{item.name}</button>)}</div></section>)}</div></main>
}

function Timer({ seconds, running, initialSeconds, onSeconds, onRunning, onReset }: { seconds: number; running: boolean; initialSeconds: number; onSeconds: (seconds: number) => void; onRunning: (running: boolean) => void; onReset: () => void }) {
  useEffect(() => { if (!running) return; const id = window.setInterval(() => onSeconds(Math.max(0, seconds - 1)), 1000); return () => window.clearInterval(id) }, [running, seconds, onSeconds])
  useEffect(() => { if (seconds === 0 && running) onRunning(false) }, [seconds, running, onRunning])
  const formatted = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const warning = seconds <= 10 * 60
  const critical = seconds <= 5 * 60
  const warningColor = critical
    ? 'text-red-700 dark:text-red-300'
    : warning ? 'text-red-500 dark:text-red-400' : undefined
  return <div className={cn('flex items-center gap-3 transition-colors', warning && 'rounded-md px-2 py-1')}><Clock3 size={18} className={warningColor}/><span aria-live="polite" className={cn('font-mono text-xl font-bold tabular-nums', warningColor)}>{formatted}</span><button onClick={() => onRunning(!running)} disabled={!seconds} className="grid size-9 place-items-center border border-line disabled:opacity-40 dark:border-neutral-700" aria-label={running ? '일시정지' : '시작'}>{running ? <Pause size={15}/> : <Play size={15}/>}</button><button onClick={onReset} className="grid size-9 place-items-center text-neutral-500" aria-label="초기화"><RotateCcw size={15}/></button></div>
}

function OmrGrid({ subject, answers, setAnswers, graded, answerKeys }: { subject: Subject; answers: AnswerMap; setAnswers: Dispatch<SetStateAction<AnswerMap>>; graded: boolean; answerKeys: Map<number, string> }) {
  const questionsPerTable = subject.question_count === 45 ? 15 : 10
  const tableCount = Math.ceil(subject.question_count / questionsPerTable)
  const setAnswer = (number: number, answer: string | number) => setAnswers(current => ({ ...current, [number]: answer }))
  return <div className={cn('grid min-w-0 gap-0 border-y border-line py-2 dark:border-neutral-800 sm:grid-cols-2', tableCount >= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>{Array.from({ length: tableCount }, (_, tableIndex) => { const first = tableIndex * questionsPerTable + 1; const last = Math.min(first + questionsPerTable - 1, subject.question_count); return <div key={tableIndex} className="min-w-0 border-x border-neutral-300 sm:border-y dark:border-neutral-700"><div className="hidden h-8 items-center border-b border-neutral-300 bg-neutral-100 px-3 text-xs font-bold text-neutral-500 sm:flex dark:border-neutral-700 dark:bg-neutral-900">{first}–{last}번</div>{Array.from({ length: last - first + 1 }, (_, offset) => first + offset).map(number => { const short = isMathShortAnswer(subject.area, number); const correctAnswer = answerKeys.get(number); const isCorrect = String(answers[number] ?? '') === correctAnswer; return <div key={number} className="flex h-9 items-center border-b border-line px-1 last:border-b-0 dark:border-neutral-800"><span className="w-8 text-center text-xs font-bold">{number}</span>{short ? <div className="flex flex-1 items-center justify-center gap-2"><input aria-label={`${number}번 단답형 답안`} inputMode="numeric" maxLength={3} value={typeof answers[number] === 'string' ? answers[number] : ''} onChange={event => setAnswer(number, event.target.value.replace(/\D/g, ''))} className={cn('h-7 w-20 border bg-transparent px-2 text-center text-xs font-bold', graded ? isCorrect ? 'border-green-600 text-green-700 dark:border-green-400 dark:text-green-300' : 'border-red-500 text-red-600 dark:border-red-400 dark:text-red-300' : 'border-neutral-300 dark:border-neutral-700')} placeholder="정답"/>{graded && correctAnswer ? <span aria-label={`${number}번 정답 ${correctAnswer}`} className="grid h-7 min-w-12 place-items-center border border-green-600 bg-green-600 px-2 text-xs font-bold text-white dark:border-green-400 dark:bg-green-400 dark:text-green-950">{correctAnswer}</span> : null}</div> : <div className="grid flex-1 grid-cols-5 place-items-center gap-1 px-1">{[1, 2, 3, 4, 5].map(value => <button key={value} onClick={() => setAnswer(number, value)} className={cn('grid size-7 place-items-center rounded-full border text-xs font-semibold', graded && String(value) === correctAnswer ? 'border-green-600 bg-green-600 text-white dark:border-green-400 dark:bg-green-400 dark:text-green-950' : graded && answers[number] === value ? 'border-red-500 bg-red-500 text-white dark:border-red-400 dark:bg-red-400 dark:text-red-950' : answers[number] === value ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black' : 'border-neutral-300 dark:border-neutral-700')}>{value}</button>)}</div>}<span className="grid w-5 shrink-0 place-items-center">{graded && (isCorrect ? <Check size={14} className="text-green-600"/> : <CircleX size={14} className="text-red-500"/>)}</span></div>})}</div> })}</div>
}

function AnswerKeyReportDialog({ user, exam, subject, onClose, onSubmitted }: { user: User; exam: ExamListItem; subject: Subject; onClose: () => void; onSubmitted: () => void }) {
  const [questionNumber, setQuestionNumber] = useState(1)
  const [issueType, setIssueType] = useState<AnswerKeyIssueType>('answer')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await createAnswerKeyReport(user.id, { examSubjectId: exam.examSubjectId, questionNumber, issueType, details }); onSubmitted() }
    catch (value) { setError(value instanceof Error ? value.message : '제보를 접수하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="answer-report-title"><form onSubmit={submit} className="w-full max-w-md border border-line bg-surface p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-950"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-neutral-500">{subject.name} · {exam.year}년 {exam.month}월</p><h2 id="answer-report-title" className="mt-1 text-xl font-bold">정답·배점 오류 제보</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="닫기" className="text-neutral-500"><X size={20}/></button></div><div className="mt-5 grid grid-cols-2 gap-3"><label className="text-sm font-semibold">문항<select value={questionNumber} onChange={event => setQuestionNumber(Number(event.target.value))} className="mt-2 h-10 w-full border border-line bg-transparent px-3 font-normal dark:border-neutral-700 dark:bg-neutral-950">{Array.from({ length: subject.question_count }, (_, index) => index + 1).map(number => <option key={number} value={number}>{number}번</option>)}</select></label><label className="text-sm font-semibold">오류 유형<select value={issueType} onChange={event => setIssueType(event.target.value as AnswerKeyIssueType)} className="mt-2 h-10 w-full border border-line bg-transparent px-3 font-normal dark:border-neutral-700 dark:bg-neutral-950"><option value="answer">정답</option><option value="points">배점</option><option value="both">정답·배점</option><option value="other">기타</option></select></label></div><label className="mt-4 block text-sm font-semibold">상세 내용 <span className="font-normal text-neutral-400">(선택)</span><textarea value={details} onChange={event => setDetails(event.target.value)} maxLength={1000} rows={4} className="mt-2 w-full resize-none border border-line bg-transparent p-3 font-normal dark:border-neutral-700" placeholder="확인이 필요한 내용을 알려 주세요."/></label>{error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className="h-10 px-4 text-sm font-semibold">취소</button><button disabled={busy} className="h-10 bg-ink px-4 text-sm font-bold text-white disabled:opacity-40 dark:bg-white dark:text-black">{busy ? '접수 중…' : '제보하기'}</button></div></form></div>
}

function ExamPage({ user, exam, subject, admin, openAdmin, onSaved }: { user: User; exam: ExamListItem; subject: Subject; admin: boolean; openAdmin: () => void; onSaved: (attempt: Awaited<ReturnType<typeof saveAttempt>>) => void }) {
  const [answers, setAnswers] = useState<AnswerMap>(() => parseAnswers(exam.attempt?.answers))
  const [seconds, setSeconds] = useState(exam.attempt?.remaining_seconds ?? subject.duration_seconds)
  const [running, setRunning] = useState(false)
  const [keys, setKeys] = useState<AnswerKey[]>([])
  const [graded, setGraded] = useState(Boolean(exam.attempt?.graded_at))
  const [score, setScore] = useState<number | null>(exam.attempt?.score ?? null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [resetting, setResetting] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [resourceError, setResourceError] = useState('')
  const [openingPath, setOpeningPath] = useState<string | null>(null)
  const mounted = useRef(false)
  const answersRef = useRef(answers)
  const secondsRef = useRef(seconds)
  const gradedRef = useRef(graded)
  const timerStartedRef = useRef((exam.attempt?.status === 'doing' && !answeredCount(parseAnswers(exam.attempt?.answers))) || seconds < subject.duration_seconds)
  answersRef.current = answers
  secondsRef.current = seconds
  gradedRef.current = graded
  const count = answeredCount(answers)
  const keyMap = useMemo(() => new Map(keys.map(key => [key.question_number, key.answer])), [keys])

  const openPdf = async (path: string) => {
    const pdfWindow = window.open('', '_blank')
    if (!pdfWindow) { setResourceError('새 창을 열지 못했습니다. 브라우저의 팝업 차단을 해제한 뒤 다시 시도해 주세요.'); return }
    pdfWindow.opener = null
    setResourceError(''); setOpeningPath(path)
    try { pdfWindow.location.href = await createExamPdfUrl(path) }
    catch (value) { pdfWindow.close(); setResourceError(value instanceof Error ? value.message : 'PDF를 열지 못했습니다. 잠시 후 다시 시도해 주세요.') }
    finally { setOpeningPath(null) }
  }

  useEffect(() => { loadAnswerKeys(exam.examSubjectId).then(setKeys).catch(value => setError(value.message)) }, [exam.examSubjectId])
  const persist = useCallback(async (options?: { graded?: boolean; score?: number | null; timerStarted?: boolean; force?: boolean }) => {
    const currentAnswers = answersRef.current
    const hasTimerStarted = options?.timerStarted ?? timerStartedRef.current
    if (!answeredCount(currentAnswers) && secondsRef.current === subject.duration_seconds && !options?.graded && !hasTimerStarted && !options?.force) return
    setSaveState('saving'); setError('')
    try {
      const didGrade = options?.graded ?? gradedRef.current
      const saved = await saveAttempt(user.id, exam.examSubjectId, { answers: currentAnswers, status: getAttemptStatus(answeredCount(currentAnswers), subject.question_count, didGrade, hasTimerStarted), score: options?.score, remainingSeconds: secondsRef.current, gradedAt: didGrade ? new Date().toISOString() : null })
      setSaveState('saved'); onSaved(saved)
    } catch (value) { setSaveState('error'); setError(value instanceof Error ? value.message : '저장하지 못했습니다.') }
  }, [exam.examSubjectId, onSaved, subject.duration_seconds, subject.question_count, user.id])

  useEffect(() => { if (!mounted.current) { mounted.current = true; return } setGraded(false); const id = window.setTimeout(() => void persist({ graded: false, score: null }), 700); return () => window.clearTimeout(id) }, [answers, persist])
  useEffect(() => { const id = window.setInterval(() => { if (secondsRef.current !== subject.duration_seconds) void persist() }, 15000); return () => window.clearInterval(id) }, [persist, subject.duration_seconds])
  useEffect(() => { const saveOnLeave = () => { void persist() }; window.addEventListener('pagehide', saveOnLeave); return () => { window.removeEventListener('pagehide', saveOnLeave); void persist() } }, [persist])

  const grade = async () => {
    if (!keys.length) { setError('정답표를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.'); return }
    const nextScore = scoreAnswers(answers, keys)
    setScore(nextScore); setGraded(true)
    await persist({ graded: true, score: nextScore })
  }
  const resetExam = async () => {
    if (!window.confirm('이 기출의 OMR 답안, 채점 결과와 타이머를 모두 초기화할까요?')) return
    const emptyAnswers: AnswerMap = {}
    setResetting(true); setRunning(false); setAnswers(emptyAnswers); setSeconds(subject.duration_seconds); setGraded(false); setScore(null)
    answersRef.current = emptyAnswers; secondsRef.current = subject.duration_seconds; gradedRef.current = false; timerStartedRef.current = false
    await persist({ graded: false, score: null, timerStarted: false, force: true })
    setResetting(false)
  }
  return <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10"><div className="mb-7 flex flex-col justify-between gap-5 border-b border-line pb-6 dark:border-neutral-800 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-neutral-500">{subject.name}</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">{exam.year}년 {exam.month}월 {exam.title}</h1></div><Timer seconds={seconds} running={running} initialSeconds={subject.duration_seconds} onSeconds={setSeconds} onRunning={value => { setRunning(value); if (value) { timerStartedRef.current = true; void persist({ timerStarted: true, force: true }) } else void persist() }} onReset={() => { setRunning(false); secondsRef.current = subject.duration_seconds; setSeconds(subject.duration_seconds); if (!gradedRef.current && !answeredCount(answersRef.current)) { timerStartedRef.current = false; void persist({ graded: false, score: null, timerStarted: false, force: true }) } else void persist() }}/></div>{exam.is_development_data && <div className="mb-6 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">개발용 샘플 시험·정답입니다. 공식 기출 정답으로 사용하지 마세요.</div>}<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]"><section className="min-w-0"><div className="mb-5 flex items-end justify-between"><div><h2 className="text-xl font-bold">OMR 답안</h2><p className="mt-1 text-sm text-neutral-500">문항별 답을 선택하면 자동 저장됩니다.</p></div><div className="text-right"><span className="text-sm font-semibold">{count}/{subject.question_count}</span><p className={cn('mt-1 text-xs', saveState === 'error' ? 'text-red-600' : 'text-neutral-400')}>{saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '저장됨' : saveState === 'error' ? '저장 실패' : ''}</p></div></div><OmrGrid subject={subject} answers={answers} setAnswers={setAnswers} graded={graded} answerKeys={keyMap}/></section><aside className="lg:sticky lg:top-24 lg:self-start"><div className="border-y border-line py-5 dark:border-neutral-800"><h3 className="font-bold">시험 자료</h3>{exam.question_pdf_path && <button onClick={() => void openPdf(exam.question_pdf_path!)} className="mt-4 flex w-full items-center justify-between py-2 text-left text-sm font-semibold">기출문제 PDF <Download size={16}/></button>}{exam.explanation_pdf_path && <button onClick={() => void openPdf(exam.explanation_pdf_path!)} className="flex w-full items-center justify-between py-2 text-left text-sm font-semibold">정답 및 해설 <ExternalLink size={16}/></button>}</div>{graded && score !== null && <div className="mt-5 bg-green-50 p-5 text-green-950 dark:bg-green-950 dark:text-green-100"><p className="text-sm font-bold">채점 완료</p><p className="mt-2 text-3xl font-bold">{score}점</p><p className="mt-1 text-xs opacity-70">미응답 문항은 오답으로 처리했어요.</p></div>}{error && <div className="mt-4 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-100"><p>{error}</p>{saveState === 'error' && <button onClick={() => void persist()} className="mt-2 font-bold underline">다시 저장</button>}</div>}<button onClick={grade} disabled={!keys.length || resetting} className="mt-5 h-12 w-full bg-ink font-bold text-white disabled:opacity-30 dark:bg-white dark:text-black">채점하기</button><button onClick={() => void resetExam()} disabled={resetting} className="mt-2 flex h-11 w-full items-center justify-center gap-2 border border-line text-sm font-semibold text-neutral-600 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300"><RotateCcw size={15}/>{resetting ? '초기화 중…' : '초기화'}</button>{admin ? <button onClick={openAdmin} className="mt-2 flex h-10 w-full items-center justify-center gap-2 border border-line text-xs font-semibold dark:border-neutral-700"><Settings size={14}/>관리자에서 수정</button> : null}<button onClick={() => { setReportSubmitted(false); setReportOpen(true) }} className="mt-4 w-full text-center text-xs text-neutral-400 underline underline-offset-4 hover:text-neutral-600">정답·배점 오류 제보</button>{reportSubmitted ? <p role="status" className="mt-2 text-center text-xs text-green-600">제보가 접수되었습니다.</p> : null}</aside></div>{reportOpen ? <AnswerKeyReportDialog user={user} exam={exam} subject={subject} onClose={() => setReportOpen(false)} onSubmitted={() => { setReportOpen(false); setReportSubmitted(true) }}/> : null}</main>
}

function AccountDeletionDialog({ user, googleReauthenticated, onClose }: { user: User; googleReauthenticated: boolean; onClose: () => void }) {
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isGoogleAccount = user.app_metadata.provider === 'google'
  const phraseConfirmed = confirmation === '계정 삭제' || googleReauthenticated

  const reauthenticateWithGoogle = async () => {
    if (!supabase || !phraseConfirmed) return
    setError('')
    sessionStorage.setItem(googleAccountDeletionKey, JSON.stringify({ userId: user.id }))
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin, queryParams: { prompt: 'login' } } })
    if (authError) { sessionStorage.removeItem(googleAccountDeletionKey); setError(authError.message) }
  }

  const permanentlyDelete = async () => {
    if (!supabase || !phraseConfirmed || (!isGoogleAccount && !password)) return
    setBusy(true); setError('')
    try {
      if (!isGoogleAccount) {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email ?? '', password })
        if (authError) throw authError
      }
      await deleteAccount()
      sessionStorage.removeItem(googleAccountDeletionKey)
      await supabase.auth.signOut({ scope: 'local' })
    } catch (value) {
      setError(value instanceof Error ? value.message : '계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-account-title"><section className="w-full max-w-md border border-line bg-surface p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-950"><div className="flex items-start justify-between gap-5"><div><p className="text-sm font-bold text-red-600">위험 영역</p><h2 id="delete-account-title" className="mt-1 text-xl font-bold">계정을 영구 삭제할까요?</h2></div><button onClick={onClose} disabled={busy} aria-label="닫기" className="text-neutral-500 hover:text-ink disabled:opacity-50 dark:hover:text-white"><X size={20}/></button></div><p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-neutral-300">프로필, 바로가기 과목, 기출 답안·점수와 타이머 기록이 즉시 삭제되며 복구할 수 없습니다.</p>{googleReauthenticated && <p role="status" className="mt-4 bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-100">Google 재인증을 완료했습니다. 아래 버튼을 누르면 계정이 영구 삭제됩니다.</p>}{!googleReauthenticated && <label className="mt-5 block text-sm font-semibold">계속하려면 <b className="text-red-600">계정 삭제</b>를 입력해 주세요.<input autoFocus value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-2 h-11 w-full border border-line bg-transparent px-3 font-normal dark:border-neutral-700" /></label>}{!isGoogleAccount && <label className="mt-4 block text-sm font-semibold">현재 비밀번호<input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={!phraseConfirmed || busy} className="mt-2 h-11 w-full border border-line bg-transparent px-3 font-normal disabled:opacity-50 dark:border-neutral-700" /></label>}{error && <p role="alert" className="mt-4 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-100">{error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={onClose} disabled={busy} className="h-11 px-4 text-sm font-semibold disabled:opacity-50">취소</button>{isGoogleAccount && !googleReauthenticated ? <button onClick={() => void reauthenticateWithGoogle()} disabled={!phraseConfirmed || busy} className="h-11 bg-ink px-4 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">Google로 재인증</button> : <button onClick={() => void permanentlyDelete()} disabled={!phraseConfirmed || (!isGoogleAccount && !password) || busy} className="h-11 bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? '삭제 중…' : '계정 영구 삭제'}</button>}</div></section></div>
}

function SettingsPage({ user, subjects, shortcuts, setShortcuts, dark, setDark, googleReauthenticated, clearGoogleReauthentication }: { user: User; subjects: Subject[]; shortcuts: number[]; setShortcuts: Dispatch<SetStateAction<number[]>>; dark: boolean; setDark: (value: boolean) => void; googleReauthenticated: boolean; clearGoogleReauthentication: () => void }) {
  const [error, setError] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(googleReauthenticated)
  const grouped = useMemo(() => { const map = new Map<string, Subject[]>(); subjects.forEach(subject => map.set(subject.area, [...(map.get(subject.area) ?? []), subject])); return map }, [subjects])
  useEffect(() => { if (googleReauthenticated) setDeleteDialogOpen(true) }, [googleReauthenticated])
  const change = async (subject: Subject) => {
    const enabled = !shortcuts.includes(subject.id)
    const before = shortcuts
    let next = enabled ? [...before, subject.id] : before.filter(id => id !== subject.id)
    if (enabled && !multiAreas.has(subject.area)) next = [...next.filter(id => subjects.find(item => item.id === id)?.area !== subject.area), subject.id]
    setShortcuts(next); setError('')
    try {
      const removed = before.filter(id => !next.includes(id))
      await Promise.all([...removed.map(id => toggleShortcut(user.id, id, false)), ...(enabled ? [toggleShortcut(user.id, subject.id, true)] : [])])
    } catch (value) { setShortcuts(before); setError(value instanceof Error ? value.message : '바로가기를 저장하지 못했습니다.') }
  }
  const closeDeleteDialog = () => { setDeleteDialogOpen(false); clearGoogleReauthentication() }
  return <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6"><h1 className="mb-3 text-3xl font-bold">설정</h1><p className="mb-10 text-sm text-neutral-500">자주 풀 과목을 선택하면 홈 바로가기에 표시됩니다.</p>{error && <p role="alert" className="mb-4 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<section className="border-t border-line dark:border-neutral-800"><div className="border-b border-line py-6 dark:border-neutral-800"><h2 className="mb-4 font-bold">바로가기</h2><div className="space-y-6">{[...grouped].map(([area, items]) => <div key={area}><div className="mb-2 flex items-center gap-2"><p className="text-sm font-semibold">{area}</p>{multiAreas.has(area) && <span className="text-xs text-neutral-400">복수 선택 가능</span>}</div><div className="flex flex-wrap gap-2">{items.map(item => <button key={item.id} onClick={() => void change(item)} className={cn('border px-3 py-2 text-xs', shortcuts.includes(item.id) ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black' : 'border-line dark:border-neutral-700')}>{item.name}</button>)}</div></div>)}</div></div><div className="flex items-center justify-between border-b border-line py-5 dark:border-neutral-800"><div><b>다크 모드</b><p className="mt-1 text-sm text-neutral-500">어두운 환경에서 눈의 피로를 줄입니다.</p></div><button onClick={() => setDark(!dark)} className={cn('relative h-7 w-12 rounded-full transition', dark ? 'bg-white' : 'bg-neutral-300')}><span className={cn('absolute top-1 size-5 rounded-full bg-neutral-900 transition', dark ? 'left-6' : 'left-1')}/></button></div><button onClick={() => void supabase?.auth.signOut()} className="flex w-full items-center gap-2 border-b border-line py-5 text-left text-red-600 dark:border-neutral-800"><LogOut size={17}/>로그아웃</button><div className="border-b border-line py-5 dark:border-neutral-800"><div className="flex items-start justify-between gap-4"><div><b className="text-red-600">계정 삭제</b><p className="mt-1 text-sm text-neutral-500">모든 학습 기록과 계정을 영구 삭제합니다.</p></div><button onClick={() => setDeleteDialogOpen(true)} className="flex shrink-0 items-center gap-2 border border-red-300 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"><Trash2 size={16}/>삭제</button></div></div></section>{deleteDialogOpen && <AccountDeletionDialog user={user} googleReauthenticated={googleReauthenticated} onClose={closeDeleteDialog}/>}</main>
}

function BottomNav({ page, setPage }: { page: Page; setPage: (page: Page) => void }) { return <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-3 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-neutral-800 dark:bg-neutral-950/95">{[{ id: 'home', label: '홈', Icon: Home }, { id: 'subjects', label: '기출', Icon: BookOpen }, { id: 'settings', label: '설정', Icon: Settings }].map(({ id, label, Icon }) => <button key={id} onClick={() => setPage(id as Page)} className={cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px]', page === id || (id === 'subjects' && page === 'list') ? 'font-bold' : 'text-neutral-500')}><Icon size={20}/>{label}</button>)}</nav> }

function AuthenticatedApp({ user }: { user: User }) {
  const [route, setRoute] = useState<Route>(readRoute)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subject, setSubject] = useState<Subject | null>(null)
  const [exams, setExams] = useState<CategorizedExamItem[]>([])
  const [attemptedExams, setAttemptedExams] = useState<AttemptedExamItem[]>([])
  const [selectedExam, setSelectedExam] = useState<CategorizedExamItem | null>(null)
  const [shortcuts, setShortcuts] = useState<number[]>([])
  const [displayName, setDisplayName] = useState('수험생')
  const [dark, setDarkState] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [admin, setAdmin] = useState(false)
  const [googleReauthenticatedForDeletion, setGoogleReauthenticatedForDeletion] = useState(false)
  const page = route.page
  const grouped = useMemo(() => { const map = new Map<string, Subject[]>(); subjects.forEach(item => map.set(item.area, [...(map.get(item.area) ?? []), item])); return map }, [subjects])
  const navigate = useCallback((next: Page, params: Omit<Route, 'page'> = {}) => { const nextRoute: Route = { page: next, ...params }; window.history.pushState(nextRoute, '', routePath(nextRoute)); setRoute(nextRoute); window.scrollTo({ top: 0, behavior: 'smooth' }) }, [])
  useEffect(() => { const onPopState = () => setRoute(readRoute()); window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState) }, [])
  useEffect(() => {
    if (route.subjectId) setSubject(subjects.find(item => item.id === route.subjectId) ?? null)
    else if (route.page !== 'list' && route.page !== 'exam') setSubject(null)
    if (route.examSubjectId) { const found = exams.find(item => item.examSubjectId === route.examSubjectId) ?? null; setSelectedExam(found); if (found) setSubject(found.subject) }
    else if (route.page !== 'exam') setSelectedExam(null)
  }, [route, subjects, exams])
  useEffect(() => { let active = true; loadBootstrap(user).then(async data => { if (!active) return { allExams: [], attempts: [] }; setSubjects(data.subjects); setShortcuts(data.shortcutSubjectIds); setDisplayName(data.displayName); setDarkState(data.theme === 'dark'); const [allExams, attempts] = await Promise.all([loadAllExamSubjects(user.id), loadAttemptedExams(user.id)]); return { allExams, attempts } }).then(data => { if (active) { setExams(data.allExams); setAttemptedExams(data.attempts) } }).catch(value => { if (active) setError(value.message) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [user])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  useEffect(() => { checkIsAdmin(user.id).then(setAdmin).catch(value => setError(value.message)) }, [user.id])
  useEffect(() => {
    const pending = sessionStorage.getItem(googleAccountDeletionKey)
    if (!pending) return
    sessionStorage.removeItem(googleAccountDeletionKey)
    try {
      const { userId } = JSON.parse(pending) as { userId?: string }
      if (userId === user.id) { setGoogleReauthenticatedForDeletion(true); navigate('settings') }
      else setError('Google로 다시 로그인한 계정이 원래 계정과 다릅니다. 계정 삭제를 취소했습니다.')
    } catch { setError('계정 삭제 재인증 정보를 확인하지 못했습니다. 다시 시도해 주세요.') }
  }, [user.id, navigate])

  const setDark = (value: boolean) => { setDarkState(value); void saveTheme(user.id, value ? 'dark' : 'light').catch(() => setError('테마 설정을 저장하지 못했습니다.')) }
  const go = (next: Page) => navigate(next)
  const updateAttempt = useCallback((attempt: Awaited<ReturnType<typeof saveAttempt>>) => { const update = <T extends CategorizedExamItem>(item: T) => item.examSubjectId === attempt.exam_subject_id ? { ...item, attempt, status: attempt.status, score: attempt.score ?? undefined, progress: answeredCount(parseAnswers(attempt.answers)) } : item; setExams(current => current.map(update)); setSelectedExam(current => current?.examSubjectId === attempt.exam_subject_id ? update(current) : current); void Promise.all([loadAllExamSubjects(user.id), loadAttemptedExams(user.id)]).then(([allExams, attempts]) => { setExams(allExams); setAttemptedExams(attempts) }).catch(value => setError(value.message)) }, [user.id])
  const openExam = (exam: CategorizedExamItem) => { setSubject(exam.subject); setSelectedExam(exam); navigate('exam', { examSubjectId: exam.examSubjectId, subjectId: exam.subjectId }) }
  const selectSubject = (next: Subject) => { setSubject(next); navigate('list', { subjectId: next.id }) }
  const reloadExamData = () => { setLoading(true); void Promise.all([loadAllExamSubjects(user.id), loadAttemptedExams(user.id)]).then(([allExams, attempts]) => { setExams(allExams); setAttemptedExams(attempts) }).catch(value => setError(value.message)).finally(() => setLoading(false)) }

  if (loading && !subjects.length) return <main className="grid min-h-screen place-items-center text-sm text-neutral-500">학습 기록을 불러오는 중…</main>
  if (error && !subjects.length) return <main className="grid min-h-screen place-items-center px-4"><div><h1 className="text-xl font-bold">데이터를 불러오지 못했습니다.</h1><p className="mt-2 text-sm text-red-600">{error}</p><button onClick={() => window.location.reload()} className="mt-4 underline">다시 시도</button></div></main>
  const shortcutIds = new Set(shortcuts)
  const recommendation = exams.find(exam => shortcutIds.has(exam.subjectId) && exam.status === 'new')
  return <div className="min-h-screen bg-surface text-ink transition-colors dark:bg-neutral-950 dark:text-neutral-100"><Header page={page} setPage={navigate} dark={dark} setDark={setDark} admin={admin}/>{loading && <div className="fixed left-0 right-0 top-16 z-20 h-0.5 animate-pulse bg-ink dark:bg-white"/>}{error && <div className="mx-auto mt-4 max-w-7xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-100">{error}</div>}{page === 'home' && <HomePage go={go} exams={attemptedExams} recommendation={recommendation} shortcuts={subjects.filter(item => shortcuts.includes(item.id))} displayName={displayName} selectShortcut={selectSubject} openExam={openExam}/>} {page === 'subjects' && <SubjectRequiredPage grouped={grouped} selectSubject={selectSubject}/>} {page === 'list' && (subject ? <ListPage subject={subject} exams={exams.filter(exam => exam.subjectId === subject.id)} openExam={openExam}/> : <SubjectRequiredPage grouped={grouped} selectSubject={selectSubject}/>)} {page === 'exam' && selectedExam && <ExamPage key={selectedExam.examSubjectId} user={user} exam={selectedExam} subject={selectedExam.subject} admin={admin} openAdmin={() => navigate('admin', { adminExamSubjectId: selectedExam.examSubjectId })} onSaved={updateAttempt}/>} {page === 'settings' && <SettingsPage user={user} subjects={subjects} shortcuts={shortcuts} setShortcuts={setShortcuts} dark={dark} setDark={setDark} googleReauthenticated={googleReauthenticatedForDeletion} clearGoogleReauthentication={() => setGoogleReauthenticatedForDeletion(false)}/>} {page === 'admin' && (admin ? <AdminPage user={user} subjects={subjects} onChanged={reloadExamData} initialSelectedId={route.adminExamSubjectId}/> : <main className="grid min-h-64 place-items-center text-sm text-red-600">관리자 권한이 없습니다.</main>)}<BottomNav page={page} setPage={navigate}/></div>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    const client = supabase
    let active = true
    let initialized = false
    const { data: authListener } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!active || (event === 'INITIAL_SESSION' && !initialized)) return
      setSession(nextSession)
      setLoading(false)
    })
    const restoreSession = async () => {
      const { data, error } = await client.auth.getSession()
      if (error) throw error
      let restored = data.session
      if (restored) {
        const expiresSoon = !restored.expires_at || restored.expires_at * 1000 <= Date.now() + 60_000
        if (expiresSoon) {
          const refreshed = await client.auth.refreshSession()
          if (refreshed.error) {
            await client.auth.signOut({ scope: 'local' })
            restored = null
          } else restored = refreshed.data.session
        }
      }
      initialized = true
      if (active) { setSession(restored); setLoading(false) }
    }
    void restoreSession().catch(() => {
      initialized = true
      if (active) { setSession(null); setLoading(false) }
    })
    return () => { active = false; authListener.subscription.unsubscribe() }
  }, [])
  if (!supabase) return <ConfigError/>
  if (loading) return <main className="grid min-h-screen place-items-center text-sm text-neutral-500">세션을 확인하는 중…</main>
  return session ? <AuthenticatedApp user={session.user}/> : <AuthPage/>
}

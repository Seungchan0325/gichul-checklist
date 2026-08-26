import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { BookOpen, Check, ChevronDown, CircleX, Clock3, Download, ExternalLink, Home, LogOut, Menu, Moon, Pause, Play, RotateCcw, Settings, Sun, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import { answeredCount, getAttemptStatus, isMathShortAnswer, parseAnswers, scoreAnswers, type AnswerKey, type AnswerMap } from './lib/exam'
import { loadAnswerKeys, loadAttemptedExams, loadBootstrap, loadExamsForSubject, saveAttempt, saveTheme, toggleShortcut, type AttemptedExamItem, type ExamListItem, type Subject } from './lib/data'

type Page = 'home' | 'list' | 'exam' | 'settings'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const cn = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(' ')
const multiAreas = new Set(['사회탐구', '과학탐구', '직업탐구'])

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

function Header({ page, setPage, subject, setSubject, grouped, dark, setDark }: { page: Page; setPage: (page: Page) => void; subject: Subject; setSubject: (subject: Subject) => void; grouped: Map<string, Subject[]>; dark: boolean; setDark: (value: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  return <header onMouseLeave={() => setOpen(false)} className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95"><div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6"><button onClick={() => setPage('home')} className="flex items-center gap-2 font-bold tracking-tight"><span className="grid size-8 place-items-center bg-ink text-sm text-white dark:bg-white dark:text-black">기</span><span className="hidden sm:inline">기출 체크리스트</span></button><button onClick={() => setOpen(!open)} className="ml-5 flex h-9 items-center gap-1.5 border-l border-line pl-5 text-sm font-semibold dark:border-neutral-700">{subject.name}<ChevronDown size={15} className={cn('transition', open && 'rotate-180')}/></button><nav className="ml-auto hidden items-center gap-1 md:flex">{[['home', '홈'], ['list', '기출문제'], ['settings', '설정']].map(([id, label]) => <button key={id} onClick={() => setPage(id as Page)} className={cn('px-3 py-2 text-sm', page === id ? 'font-bold' : 'text-neutral-500')}>{label}</button>)}<button aria-label="테마 변경" onClick={() => setDark(!dark)} className="ml-2 grid size-9 place-items-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button></nav><button className="ml-auto md:hidden" onClick={() => setMobile(!mobile)} aria-label="메뉴">{mobile ? <X/> : <Menu/>}</button></div>{open && <div className="absolute left-0 right-0 border-b border-line bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"><div className="mx-auto grid max-w-7xl gap-x-8 gap-y-5 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">{[...grouped].map(([area, items]) => <div key={area}><p className="mb-2 text-sm font-bold">{area}</p><div className="flex flex-wrap gap-1.5">{items.map(item => <button key={item.id} onClick={() => { setSubject(item); setOpen(false); setPage('list') }} className={cn('border px-2.5 py-1.5 text-xs', subject.id === item.id ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black' : 'border-line dark:border-neutral-700')}>{item.name}</button>)}</div></div>)}</div></div>}{mobile && <div className="border-t border-line px-4 py-3 md:hidden dark:border-neutral-800">{[['home', '홈'], ['list', '기출문제'], ['settings', '설정']].map(([id, label]) => <button key={id} onClick={() => { setPage(id as Page); setMobile(false) }} className="block w-full py-3 text-left text-sm font-semibold">{label}</button>)}</div>}</header>
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: () => void }) { return <div className="mb-4 flex items-end justify-between"><div>{eyebrow && <p className="mb-1 text-xs font-bold text-neutral-500">{eyebrow}</p>}<h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2></div>{action && <button onClick={action} className="text-sm font-semibold underline underline-offset-4">전체보기</button>}</div> }

function ExamRow({ exam, onClick, compact = false }: { exam: ExamListItem; onClick: () => void; compact?: boolean }) {
  return <button onClick={onClick} className={cn('group flex w-full items-center border-t border-line text-left transition hover:bg-neutral-100/70 dark:border-neutral-800 dark:hover:bg-neutral-900', compact ? 'py-3' : 'py-4 sm:py-5')}><div className={cn('mr-3 h-9 w-1 shrink-0', exam.status === 'done' ? 'bg-green-500' : exam.status === 'doing' ? 'bg-orange-400' : 'bg-neutral-200 dark:bg-neutral-700')}/><div className="min-w-0 flex-1"><p className="truncate font-semibold">{exam.year}년 {exam.month}월</p><p className="mt-0.5 truncate text-sm text-neutral-500">{exam.subjectName ? `${exam.subjectName} · ` : ''}{exam.title}</p></div>{exam.score !== undefined && <div className="ml-3 text-right"><b className="text-lg tabular-nums">{exam.score}</b><span className="text-xs text-neutral-500">점</span><p className="text-xs text-neutral-400">{exam.progress}문항</p></div>}</button>
}

function HomePage({ go, subject, exams, recommendation, shortcuts, displayName, selectShortcut, openAttempt }: { go: (page: Page, exam?: ExamListItem) => void; subject: Subject; exams: AttemptedExamItem[]; recommendation?: ExamListItem; shortcuts: Subject[]; displayName: string; selectShortcut: (subject: Subject) => void; openAttempt: (exam: AttemptedExamItem) => void }) {
  const doing = exams.filter(exam => exam.status === 'doing')
  const done = exams.filter(exam => exam.status === 'done').slice(0, 3)
  return <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12"><div className="mb-12 max-w-2xl"><p className="mb-2 text-sm font-semibold text-neutral-500">안녕하세요, {displayName}님</p><h1 className="text-3xl font-bold leading-tight tracking-[-0.04em] sm:text-4xl">오늘도 한 회씩,<br/>차근차근 풀어보세요.</h1></div><section className="mb-12"><SectionTitle eyebrow="내 선택과목" title="바로가기"/><div className={cn('grid border-y border-line dark:border-neutral-800', shortcuts.length ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1')}>{shortcuts.length ? shortcuts.map(item => <button key={item.id} onClick={() => selectShortcut(item)} className="flex min-h-24 flex-col justify-between border-r border-line p-4 text-left hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900"><BookOpen size={18}/><span className="font-bold">{item.name}</span></button>) : <p className="p-5 text-sm text-neutral-500">설정에서 응시할 과목을 선택하면 바로가기가 표시됩니다.</p>}</div></section><div className="grid gap-12 lg:grid-cols-[1.25fr_0.75fr]"><section><SectionTitle eyebrow="전체 과목 · 이어서 풀기" title="풀고 있는 기출" action={() => go('list')}/>{doing.length ? doing.map(exam => <ExamRow key={exam.examSubjectId} exam={exam} onClick={() => openAttempt(exam)}/>) : <p className="border-t border-line py-6 text-sm text-neutral-500 dark:border-neutral-800">진행 중인 시험이 없습니다.</p>}</section><section><SectionTitle eyebrow="전체 과목 · 최근 기록" title="최근 풀었던 기출"/>{done.length ? done.map(exam => <ExamRow compact key={exam.examSubjectId} exam={exam} onClick={() => openAttempt(exam)}/>) : <p className="border-t border-line py-6 text-sm text-neutral-500 dark:border-neutral-800">채점 완료 기록이 없습니다.</p>}</section></div>{recommendation && <section className="mt-12 border-y border-line py-7 dark:border-neutral-800"><p className="text-xs font-bold text-neutral-500">추천 기출</p><div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-xl font-bold">{recommendation.year}년 {recommendation.month}월 {recommendation.title}</h2><p className="mt-1 text-sm text-neutral-500">한 회분으로 실전 감각을 점검해 보세요.</p></div><button onClick={() => go('exam', recommendation)} className="h-11 bg-ink px-5 text-sm font-bold text-white dark:bg-white dark:text-black">풀어보기</button></div></section>}</main>
}

function ListPage({ subject, exams, go }: { subject: Subject; exams: ExamListItem[]; go: (page: Page, exam?: ExamListItem) => void }) {
  const years = useMemo(() => [...new Set(exams.map(exam => exam.year))].sort((a, b) => b - a), [exams])
  return <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12"><div className="mb-8"><p className="mb-2 text-sm font-semibold text-neutral-500">{subject.area}</p><h1 className="text-3xl font-bold tracking-tight">{subject.name} 기출</h1></div><div className="space-y-10">{years.map(year => <section key={year}><h2 className="mb-3 text-lg font-bold">{year}년</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{exams.filter(exam => exam.year === year).map(exam => <button key={exam.id} onClick={() => go('exam', exam)} className={cn('relative min-h-32 border p-4 text-left transition hover:-translate-y-0.5 sm:min-h-36', exam.status === 'done' ? 'border-green-300 bg-done text-green-950' : exam.status === 'doing' ? 'border-orange-300 bg-doing text-orange-950' : 'border-line bg-white dark:border-neutral-700 dark:bg-neutral-950 dark:text-white')}><p className="text-2xl font-bold">{exam.month}월</p><p className="mt-1 text-xs opacity-65">{exam.title}</p>{exam.score !== undefined && <div className="absolute bottom-3 right-3"><b className="text-xl">{exam.score}</b><span className="text-xs">점</span></div>}<span className="absolute bottom-4 left-4 text-xs font-semibold">{exam.status === 'done' ? '완료' : exam.status === 'doing' ? '진행 중' : '미응시'}</span></button>)}</div></section>)}</div></main>
}

function Timer({ seconds, running, initialSeconds, onSeconds, onRunning }: { seconds: number; running: boolean; initialSeconds: number; onSeconds: (seconds: number) => void; onRunning: (running: boolean) => void }) {
  useEffect(() => { if (!running) return; const id = window.setInterval(() => onSeconds(Math.max(0, seconds - 1)), 1000); return () => window.clearInterval(id) }, [running, seconds, onSeconds])
  useEffect(() => { if (seconds === 0 && running) onRunning(false) }, [seconds, running, onRunning])
  const formatted = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  return <div className="flex items-center gap-3"><Clock3 size={18}/><span className="font-mono text-xl font-bold tabular-nums">{formatted}</span><button onClick={() => onRunning(!running)} disabled={!seconds} className="grid size-9 place-items-center border border-line disabled:opacity-40 dark:border-neutral-700" aria-label={running ? '일시정지' : '시작'}>{running ? <Pause size={15}/> : <Play size={15}/>}</button><button onClick={() => { onSeconds(initialSeconds); onRunning(false) }} className="grid size-9 place-items-center text-neutral-500" aria-label="초기화"><RotateCcw size={15}/></button></div>
}

function OmrGrid({ subject, answers, setAnswers, graded, answerKeys }: { subject: Subject; answers: AnswerMap; setAnswers: Dispatch<SetStateAction<AnswerMap>>; graded: boolean; answerKeys: Map<number, string> }) {
  const questionsPerTable = subject.question_count === 45 ? 15 : 10
  const tableCount = Math.ceil(subject.question_count / questionsPerTable)
  const setAnswer = (number: number, answer: string | number) => setAnswers(current => ({ ...current, [number]: answer }))
  return <div className={cn('grid min-w-0 gap-0 border-y border-line py-2 dark:border-neutral-800 sm:grid-cols-2', tableCount >= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>{Array.from({ length: tableCount }, (_, tableIndex) => { const first = tableIndex * questionsPerTable + 1; const last = Math.min(first + questionsPerTable - 1, subject.question_count); return <div key={tableIndex} className="min-w-0 border-x border-neutral-300 sm:border-y dark:border-neutral-700"><div className="hidden h-8 items-center border-b border-neutral-300 bg-neutral-100 px-3 text-xs font-bold text-neutral-500 sm:flex dark:border-neutral-700 dark:bg-neutral-900">{first}–{last}번</div>{Array.from({ length: last - first + 1 }, (_, offset) => first + offset).map(number => { const short = isMathShortAnswer(subject.area, number); const isCorrect = String(answers[number] ?? '') === answerKeys.get(number); return <div key={number} className="flex h-9 items-center border-b border-line px-1 last:border-b-0 dark:border-neutral-800"><span className="w-8 text-center text-xs font-bold">{number}</span>{short ? <div className="flex flex-1 justify-center"><input aria-label={`${number}번 단답형 답안`} inputMode="numeric" maxLength={3} value={typeof answers[number] === 'string' ? answers[number] : ''} onChange={event => setAnswer(number, event.target.value.replace(/\D/g, ''))} className="h-7 w-20 border border-neutral-300 bg-transparent px-2 text-center text-xs font-bold dark:border-neutral-700" placeholder="정답"/></div> : <div className="grid flex-1 grid-cols-5 place-items-center gap-1 px-1">{[1, 2, 3, 4, 5].map(value => <button key={value} onClick={() => setAnswer(number, value)} className={cn('grid size-7 place-items-center rounded-full border text-xs font-semibold', answers[number] === value ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black' : 'border-neutral-300 dark:border-neutral-700')}>{value}</button>)}</div>}<span className="grid w-5 place-items-center">{graded && (isCorrect ? <Check size={14} className="text-green-600"/> : <CircleX size={14} className="text-red-500"/>)}</span></div>})}</div> })}</div>
}

function ExamPage({ user, exam, subject, back, onSaved }: { user: User; exam: ExamListItem; subject: Subject; back: () => void; onSaved: (attempt: Awaited<ReturnType<typeof saveAttempt>>) => void }) {
  const [answers, setAnswers] = useState<AnswerMap>(() => parseAnswers(exam.attempt?.answers))
  const [seconds, setSeconds] = useState(exam.attempt?.remaining_seconds ?? subject.duration_seconds)
  const [running, setRunning] = useState(false)
  const [keys, setKeys] = useState<AnswerKey[]>([])
  const [graded, setGraded] = useState(Boolean(exam.attempt?.graded_at))
  const [score, setScore] = useState<number | null>(exam.attempt?.score ?? null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState('')
  const mounted = useRef(false)
  const answersRef = useRef(answers)
  const secondsRef = useRef(seconds)
  const gradedRef = useRef(graded)
  answersRef.current = answers
  secondsRef.current = seconds
  gradedRef.current = graded
  const count = answeredCount(answers)
  const keyMap = useMemo(() => new Map(keys.map(key => [key.question_number, key.answer])), [keys])

  useEffect(() => { loadAnswerKeys(exam.examSubjectId).then(setKeys).catch(value => setError(value.message)) }, [exam.examSubjectId])
  const persist = useCallback(async (options?: { graded?: boolean; score?: number | null }) => {
    const currentAnswers = answersRef.current
    if (!answeredCount(currentAnswers) && secondsRef.current === subject.duration_seconds && !options?.graded) return
    setSaveState('saving'); setError('')
    try {
      const didGrade = options?.graded ?? gradedRef.current
      const saved = await saveAttempt(user.id, exam.examSubjectId, { answers: currentAnswers, status: getAttemptStatus(answeredCount(currentAnswers), subject.question_count, didGrade), score: options?.score, remainingSeconds: secondsRef.current, gradedAt: didGrade ? new Date().toISOString() : null })
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
  const leave = async () => { await persist(); back() }
  return <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10"><button onClick={leave} className="mb-5 text-sm text-neutral-500">← 목록으로</button><div className="mb-7 flex flex-col justify-between gap-5 border-b border-line pb-6 dark:border-neutral-800 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-neutral-500">{subject.name}</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">{exam.year}년 {exam.month}월 {exam.title}</h1></div><Timer seconds={seconds} running={running} initialSeconds={subject.duration_seconds} onSeconds={setSeconds} onRunning={value => { setRunning(value); if (!value) void persist() }}/></div>{exam.is_development_data && <div className="mb-6 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">개발용 샘플 시험·정답입니다. 공식 기출 정답으로 사용하지 마세요.</div>}<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]"><section className="min-w-0"><div className="mb-5 flex items-end justify-between"><div><h2 className="text-xl font-bold">OMR 답안</h2><p className="mt-1 text-sm text-neutral-500">문항별 답을 선택하면 자동 저장됩니다.</p></div><div className="text-right"><span className="text-sm font-semibold">{count}/{subject.question_count}</span><p className={cn('mt-1 text-xs', saveState === 'error' ? 'text-red-600' : 'text-neutral-400')}>{saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '저장됨' : saveState === 'error' ? '저장 실패' : ''}</p></div></div><OmrGrid subject={subject} answers={answers} setAnswers={setAnswers} graded={graded} answerKeys={keyMap}/></section><aside className="lg:sticky lg:top-24 lg:self-start"><div className="border-y border-line py-5 dark:border-neutral-800"><h3 className="font-bold">시험 자료</h3>{exam.question_url && <a href={exam.question_url} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-between py-2 text-sm font-semibold">기출문제 PDF <Download size={16}/></a>}{exam.explanation_url && <a href={exam.explanation_url} target="_blank" rel="noreferrer" className="flex items-center justify-between py-2 text-sm font-semibold">정답 및 해설 <ExternalLink size={16}/></a>}</div>{graded && score !== null && <div className="mt-5 bg-green-50 p-5 text-green-950 dark:bg-green-950 dark:text-green-100"><p className="text-sm font-bold">채점 완료</p><p className="mt-2 text-3xl font-bold">{score}점</p><p className="mt-1 text-xs opacity-70">미응답 문항은 오답으로 처리했어요.</p></div>}{error && <div className="mt-4 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-100"><p>{error}</p>{saveState === 'error' && <button onClick={() => void persist()} className="mt-2 font-bold underline">다시 저장</button>}</div>}<button onClick={grade} disabled={!keys.length} className="mt-5 h-12 w-full bg-ink font-bold text-white disabled:opacity-30 dark:bg-white dark:text-black">채점하기</button></aside></div></main>
}

function SettingsPage({ user, subjects, shortcuts, setShortcuts, dark, setDark }: { user: User; subjects: Subject[]; shortcuts: number[]; setShortcuts: Dispatch<SetStateAction<number[]>>; dark: boolean; setDark: (value: boolean) => void }) {
  const [error, setError] = useState('')
  const grouped = useMemo(() => { const map = new Map<string, Subject[]>(); subjects.forEach(subject => map.set(subject.area, [...(map.get(subject.area) ?? []), subject])); return map }, [subjects])
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
  return <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6"><h1 className="mb-3 text-3xl font-bold">설정</h1><p className="mb-10 text-sm text-neutral-500">자주 풀 과목을 선택하면 홈 바로가기에 표시됩니다.</p>{error && <p role="alert" className="mb-4 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<section className="border-t border-line dark:border-neutral-800"><div className="border-b border-line py-6 dark:border-neutral-800"><h2 className="mb-4 font-bold">바로가기</h2><div className="space-y-6">{[...grouped].map(([area, items]) => <div key={area}><div className="mb-2 flex items-center gap-2"><p className="text-sm font-semibold">{area}</p>{multiAreas.has(area) && <span className="text-xs text-neutral-400">복수 선택 가능</span>}</div><div className="flex flex-wrap gap-2">{items.map(item => <button key={item.id} onClick={() => void change(item)} className={cn('border px-3 py-2 text-xs', shortcuts.includes(item.id) ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black' : 'border-line dark:border-neutral-700')}>{item.name}</button>)}</div></div>)}</div></div><div className="flex items-center justify-between border-b border-line py-5 dark:border-neutral-800"><div><b>다크 모드</b><p className="mt-1 text-sm text-neutral-500">어두운 환경에서 눈의 피로를 줄입니다.</p></div><button onClick={() => setDark(!dark)} className={cn('relative h-7 w-12 rounded-full transition', dark ? 'bg-white' : 'bg-neutral-300')}><span className={cn('absolute top-1 size-5 rounded-full bg-neutral-900 transition', dark ? 'left-6' : 'left-1')}/></button></div><button onClick={() => void supabase?.auth.signOut()} className="flex w-full items-center gap-2 border-b border-line py-5 text-left text-red-600 dark:border-neutral-800"><LogOut size={17}/>로그아웃</button></section></main>
}

function BottomNav({ page, setPage }: { page: Page; setPage: (page: Page) => void }) { return <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-3 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-neutral-800 dark:bg-neutral-950/95">{[{ id: 'home', label: '홈', Icon: Home }, { id: 'list', label: '기출', Icon: BookOpen }, { id: 'settings', label: '설정', Icon: Settings }].map(({ id, label, Icon }) => <button key={id} onClick={() => setPage(id as Page)} className={cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px]', page === id ? 'font-bold' : 'text-neutral-500')}><Icon size={20}/>{label}</button>)}</nav> }

function AuthenticatedApp({ user }: { user: User }) {
  const [page, setPage] = useState<Page>('home')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subject, setSubjectState] = useState<Subject | null>(null)
  const [exams, setExams] = useState<ExamListItem[]>([])
  const [attemptedExams, setAttemptedExams] = useState<AttemptedExamItem[]>([])
  const [selectedExam, setSelectedExam] = useState<ExamListItem | null>(null)
  const [shortcuts, setShortcuts] = useState<number[]>([])
  const [displayName, setDisplayName] = useState('수험생')
  const [dark, setDarkState] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const grouped = useMemo(() => { const map = new Map<string, Subject[]>(); subjects.forEach(item => map.set(item.area, [...(map.get(item.area) ?? []), item])); return map }, [subjects])

  useEffect(() => { let active = true; loadBootstrap(user).then(async data => { if (!active) return { subjectExams: [], attempts: [] }; const initial = data.subjects.find(item => item.name === '미적분') ?? data.subjects[0]; setSubjects(data.subjects); setSubjectState(initial); setShortcuts(data.shortcutSubjectIds); setDisplayName(data.displayName); setDarkState(data.theme === 'dark'); const [subjectExams, attempts] = await Promise.all([initial ? loadExamsForSubject(user.id, initial.id) : [], loadAttemptedExams(user.id)]); return { subjectExams, attempts } }).then(data => { if (active) { setExams(data.subjectExams); setAttemptedExams(data.attempts) } }).catch(value => { if (active) setError(value.message) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [user])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])

  const setSubject = async (next: Subject) => { setSubjectState(next); setLoading(true); setError(''); try { setExams(await loadExamsForSubject(user.id, next.id)) } catch (value) { setError(value instanceof Error ? value.message : '시험 목록을 불러오지 못했습니다.') } finally { setLoading(false) } }
  const setDark = (value: boolean) => { setDarkState(value); void saveTheme(user.id, value ? 'dark' : 'light').catch(() => setError('테마 설정을 저장하지 못했습니다.')) }
  const go = (next: Page, exam?: ExamListItem) => { if (exam) setSelectedExam(exam); setPage(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const updateAttempt = useCallback((attempt: Awaited<ReturnType<typeof saveAttempt>>) => { setExams(current => current.map(item => item.examSubjectId === attempt.exam_subject_id ? { ...item, attempt, status: attempt.status, score: attempt.score ?? undefined, progress: answeredCount(parseAnswers(attempt.answers)) } : item)); setSelectedExam(current => current?.examSubjectId === attempt.exam_subject_id ? { ...current, attempt, status: attempt.status, score: attempt.score ?? undefined, progress: answeredCount(parseAnswers(attempt.answers)) } : current); void loadAttemptedExams(user.id).then(setAttemptedExams).catch(value => setError(value.message)) }, [user.id])
  const openAttempt = (exam: AttemptedExamItem) => { setSubjectState(exam.subject); setSelectedExam(exam); setPage('exam'); window.scrollTo({ top: 0, behavior: 'smooth' }); if (subject?.id !== exam.subject.id) void loadExamsForSubject(user.id, exam.subject.id).then(setExams).catch(value => setError(value.message)) }

  if (loading && !subject) return <main className="grid min-h-screen place-items-center text-sm text-neutral-500">학습 기록을 불러오는 중…</main>
  if (error && !subject) return <main className="grid min-h-screen place-items-center px-4"><div><h1 className="text-xl font-bold">데이터를 불러오지 못했습니다.</h1><p className="mt-2 text-sm text-red-600">{error}</p><button onClick={() => window.location.reload()} className="mt-4 underline">다시 시도</button></div></main>
  if (!subject) return null
  return <div className="min-h-screen bg-surface text-ink transition-colors dark:bg-neutral-950 dark:text-neutral-100"><Header page={page} setPage={setPage} subject={subject} setSubject={next => void setSubject(next)} grouped={grouped} dark={dark} setDark={setDark}/>{loading && <div className="fixed left-0 right-0 top-16 z-20 h-0.5 animate-pulse bg-ink dark:bg-white"/>}{error && <div className="mx-auto mt-4 max-w-7xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-100">{error}</div>}{page === 'home' && <HomePage go={go} subject={subject} exams={attemptedExams} recommendation={exams.find(exam => exam.month === 11) ?? exams[0]} shortcuts={subjects.filter(item => shortcuts.includes(item.id))} displayName={displayName} selectShortcut={next => { void setSubject(next); setPage('list') }} openAttempt={openAttempt}/>} {page === 'list' && <ListPage subject={subject} exams={exams} go={go}/>} {page === 'exam' && selectedExam && <ExamPage key={selectedExam.examSubjectId} user={user} exam={selectedExam} subject={subject} back={() => go('list')} onSaved={updateAttempt}/>} {page === 'settings' && <SettingsPage user={user} subjects={subjects} shortcuts={shortcuts} setShortcuts={setShortcuts} dark={dark} setDark={setDark}/>}<BottomNav page={page} setPage={setPage}/></div>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { if (!supabase) { setLoading(false); return } supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) }); const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setLoading(false) }); return () => data.subscription.unsubscribe() }, [])
  if (!supabase) return <ConfigError/>
  if (loading) return <main className="grid min-h-screen place-items-center text-sm text-neutral-500">세션을 확인하는 중…</main>
  return session ? <AuthenticatedApp user={session.user}/> : <AuthPage/>
}

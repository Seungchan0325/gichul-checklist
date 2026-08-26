import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { BookOpen, Check, ChevronDown, Clock3, Download, ExternalLink, Home, LogOut, Menu, Moon, Pause, Play, RotateCcw, Settings, Sun, X } from 'lucide-react'

type Page = 'home' | 'list' | 'exam' | 'settings'
type Status = 'done' | 'doing' | 'new'
type Exam = { id: number; year: number; month: number; title: string; status: Status; score?: number; progress?: number }

const subjects: Record<string, string[]> = {
  '국어': ['화법과 작문', '언어와 매체'],
  '수학': ['확률과 통계', '미적분', '기하'],
  '영어': [], '한국사': [],
  '사회탐구': ['생활과 윤리', '윤리와 사상', '한국지리', '세계지리', '동아시아사', '세계사', '정치와 법', '경제', '사회·문화'],
  '과학탐구': ['물리학Ⅰ', '물리학Ⅱ', '화학Ⅰ', '화학Ⅱ', '생명과학Ⅰ', '생명과학Ⅱ', '지구과학Ⅰ', '지구과학Ⅱ'],
  '직업탐구': ['농업 기초 기술', '공업 일반', '상업 경제', '수산·해운 산업 기초', '인간 발달', '성공적인 직업 생활'],
  '제2외국어/한문': ['독일어Ⅰ', '프랑스어Ⅰ', '스페인어Ⅰ', '중국어Ⅰ', '일본어Ⅰ', '러시아어Ⅰ', '아랍어Ⅰ', '베트남어Ⅰ', '한문Ⅰ'],
}

const exams: Exam[] = [
  { id: 1, year: 2026, month: 3, title: '3월 전국연합학력평가', status: 'new' },
  { id: 2, year: 2026, month: 6, title: '6월 모의평가', status: 'doing', score: 68, progress: 18 },
  { id: 3, year: 2026, month: 9, title: '9월 모의평가', status: 'new' },
  { id: 4, year: 2025, month: 3, title: '3월 전국연합학력평가', status: 'done', score: 84, progress: 30 },
  { id: 5, year: 2025, month: 6, title: '6월 모의평가', status: 'done', score: 92, progress: 30 },
  { id: 6, year: 2025, month: 9, title: '9월 모의평가', status: 'doing', score: 44, progress: 12 },
  { id: 7, year: 2025, month: 11, title: '대학수학능력시험', status: 'new' },
  { id: 8, year: 2024, month: 6, title: '6월 모의평가', status: 'done', score: 88, progress: 30 },
  { id: 9, year: 2024, month: 9, title: '9월 모의평가', status: 'new' },
  { id: 10, year: 2024, month: 11, title: '대학수학능력시험', status: 'new' },
]

const cn = (...x: (string | false | undefined)[]) => x.filter(Boolean).join(' ')
const multiAreas = new Set(['사회탐구', '과학탐구', '직업탐구'])
const questionCount = (subject: string) => {
  if (subject === '영어' || subject === '국어' || subjects['국어'].includes(subject)) return 45
  if (subject === '한국사' || subjects['사회탐구'].includes(subject) || subjects['과학탐구'].includes(subject) || subjects['직업탐구'].includes(subject)) return 20
  if (subjects['제2외국어/한문'].includes(subject)) return 30
  return 30 // 수학 및 수학 선택과목
}
const isMathSubject = (subject: string) => subject === '수학' || subjects['수학'].includes(subject)
const isMathShortAnswer = (number: number) => (number >= 16 && number <= 22) || number >= 29
const examDuration = (subject: string) => {
  if (subject === '영어') return 70 * 60
  if (subject === '국어' || subjects['국어'].includes(subject)) return 80 * 60
  if (isMathSubject(subject)) return 100 * 60
  if (subject === '한국사' || subjects['사회탐구'].includes(subject) || subjects['과학탐구'].includes(subject) || subjects['직업탐구'].includes(subject)) return 30 * 60
  return 40 * 60 // 제2외국어/한문
}

function Header({ page, setPage, subject, setSubject, dark, setDark }: { page: Page; setPage: (p: Page) => void; subject: string; setSubject: (s: string) => void; dark: boolean; setDark: (v: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  return <>
    <header onMouseLeave={() => setOpen(false)} className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
        <button onClick={() => setPage('home')} className="flex items-center gap-2 font-bold tracking-tight"><span className="grid size-8 place-items-center bg-ink text-sm text-white dark:bg-white dark:text-black">기</span><span className="hidden sm:inline">기출 체크리스트</span></button>
        <button onClick={() => setOpen(!open)} className="ml-5 flex h-9 items-center gap-1.5 border-l border-line pl-5 text-sm font-semibold dark:border-neutral-700">{subject}<ChevronDown size={15} className={cn('transition', open && 'rotate-180')} /></button>
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {[['home','홈'],['list','기출문제'],['settings','설정']].map(([id,label]) => <button key={id} onClick={() => setPage(id as Page)} className={cn('px-3 py-2 text-sm', page === id ? 'font-bold text-ink dark:text-white' : 'text-neutral-500')}>{label}</button>)}
          <button aria-label="테마 변경" onClick={() => setDark(!dark)} className="ml-2 grid size-9 place-items-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
        </nav>
        <button className="ml-auto md:hidden" onClick={() => setMobile(!mobile)} aria-label="메뉴">{mobile ? <X/> : <Menu/>}</button>
      </div>
      {open && <div className="absolute left-0 right-0 border-b border-line bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6"><p className="mb-3 text-xs font-semibold text-neutral-500">과목 탐색</p><div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(subjects).map(([main, subs]) => <div key={main}><button onClick={() => {if(!subs.length){setSubject(main);setOpen(false);setPage('list')}}} className={cn('mb-2 text-sm font-bold', subs.length ? 'cursor-default' : 'hover:underline')}>{main}</button>{subs.length > 0 && <div className="flex flex-wrap gap-1.5">{subs.map(s => <button key={s} onClick={() => {setSubject(s);setOpen(false);setPage('list')}} className={cn('border px-2.5 py-1.5 text-xs transition', subject === s ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black' : 'border-line hover:border-neutral-400 dark:border-neutral-700')}>{s}</button>)}</div>}</div>)}</div></div>
      </div>}
      {mobile && <div className="border-t border-line px-4 py-3 md:hidden dark:border-neutral-800">{[['home','홈'],['list','기출문제'],['settings','설정']].map(([id,label]) => <button key={id} onClick={() => {setPage(id as Page);setMobile(false)}} className="block w-full py-3 text-left text-sm font-semibold">{label}</button>)}</div>}
    </header>
  </>
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: () => void }) { return <div className="mb-4 flex items-end justify-between"><div>{eyebrow && <p className="mb-1 text-xs font-bold text-neutral-500">{eyebrow}</p>}<h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2></div>{action && <button onClick={action} className="text-sm font-semibold underline underline-offset-4">전체보기</button>}</div> }

function ExamRow({ exam, onClick, compact=false }: { exam: Exam; onClick: () => void; compact?: boolean }) {
  return <button onClick={onClick} className={cn('group flex w-full items-center border-t border-line text-left transition hover:bg-neutral-100/70 dark:border-neutral-800 dark:hover:bg-neutral-900', compact ? 'py-3' : 'py-4 sm:py-5')}>
    <div className={cn('mr-3 h-9 w-1 shrink-0', exam.status === 'done' ? 'bg-green-500' : exam.status === 'doing' ? 'bg-orange-400' : 'bg-neutral-200 dark:bg-neutral-700')} />
    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{exam.year}년 {exam.month}월</p><p className="mt-0.5 truncate text-sm text-neutral-500">{exam.title}</p></div>
    {exam.score !== undefined && <div className="ml-3 text-right"><b className="text-lg tabular-nums">{exam.score}</b><span className="text-xs text-neutral-500">점</span>{exam.progress && <p className="text-xs text-neutral-400">{exam.progress}/30</p>}</div>}
  </button>
}

function HomePage({ go, subject, selectedSubjects }: { go: (p: Page, e?: Exam) => void; subject: string; selectedSubjects: string[] }) {
  const shortcuts = selectedSubjects
  return <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
    <div className="mb-12 max-w-2xl"><p className="mb-2 text-sm font-semibold text-neutral-500">안녕하세요, 수험생님</p><h1 className="text-3xl font-bold leading-tight tracking-[-0.04em] sm:text-4xl">오늘도 한 회씩,<br/>차근차근 풀어보세요.</h1></div>
    <section className="mb-12"><SectionTitle eyebrow="내 선택과목" title="바로가기" /><div className={cn('grid border-y border-line dark:border-neutral-800', shortcuts.length > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1')}>
      {shortcuts.length ? shortcuts.map((s,i) => <button key={s} onClick={() => go('list')} className={cn('flex min-h-24 flex-col justify-between p-4 text-left hover:bg-neutral-100 dark:hover:bg-neutral-900', i%2===0 && 'border-r border-line dark:border-neutral-800', i<2 && 'max-sm:border-b max-sm:border-line', i===1 && 'sm:border-r sm:border-line', i===2 && 'sm:border-r sm:border-line')}><BookOpen size={18}/><span className="font-bold">{s}</span></button>) : <p className="p-5 text-sm text-neutral-500">설정에서 응시할 과목을 선택하면 바로가기가 표시됩니다.</p>}
    </div></section>
    <div className="grid gap-12 lg:grid-cols-[1.25fr_0.75fr]">
      <section><SectionTitle eyebrow={`${subject} · 이어서 풀기`} title="풀고 있는 기출" action={() => go('list')} /><div>{exams.filter(e=>e.status==='doing').map(e=><ExamRow key={e.id} exam={e} onClick={()=>go('exam',e)}/>)}</div></section>
      <section><SectionTitle eyebrow="최근 기록" title="최근 풀었던 기출" /><div>{exams.filter(e=>e.status==='done').slice(0,3).map(e=><ExamRow compact key={e.id} exam={e} onClick={()=>go('exam',e)}/>)}</div></section>
    </div>
    <section className="mt-12 border-y border-line py-7 dark:border-neutral-800"><p className="text-xs font-bold text-neutral-500">추천 기출</p><div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-xl font-bold">2024학년도 대학수학능력시험</h2><p className="mt-1 text-sm text-neutral-500">지난 수능으로 실전 감각을 점검해 보세요.</p></div><button onClick={()=>go('exam',exams[9])} className="h-11 bg-ink px-5 text-sm font-bold text-white dark:bg-white dark:text-black">풀어보기</button></div></section>
  </main>
}

function ListPage({ subject, go }: { subject: string; go: (p: Page, e?: Exam) => void }) {
  const years = useMemo(()=>[...new Set(exams.map(e=>e.year))].sort((a,b)=>b-a),[])
  return <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12"><div className="mb-8 flex items-end justify-between"><div><p className="mb-2 text-sm font-semibold text-neutral-500">선택과목</p><h1 className="text-3xl font-bold tracking-tight">{subject} 기출</h1></div><div className="hidden items-center gap-4 text-xs sm:flex"><span className="flex items-center gap-1.5"><i className="size-2.5 bg-green-400"/>완료</span><span className="flex items-center gap-1.5"><i className="size-2.5 bg-orange-400"/>진행 중</span><span className="flex items-center gap-1.5"><i className="size-2.5 border border-line bg-white"/>미응시</span></div></div>
    <div className="space-y-10">{years.map(year=><section key={year}><h2 className="mb-3 text-lg font-bold">{year}년</h2><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{exams.filter(e=>e.year===year).sort((a,b)=>a.month-b.month).map(e=><button key={e.id} onClick={()=>go('exam',e)} className={cn('relative min-h-32 border p-4 text-left transition hover:-translate-y-0.5 sm:min-h-36',e.status==='done'?'border-green-300 bg-done text-green-950':e.status==='doing'?'border-orange-300 bg-doing text-orange-950':'border-line bg-white hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white')}><p className="text-2xl font-bold">{e.month}월</p><p className="mt-1 text-xs opacity-65">{e.title}</p>{e.score!==undefined&&<div className="absolute bottom-3 right-3 text-right"><b className="text-xl">{e.score}</b><span className="text-xs">점</span></div>}<span className="absolute bottom-4 left-4 text-xs font-semibold">{e.status==='done'?'완료':e.status==='doing'?'진행 중':'미응시'}</span></button>)}</div></section>)}</div>
  </main>
}

function Timer({ initialSeconds }: { initialSeconds: number }) {
  const [seconds,setSeconds]=useState(initialSeconds), [running,setRunning]=useState(false)
  useEffect(()=>{setSeconds(initialSeconds);setRunning(false)},[initialSeconds])
  useEffect(()=>{if(!running)return;const id=window.setInterval(()=>setSeconds(value=>{if(value<=1){setRunning(false);return 0}return value-1}),1000);return()=>window.clearInterval(id)},[running])
  const fmt=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`
  return <div className="flex items-center gap-3"><Clock3 size={18}/><span className="font-mono text-xl font-bold tabular-nums">{fmt}</span><button onClick={()=>setRunning(value=>!value)} disabled={seconds===0} className="grid size-9 place-items-center border border-line disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700" aria-label={running?'일시정지':'시작'}>{running?<Pause size={15}/>:<Play size={15}/>}</button><button onClick={()=>{setSeconds(initialSeconds);setRunning(false)}} className="grid size-9 place-items-center text-neutral-500" aria-label="초기화"><RotateCcw size={15}/></button></div>
}

function OmrGrid({ subject, totalQuestions, answers, setAnswers, graded, setGraded }: {
  subject: string
  totalQuestions: number
  answers: Record<number, number|string>
  setAnswers: Dispatch<SetStateAction<Record<number, number|string>>>
  graded: boolean
  setGraded: (value: boolean) => void
}) {
  const questionsPerTable = totalQuestions === 45 ? 15 : 10
  const tableCount = Math.ceil(totalQuestions / questionsPerTable)

  return <div className={cn('grid min-w-0 gap-0 border-y border-line py-2 dark:border-neutral-800 sm:grid-cols-2', tableCount >= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
    {Array.from({ length: tableCount }, (_, tableIndex) => {
      const first = tableIndex * questionsPerTable + 1
      const last = Math.min(first + questionsPerTable - 1, totalQuestions)
      return <div key={tableIndex} className="min-w-0 border-x border-neutral-300 sm:border-y dark:border-neutral-700">
        <div className="hidden h-8 items-center border-b border-neutral-300 bg-neutral-100 px-3 text-xs font-bold text-neutral-500 sm:flex dark:border-neutral-700 dark:bg-neutral-900">{first}–{last}번</div>
        {Array.from({ length: last - first + 1 }, (_, offset) => first + offset).map(number => {
          const shortAnswer = isMathSubject(subject) && isMathShortAnswer(number)
          return <div key={number} className={cn('flex h-9 items-center border-b border-line px-1 last:border-b-0 dark:border-neutral-800', number % 5 === 1 && 'border-t-2 border-t-neutral-400 dark:border-t-neutral-500', number % 5 === 0 && 'border-b-2 border-b-neutral-400 dark:border-b-neutral-500')}>
            <span className="w-8 shrink-0 text-center text-xs font-bold tabular-nums">{number}</span>
            {shortAnswer ? <div className="flex min-w-0 flex-1 justify-center"><input aria-label={`${number}번 단답형 답안`} inputMode="numeric" maxLength={3} value={typeof answers[number] === 'string' ? answers[number] : ''} onChange={event=>{setGraded(false);setAnswers(current=>({...current,[number]:event.target.value.replace(/\D/g,'')}))}} className="h-7 w-20 border border-neutral-300 bg-transparent px-2 text-center text-xs font-bold tabular-nums dark:border-neutral-700" placeholder="정답"/></div> : <div className="grid min-w-0 flex-1 grid-cols-5 place-items-center gap-1 px-1">{[1,2,3,4,5].map(value=><button key={value} onClick={()=>{setGraded(false);setAnswers(current=>({...current,[number]:value}))}} className={cn('grid size-7 place-items-center rounded-full border text-xs font-semibold transition',answers[number]===value?'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black':'border-neutral-300 hover:border-neutral-500 dark:border-neutral-700')}>{value}</button>)}</div>}
            <span className="grid w-5 shrink-0 place-items-center">{graded && answers[number] && <Check size={14} className="text-green-600"/>}</span>
          </div>
        })}
      </div>
    })}
  </div>
}

function ExamPage({ exam, subject, back }: { exam: Exam; subject: string; back: () => void }) {
  const totalQuestions = questionCount(subject)
  const [answers,setAnswers]=useState<Record<number,number|string>>(()=>Object.fromEntries(Array.from({length:exam.progress||0},(_,i)=>[i+1,(i%5)+1])))
  const [graded,setGraded]=useState(false)
  return <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10"><button onClick={back} className="mb-5 text-sm text-neutral-500 hover:text-ink">← 목록으로</button><div className="mb-7 flex flex-col justify-between gap-5 border-b border-line pb-6 dark:border-neutral-800 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-neutral-500">{subject}</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">{exam.year}년 {exam.month}월 {exam.title}</h1></div><Timer initialSeconds={examDuration(subject)}/></div>
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]"><section className="min-w-0"><div className="mb-5 flex items-end justify-between"><div><h2 className="text-xl font-bold">OMR 답안</h2><p className="mt-1 text-sm text-neutral-500">문항별 답을 선택하면 자동 저장됩니다.</p></div><span className="text-sm font-semibold">{Object.keys(answers).length}/{totalQuestions}</span></div>
      <OmrGrid subject={subject} totalQuestions={totalQuestions} answers={answers} setAnswers={setAnswers} graded={graded} setGraded={setGraded}/>
    </section><aside className="lg:sticky lg:top-24 lg:self-start"><div className="border-y border-line py-5 dark:border-neutral-800"><h3 className="font-bold">시험 자료</h3><a href="https://www.ebsi.co.kr" target="_blank" className="mt-4 flex items-center justify-between py-2 text-sm font-semibold">기출문제 PDF <Download size={16}/></a><a href="https://www.ebsi.co.kr" target="_blank" className="flex items-center justify-between py-2 text-sm font-semibold">정답 및 해설 <ExternalLink size={16}/></a><p className="mt-2 text-xs leading-5 text-neutral-500">EBSi 웹사이트에서 자료를 확인합니다.</p></div>{graded&&<div className="mt-5 bg-green-50 p-5 text-green-950 dark:bg-green-950 dark:text-green-100"><p className="text-sm font-bold">채점 완료</p><p className="mt-2 text-3xl font-bold">{Math.min(100,Object.keys(answers).length*3)}점</p><p className="mt-1 text-xs opacity-70">응답한 {Object.keys(answers).length}문항을 채점했어요.</p></div>}<button onClick={()=>setGraded(true)} disabled={!Object.keys(answers).length} className="mt-5 h-12 w-full bg-ink font-bold text-white disabled:cursor-not-allowed disabled:opacity-30 dark:bg-white dark:text-black">채점하기</button></aside></div></main>
}

function SettingsPage({ selections, setSelections, dark, setDark }: { selections: Record<string,string|string[]>; setSelections: Dispatch<SetStateAction<Record<string,string|string[]>>>; dark:boolean; setDark:(v:boolean)=>void }) {
  return <main className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6"><h1 className="mb-3 text-3xl font-bold">설정</h1><p className="mb-10 text-sm text-neutral-500">자주 풀 과목을 토글하면 홈 바로가기에 표시됩니다.</p><section className="border-t border-line dark:border-neutral-800"><div className="border-b border-line py-6 dark:border-neutral-800"><h2 className="mb-4 font-bold">바로가기</h2><div className="space-y-6">{Object.entries(subjects).map(([main, subs]) => { const value = selections[main] ?? ''; const values = Array.isArray(value) ? value : (value ? [value] : []); const isMulti = multiAreas.has(main); return <div key={main}><div className="mb-2 flex items-center gap-2"><p className="text-sm font-semibold">{main}</p>{isMulti && <span className="text-xs text-neutral-400">복수 선택 가능</span>}</div><div className="flex flex-wrap gap-2">{subs.length === 0 ? <button onClick={()=>setSelections({...selections,[main]:values.length ? '' : main})} className={cn('border px-3 py-2 text-xs transition', values.length ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black' : 'border-line dark:border-neutral-700')}>{main}</button> : subs.map(s=><button key={s} onClick={()=>setSelections(prev=>{const current=prev[main] ?? ''; const currentValues=Array.isArray(current)?current:(current?[current]:[]); const next=isMulti?(currentValues.includes(s)?currentValues.filter(v=>v!==s):[...currentValues,s]):(currentValues.includes(s)?'':s); return {...prev,[main]:next}})} className={cn('border px-3 py-2 text-xs transition', values.includes(s) ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-black' : 'border-line dark:border-neutral-700')}>{s}</button>)}</div></div>})}</div></div><div className="flex items-center justify-between border-b border-line py-5 dark:border-neutral-800"><div><b>다크 모드</b><p className="mt-1 text-sm text-neutral-500">어두운 환경에서 눈의 피로를 줄입니다.</p></div><button onClick={()=>setDark(!dark)} className={cn('relative h-7 w-12 rounded-full transition',dark?'bg-white':'bg-neutral-300')}><span className={cn('absolute top-1 size-5 rounded-full bg-neutral-900 transition',dark?'left-6':'left-1')}/></button></div><button className="flex w-full items-center gap-2 border-b border-line py-5 text-left text-red-600 dark:border-neutral-800"><LogOut size={17}/>로그아웃</button></section></main>
}
function BottomNav({ page, setPage }: { page:Page; setPage:(p:Page)=>void }) { return <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-3 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-neutral-800 dark:bg-neutral-950/95">{[{id:'home',label:'홈',Icon:Home},{id:'list',label:'기출',Icon:BookOpen},{id:'settings',label:'설정',Icon:Settings}].map(({id,label,Icon})=><button key={id} onClick={()=>setPage(id as Page)} className={cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px]',page===id?'font-bold':'text-neutral-500')}><Icon size={20}/>{label}</button>)}</nav> }

export default function App() {
  const [page,setPage]=useState<Page>('home'), [subject,setSubject]=useState('미적분'), [selected,setSelected]=useState<Exam>(exams[1]), [dark,setDark]=useState(false), [selections,setSelections]=useState<Record<string,string|string[]>>({'국어':'화법과 작문','수학':'미적분','영어':'영어','한국사':'한국사','사회탐구':[],'과학탐구':[],'직업탐구':'','제2외국어/한문':''})
  useEffect(()=>{document.documentElement.classList.toggle('dark',dark)},[dark])
  const go=(p:Page,e?:Exam)=>{if(e)setSelected(e);setPage(p);window.scrollTo({top:0,behavior:'smooth'})}
  const selectedSubjects = Object.values(selections).flatMap(v => Array.isArray(v) ? v : (v ? [v] : []))
  return <div className="min-h-screen bg-surface text-ink transition-colors dark:bg-neutral-950 dark:text-neutral-100"><Header page={page} setPage={setPage} subject={subject} setSubject={setSubject} dark={dark} setDark={setDark}/>{page==='home'&&<HomePage go={go} subject={subject} selectedSubjects={selectedSubjects}/>} {page==='list'&&<ListPage subject={subject} go={go}/>} {page==='exam'&&<ExamPage exam={selected} subject={subject} back={()=>go('list')}/>} {page==='settings'&&<SettingsPage selections={selections} setSelections={setSelections} dark={dark} setDark={setDark}/>}<BottomNav page={page} setPage={setPage}/></div>
}

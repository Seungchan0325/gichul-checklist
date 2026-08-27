# 기출 체크리스트 운영 가이드

## 로컬 실행

Docker Desktop에서 현재 WSL 배포판의 Integration을 활성화합니다.

```bash
npm install
npm run db:start
cp .env.example .env.local
```

`npm run db:start` 출력의 API URL과 anon key를 `.env.local`에 입력합니다.

다음 두 명령은 별도 터미널에서 계속 실행합니다.

```bash
npm run functions:serve
npm run dev
```

계정 삭제를 시험하려면 `functions:serve`가 반드시 실행 중이어야 합니다. 로컬 이메일 확인 링크는 `http://127.0.0.1:54324`의 Mailpit에서 확인합니다.

## 환경 변수와 인증

프런트엔드에는 공개 URL과 anon key만 설정합니다.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY`는 프런트엔드 환경 변수나 `.env.local`에 넣지 않습니다.

Google 로그인은 Supabase Auth에서 Google provider를 활성화하고 OAuth client ID와 secret을 설정합니다. Authentication URL Configuration의 Site URL과 Redirect URLs에는 로컬 주소와 실제 배포 주소를 등록합니다.

## 최초 관리자 등록

Supabase Dashboard의 SQL Editor에서 사용자 UUID를 확인하고 `admin_users`에 등록합니다.

```sql
select id, email from auth.users order by created_at;

insert into public.admin_users (user_id)
values ('관리자로 지정할 사용자 UUID');
```

관리자 권한 제거:

```sql
delete from public.admin_users
where user_id = '관리자 권한을 제거할 사용자 UUID';
```

등록 또는 제거 후 사용자가 앱을 새로고침하면 권한이 반영됩니다.

## 기출 관리

관리자 계정으로 로그인한 뒤 헤더의 `관리`를 엽니다.

1. `새 기출 과목 추가`에서 연도, 시행 월, 시험명과 과목 하나를 선택해 초안을 생성합니다. 같은 시행에 다른 과목을 추가할 때도 이 과정을 반복합니다.
2. 선택한 과목에 문제·해설 PDF를 업로드합니다.
3. 정답과 배점을 직접 입력하거나 CSV로 가져옵니다.
4. 해당 과목의 자료가 준비되면 `검증 후 게시`를 실행합니다. 다른 과목의 초안·게시 상태에는 영향을 주지 않습니다.

CSV 형식:

```csv
question_number,answer,points
1,3,2
2,5,2
```

게시 조건:

- 해당 과목에 문제 PDF와 해설 PDF가 모두 있어야 합니다.
- 해당 과목의 전체 문항 정답과 배점이 있어야 합니다.
- 객관식 답은 1–5, 수학 단답형은 1–3자리 숫자여야 합니다.
- 국어·수학·영어는 100점, 한국사·탐구·제2외국어/한문은 50점이어야 합니다.
- 국어·영어·한국사·탐구는 2·3점, 수학은 2·3·4점, 제2외국어/한문은 1·2점 배점만 사용할 수 있습니다.

PDF를 제거하면 해당 과목만 초안으로 전환됩니다. 과목을 제거하면 해당 과목에 연결된 사용자 답안·점수·타이머가 함께 삭제됩니다. 같은 시행의 다른 과목이 없을 때만 시행 정보도 함께 제거됩니다.

과목 영구 삭제는 과목명을 다시 입력해야 합니다. 삭제하면 해당 과목의 정답표, PDF와 모든 사용자의 관련 풀이 기록이 복구 불가능하게 제거됩니다. 관리자 작업은 `admin_audit_logs`에 기록됩니다.

## PDF 저장소 관리

PDF는 비공개 Supabase Storage 버킷 `exam-pdfs`에 저장됩니다. 버킷을 공개로 변경하지 않습니다.

```text
exams/{시험 ID}/subjects/{과목 ID}/question.pdf
exams/{시험 ID}/subjects/{과목 ID}/explanation.pdf
```

PDF만 업로드할 수 있으며 파일당 최대 크기는 50MB입니다. 일반 사용자는 게시된 시험 자료에 대해서만 10분 만료 서명 URL을 발급받습니다.

Storage 정리에 실패한 영구 삭제 작업은 `admin_audit_logs`의 `pdf_cleanup_failed` 기록을 확인하고 해당 경로의 파일을 Dashboard에서 제거합니다.

## 데이터베이스 유지보수

```bash
npm run db:reset   # 로컬 DB를 초기화하고 마이그레이션·시드를 다시 적용
npm run db:test    # RLS와 데이터 정책 테스트
npm run db:types   # 로컬 스키마에서 TypeScript 타입 재생성
npm test           # 애플리케이션 단위 테스트
npm run build      # 타입 검사와 프로덕션 빌드
```

`db:reset`은 로컬 사용자와 학습 기록을 모두 삭제하므로 필요한 데이터가 없는지 확인한 뒤 실행합니다. 원격 프로젝트에서는 `db:reset`을 사용하지 않습니다.

스키마 변경 시 새 마이그레이션을 추가하고 다음 순서로 검증합니다.

```bash
npm run db:reset
npm run db:test
npm run db:types
npm test
npm run build
```

## 배포

원격 Supabase 프로젝트를 연결한 뒤 DB 마이그레이션과 Edge Function을 배포합니다.

```bash
supabase db push
supabase secrets set ALLOWED_ORIGIN=https://YOUR_DOMAIN
npm run functions:deploy
```

프런트엔드 배포 환경에는 원격 프로젝트의 URL과 anon key를 설정하고 빌드합니다.

```bash
npm run build
```

### 개인 서버(Caddy) 배포

서버에 Caddy와 Node.js를 설치하고, 저장소를 내려받습니다. `deploy/production.env.example`을 서버의 안전한 위치에 복사해 실제 Supabase 공개 URL·anon key와 도메인을 입력합니다. 이 파일은 저장소에 커밋하지 않습니다.

```bash
npm ci
set -a; source /etc/gichul-checklist/production.env; set +a
npm run build
sudo install -d -m 755 /var/www/gichul-checklist
sudo rsync -a --delete dist/ /var/www/gichul-checklist/
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

`/etc/caddy/Caddyfile`을 읽는 서비스 환경에 `DOMAIN`과 `ACME_EMAIL`도 설정합니다. Caddy 서버가 80·443 포트를 외부에 제공해야 인증서가 자동 발급됩니다. 배포 전 `sudo caddy validate --config /etc/caddy/Caddyfile`로 설정을 검사합니다.

배포 후 확인 항목:

- 이메일 가입·확인·로그인과 Google 로그인이 동작하는지 확인합니다.
- 관리자 계정에만 `관리` 메뉴가 보이는지 확인합니다.
- 초안 시험이 일반 사용자에게 보이지 않는지 확인합니다.
- 게시된 시험의 PDF 열기, OMR 저장, 타이머 복원과 채점이 동작하는지 확인합니다.
- 계정 삭제 Edge Function이 배포되어 있는지 확인합니다.

## 문제 해결

- `Edge Function returned a non-2xx status code`: 로컬에서는 `npm run functions:serve`, 원격에서는 `npm run functions:deploy` 상태를 확인합니다.
- `docker could not be found`: Docker Desktop의 WSL Integration을 활성화하고 새 WSL 터미널을 엽니다.
- 함수가 401을 반환: 로그아웃 후 다시 로그인해 세션을 갱신합니다.
- 관리자 메뉴가 보이지 않음: 현재 사용자의 UUID가 `admin_users`에 있는지 확인하고 앱을 새로고침합니다.
- PDF 업로드가 거부됨: 관리자 권한, 파일 MIME 타입, 50MB 제한과 `exam-pdfs` 버킷 정책을 확인합니다.

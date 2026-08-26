# 기출 체크리스트

모의고사와 수능 기출 풀이 상태, 점수, OMR 답안을 관리하는 반응형 웹 앱입니다.

## 실행

```bash
npm install
npm run db:start
cp .env.example .env.local
npm run dev
```

`db:start` 출력의 anon key를 `.env.local`에 입력하세요. 이메일 확인 링크는 로컬 Mailpit에서 확인할 수 있습니다. Google 로그인은 `supabase/config.toml`의 provider를 활성화하고 로컬 환경 변수에 OAuth client id/secret을 설정해야 합니다.

## 데이터베이스와 검증

```bash
npm run db:reset   # 마이그레이션과 개발용 시드 재적용
npm run db:test    # 사용자 소유 데이터 RLS 검증
npm run db:types   # 로컬 스키마에서 TypeScript 타입 생성
npm test
npm run build
```

시드의 시험과 정답은 UI 검증용으로 생성된 예시이며 공식 기출 데이터가 아닙니다.

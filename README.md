# 정총무 CRM v3.0 — 배포 가이드

## 아키텍처

```
nippert-oss.github.io/crm/     ← GitHub Pages (정적 SPA)
        │
        ├── Firebase Auth (Google 로그인)
        ├── Firestore (리드 데이터 실시간 동기화)
        ├── FCM (앱 푸시 알림)
        └── Google Sheets API (데이터 내보내기)
```

---

## Step 1. Firebase 콘솔 설정 (my-awesome-370e5)

### 1-1. 인증 설정
- Firebase Console → Authentication → Sign-in providers
- **Google** 활성화
- 승인된 도메인에 `nippert-oss.github.io` 추가

### 1-2. Firestore 설정
- Firestore Database → 규칙 탭
- `firestore.rules` 내용 붙여넣기 후 게시

### 1-3. FCM (Cloud Messaging) 설정
- Project Settings → Cloud Messaging 탭
- **Web Push certificates** → "Generate key pair" 클릭
- 생성된 **VAPID key** 복사 (나중에 앱 설정에 입력)

### 1-4. Firebase 앱 config 복사
- Project Settings → General → Your apps
- Web 앱 추가 (이미 있으면 Config 복사)
- `apiKey`, `appId`, `messagingSenderId` 메모

---

## Step 2. GitHub Pages 배포

```bash
# 1. nippert-oss GitHub에서 새 repo 생성: "crm" (또는 기존 repo 사용)

# 2. 파일 업로드 (이 폴더 전체)
git clone https://github.com/nippert-oss/crm.git
cp -r ./crm/* ./crm-repo/
cd crm-repo
git add .
git commit -m "CRM v3.0 initial deploy"
git push origin main

# 3. GitHub Settings → Pages
# Source: Deploy from branch
# Branch: main / (root)
# ✓ 저장 후 https://nippert-oss.github.io/crm/ 접속 확인
```

### firebase-messaging-sw.js 위치
FCM 푸시를 위해 서비스 워커는 **도메인 루트**에 있어야 합니다.

옵션 A — nippert-oss.github.io 루트 repo (username.github.io)에 sw 파일 배치:
```
nippert-oss.github.io/   ← 루트 repo (nippert-oss.github.io)
  firebase-messaging-sw.js   ← 여기에 배치
  crm/
    index.html
```

옵션 B — sw를 /crm/ 경로에 등록하도록 scope 설정 (코드에서 처리됨)

---

## Step 3. 앱 내 설정

배포된 앱 접속 후 **⚙ 설정** 메뉴에서 입력:

| 항목 | 설명 |
|------|------|
| Firebase API Key | Firebase Console에서 복사 |
| App ID | Firebase Console에서 복사 |
| Messaging Sender ID | Firebase Console에서 복사 |
| VAPID Key | FCM Web Push certificates에서 복사 |
| Spreadsheet ID | Google Sheets URL에서 추출 |
| Google Sheets API Key | Google Cloud Console에서 발급 |
| Anthropic API Key | console.anthropic.com에서 발급 |

---

## Step 4. Google Sheets API 설정

1. Google Cloud Console → APIs → Google Sheets API 활성화
2. Credentials → Create credentials → API Key
3. API Key 제한: Sheets API만, HTTP referrer `nippert-oss.github.io/*`
4. Google Sheets에서 새 스프레드시트 생성
5. 공유 설정: "링크가 있는 모든 사용자" 편집자로 설정 (API 쓰기 허용)
6. URL에서 Spreadsheet ID 복사: `docs.google.com/spreadsheets/d/[ID]/edit`

---

## Step 5. FCM 푸시 알림 — Cloud Functions (선택)

지연 리드 자동 알림을 위한 Firebase Cloud Function:

```javascript
// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// 매일 오전 9시 실행
exports.dailyFollowUpReminder = functions.pubsub
  .schedule("0 9 * * *")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    const db = admin.firestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 오늘 또는 이전 next action이 있는 활성 리드 조회
    const leads = await db.collection("leads")
      .where("nextAction", "<=", today.toISOString().split("T")[0])
      .get();

    if (leads.empty) return;

    // 모든 FCM 토큰 가져오기
    const tokens = await db.collection("fcm_tokens").get();
    const tokenList = tokens.docs.map(d => d.data().token).filter(Boolean);

    if (tokenList.length === 0) return;

    const overdueCount = leads.size;
    const message = {
      notification: {
        title: `📋 후속 조치 필요 ${overdueCount}건`,
        body: `오늘 연락해야 할 리드가 ${overdueCount}건 있습니다`
      },
      tokens: tokenList
    };

    await admin.messaging().sendEachForMulticast(message);
  });
```

---

## 기능 요약

| 기능 | 상태 |
|------|------|
| Google 로그인 | ✅ Firebase Auth |
| 리드 CRUD | ✅ Firestore 실시간 |
| 칸반 파이프라인 | ✅ 7단계 |
| 소스별 필터 | ✅ 7개 소스 |
| 단계별 전환율 | ✅ KPI 페이지 |
| 소스별 승률 | ✅ KPI 페이지 |
| 월별 트렌드 | ✅ 6개월 차트 |
| 월 목표 설정 | ✅ 달성률 표시 |
| AI 상담 도우미 | ✅ Claude API |
| 활동 히스토리 | ✅ 리드별 기록 |
| Google Sheets | ✅ PUT API |
| FCM 푸시 알림 | ✅ 포그라운드 + 백그라운드 SW |
| PWA 설치 | ✅ manifest.json |
| 지연 리드 알림 | ✅ 대시보드 배너 |
| 반응형 모바일 | ✅ |

---

## 문제 해결

**Auth 에러 (auth/unauthorized-domain)**
→ Firebase Console → Authentication → Authorized domains에 `nippert-oss.github.io` 추가

**Firestore 읽기 실패**
→ firestore.rules를 콘솔에서 게시했는지 확인

**FCM 토큰 오류**
→ VAPID key가 올바른지, firebase-messaging-sw.js가 루트에 있는지 확인

**Sheets 쓰기 403**
→ 스프레드시트 공유 설정 확인 (편집자 권한), API Key HTTP 제한 확인

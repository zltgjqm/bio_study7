# Biology Second Brain

API 없이 동작하는 정적 HTML/CSS/JavaScript 개인 Biology Wiki입니다.

## 핵심 기능

- `Disease → Gene → Cell Type → Tissue → Paper` 자동 연결
- 홈페이지 검색
- Paper / Knowledge 직접 입력
- ChatGPT가 만든 JSON 붙여넣기
- 여러 Disease가 있는 Paper에서 Disease-specific note 저장
- 한 논문 안의 claim/지식 덩어리를 `knowledgeUnits`로 분리 저장
- API 없이 alias/canonical dictionary로 용어 표준화
- 중복 Paper 후보 경고
- `My Library`에서 저장한 Paper/Knowledge 검색, 수정, 삭제
- localStorage 기반 저장
- Backup export/import

## 파일 구조

```text
biology-second-brain/
├── index.html
├── pages/
│   ├── add.html          # Paper / Knowledge 추가, GPT JSON 붙여넣기, Backup
│   ├── library.html      # My Library: Edit / Delete / 관리
│   └── entity.html       # 검색 결과 및 자동 연결 상세 페이지
├── assets/
│   ├── data.js           # 기본 샘플 데이터
│   ├── search.js         # 검색, localStorage, 표준화, 연결 그래프
│   └── style.css
└── README.md
```

## 이번 버전에서 추가된 것

### 1. 용어 표준화

`assets/search.js`의 `CANONICAL_ALIASES`에 alias를 추가하면 입력값이 자동으로 표준명으로 바뀝니다.

예:

```text
Pancreatic ductal adenocarcinoma → PDAC
pancreatic cancer → PDAC
lung tissue → Lung
폐조직 → Lung
Treg → Regulatory T cell
```

### 2. Knowledge Units

논문 하나 안에 독립된 지식/claim이 여러 개 있으면 아래처럼 분리합니다.

```json
"knowledgeUnits": [
  {
    "claim": "KRAS activation increases inflammatory signaling",
    "disease": ["PDAC"],
    "genes": ["KRAS", "IL1B"],
    "cellTypes": ["CAF"],
    "tissues": ["Pancreas"],
    "evidence": "Figure 2",
    "note": "논문 안에서 독립적으로 기억할 claim"
  }
]
```

Entity 페이지에서는 관련된 Knowledge Units가 별도 카드로 모입니다.

### 3. 중복 Paper 경고

Paper 저장 시 DOI/URL 또는 title이 같은 항목이 있으면 경고가 뜹니다.

## 사용 방법

1. GitHub Pages에 그대로 올립니다.
2. 홈페이지에서 `+ Add`를 누릅니다.
3. Paper 또는 Knowledge를 입력하거나 GPT JSON을 붙여넣습니다.
4. `Save to Browser`를 누르면 현재 브라우저 localStorage에 저장됩니다.
5. 홈 검색과 연결 페이지에 바로 반영됩니다.
6. 저장한 항목은 `My Library`에서 수정하거나 삭제할 수 있습니다.

## 백업

localStorage는 현재 브라우저에만 저장됩니다.
브라우저 데이터를 지우거나 다른 컴퓨터를 쓰면 사라질 수 있으므로 `+ Add → Backup`에서 주기적으로 export 하세요.

## 배포

GitHub 저장소에 전체 파일을 업로드한 뒤:

- Settings → Pages
- Source: Deploy from a branch
- Branch: main
- Folder: /(root)

으로 설정하면 됩니다.

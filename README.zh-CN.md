# jobseek-skills v2

版本：2.0.2 — 詳見 `VERSION` 與 `CHANGELOG.md`。

## 這是什麼

一套可攜、由總帳（ledger）驅動的求職工作流程，專為正在尋求博士後之外
發展的科學家設計，並附上一份可實際建置的「求職儀表板」（Job Search
Dashboard）規格，儀表板就建構在這套工作流程之上。

整套工作流程是一條管線，順序如下：

**總帳 → 搜尋 → 評分 → 量身打造 → 精確核准 → 投遞 → 追蹤 + 儀表板**

1. **總帳（Ledger）** — 申請人經證實事實的唯一主記錄：學歷、STAR 格式
   的經歷、量化成果、發表、獎項、技能與限制條件。任何草稿都只能出自
   總帳裡有的內容。
2. **搜尋（Search）** — 跨一般求職平台、雇主官網、政府入口、大學、
   研究機構、醫院、非營利組織與專科學會平台，批次搜尋職缺，去重、
   查核來源，並記錄遺漏。
3. **評分（Score）** — 每個職缺依總帳進行「證據涵蓋率」評分
   （見 `templates/FIT-SCORECARD.md`）。資格、地點、到職日與截止日
   是分數旁邊的旗標，永遠不混入分數本身。
4. **量身打造（Tailor）** — 針對選定的職缺，僅以查核過的官方職缺
   公告與總帳建立申請包：適配評分卡、雇主背景（附來源與日期）、
   雇主評價、量身打造的 CV/履歷與求職信，全部使用
   `templates/FORMAT-STANDARD.md` 的單一格式。
5. **精確核准（Exact approval）** — 核准綁定確切的職缺版本、文件
   版本、佐證事實修訂與答案集，並記錄在申請包中。沉默不等於核准。
   一個職缺的核准永遠不移轉到另一個職缺。任何變更都使申請包回到
   待審狀態。
6. **投遞（Apply）** — 投遞協助採逐頁進行、由申請人主導：每一個
   Next / Continue / Proceed / Submit 都由申請人親自點擊，登入、
   簽名、聲明與同意也由申請人處理。只有在觀察到確認畫面或申請人
   明確回報時才記錄為已投遞 — 填好的表單不等於已投遞。
7. **追蹤 + 儀表板（Track + dashboard）** — 每個職缺、申請包、核准
   與結果都被追蹤（見 `templates/TRACKER.template.md`），並呈現在
   `dashboard/` 所規格化的求職儀表板中。

雇主與職位的背景、以及雇主評價，會在每個職位被搜尋或發現時就
填好，而不是等到建立申請包時才補。學術／實驗室類型的職位，背景
還涵蓋實驗室本身：其過去五年的發表與重要會議摘要、實驗室網站，
彙整為研究目標與潛在方向，並將「明述的目標」與「推論的方向」
明確區分。

## 快速開始

你只需要一條指令。把你平台的那一段原文貼上，然後照著步驟做：
把你的 CV 給 agent，並回答它的總帳問題。

### Muse

```text
Clone https://github.com/shanetsao/jobseek-skills (v2). Read README.md, dashboard/SPEC.md, and adapters/muse/BUILD-PROMPT.md. Build me the Job Search Dashboard exactly to spec, using only my data: I will give you my CV and answer your ledger questions. First load the sample dataset in examples/sample-applicant/ and pass every item in dashboard/ACCEPTANCE.md, show me the results, then wipe the sample and build my ledger from my CV. Never invent a fact, a score, or a background. Do not submit any application.
```

### ChatGPT（Sites）

```text
Use @Sites to build this. Clone https://github.com/shanetsao/jobseek-skills (v2). Read README.md, dashboard/SPEC.md, and adapters/chatgpt-sites/BUILD-PROMPT.md. Build me the Job Search Dashboard exactly to spec, using only my data: I will give you my CV and answer your ledger questions. First load the sample dataset in examples/sample-applicant/ and pass every item in dashboard/ACCEPTANCE.md, show me the results, then wipe the sample and build my ledger from my CV. Never invent a fact, a score, or a background. Do not submit any application. Do not publish the Site.
```

## 倉庫結構圖

```text
README.md                     本檔案：總覽與快速開始
README.zh-CN.md               本檔案的中文版
CHANGELOG.md                  v1 → v2 變更
VERSION                       目前版本（2.0.2）
.gitignore                    防止真實申請人資料與建置產物進入倉庫

skills/                       工作流程技能（ledger、search、score、
                              tailor、apply、track、dashboard）
  jobseek/                    協調技能，加上共用檔案
    references/               records、onboarding、search、tailoring、
                              application、state-commands、matching、
                              document-commands（見其 SKILL.md）
    scripts/                  jobseek_state.py、jobseek_match.py、
                              jobseek_documents.py（標準函式庫 Python）
    agents/openai.yaml        Codex/ChatGPT 介面定義（Muse 忽略）
templates/                    可重用的空白範本
  LEDGER.template.md          主總帳結構
  TRACKER.template.md         職缺追蹤結構
  PACKAGE.template.md         精確申請包記錄結構
  FIT-SCORECARD.md            證據涵蓋率評分方法
  FORMAT-STANDARD.md          唯一的 CV/履歷格式
  applicant-profile.template.yaml   申請人檔案架構
applicant-data/               資料交換套件（見其 README.md）
  README.md                   套件規格 — 套件本身不在這裡
dashboard/                    儀表板規格與參考建置
  SPEC.md                     儀表板必須做到的事
  DATA-MODEL.md               資料表與欄位
  UI-SPEC.md                  分頁、動作與行為
  ACCEPTANCE.md               逐項驗收清單
  reference/                  作為起點的參考實作
examples/
  sample-applicant/           虛構範例資料集（Dr. Sam Lee）
adapters/
  muse/BUILD-PROMPT.md        Muse 的建置提示與步驟
  chatgpt-sites/BUILD-PROMPT.md     ChatGPT Sites 的建置提示與對應
```

## 隱私警告

**真實申請人資料永遠不提交到這個倉庫。**

這個倉庫只包含工作流程、範本、儀表板規格與一份虛構範例資料集。
真實的申請人資料套件 — 檔案、總帳、職缺、申請包、文件、答案 —
存放在這個公開倉庫**之外**，或另一個私人倉庫。本倉庫的 `.gitignore`
用來阻擋常見的誤入路徑（真實的 `LEDGER.md`、`TRACKER.md`、
`dossier.md`、`state.json`、資料庫、`applications/`、DOCX/PDF 產物，
以及 `applicant-data/` 底下除 README 以外的一切），但忽略規則只是
最後防線，不是保證：每次提交前都要檢查 `git status`。

## 平台對等說明

工作流程、資料模型、儀表板行為與驗收測試在 Muse 與 ChatGPT Sites
上相同。**只有一個差異：agent 請求的執行方式**。

- 在 Muse 上，儀表板的 agent 請求（例如「建立量身打造申請包」或
  「重新整理搜尋」）可由背景 agent 任務執行。
- 在 ChatGPT Sites 上，Site 無法在背景執行 agent。Agent 請求會存入
  待處理請求佇列，由 ChatGPT 在對話中執行，結果透過相同的儲存
  動作寫回。

其餘一切 — 資料表、動作及其語意、分頁、主題、行為、作為唯一真相
來源的申請人資料套件 — 完全相同。完整對應見
`adapters/chatgpt-sites/BUILD-PROMPT.md`。

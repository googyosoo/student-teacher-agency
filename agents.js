/* ============================================================
   교사 성찰 스튜디오 — 성찰일지 + 에이전트
   1) 성찰일지: localStorage 저장 · 목록 · 삭제 · 내보내기
   2) 성찰 코치 에이전트:
      - LLM 모드 (OpenAI 호환 API · 브라우저 설정 · 스트리밍 대화)
      - 규칙 모드 (키 미입력 시 자동 폴백)
   3) 수업 설계 어시스턴트: 질문 → 학생주도성 설계안 생성
   ============================================================ */

/* ---------- 유틸 ---------- */
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ============================================================
   1) 성찰일지
   ============================================================ */
const JOURNAL_KEY = "agency-teacher-journal";

function loadJournal() {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveJournal(list) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(list));
}

const jForm = document.getElementById("journalForm");
const jDate = document.getElementById("jDate");
const jTitle = document.getElementById("jTitle");
const jSituation = document.getElementById("jSituation");
const jGood = document.getElementById("jGood");
const jHard = document.getElementById("jHard");
const jNext = document.getElementById("jNext");
const jEntriesEl = document.getElementById("journalEntries");
const jStatsEl = document.getElementById("journalStats");
const jEmptyEl = document.getElementById("journalEmpty");

jDate.value = todayStr();

function renderStats() {
  const list = loadJournal();
  const now = Date.now();
  const week = list.filter((e) => now - new Date(e.date + "T00:00:00").getTime() < 7 * 86400000).length;
  jStatsEl.innerHTML =
    `<span class="stat-pill">📓 총 ${list.length}개의 기록</span>` +
    `<span class="stat-pill">📅 최근 7일 ${week}개</span>`;
}

function renderJournalList() {
  const list = loadJournal();
  jEmptyEl.hidden = list.length > 0;
  jEntriesEl.innerHTML = "";

  const sorted = [...list].sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt - a.createdAt
  );

  sorted.forEach((entry) => {
    const el = document.createElement("article");
    el.className = "journal-entry";
    el.dataset.id = entry.id;

    el.innerHTML = `
      <div class="journal-entry-head">
        <div>
          <strong>${esc(entry.title || "제목 없는 성찰")}</strong>
          <span class="journal-date">${esc(entry.date)}</span>
        </div>
        <div class="journal-entry-actions">
          <button type="button" class="mini-btn coach">🤖 분석</button>
          <button type="button" class="mini-btn toggle">펼치기</button>
          <button type="button" class="mini-btn danger">삭제</button>
        </div>
      </div>
      <div class="journal-entry-body" hidden>
        <p><strong>수업 상황</strong><br />${esc(entry.situation || "—")}</p>
        <p><strong>잘된 점</strong><br />${esc(entry.good || "—")}</p>
        <p><strong>어려웠던 점 · 고민</strong><br />${esc(entry.hard || "—")}</p>
        <p><strong>다음에 시도할 것</strong><br />${esc(entry.next || "—")}</p>
      </div>`;

    const body = el.querySelector(".journal-entry-body");
    const toggleBtn = el.querySelector(".toggle");
    toggleBtn.addEventListener("click", () => {
      const open = body.hidden;
      body.hidden = !open;
      toggleBtn.textContent = open ? "접기" : "펼치기";
    });

    el.querySelector(".danger").addEventListener("click", () => {
      if (!confirm("이 성찰 기록을 삭제할까요?")) return;
      saveJournal(loadJournal().filter((e) => e.id !== entry.id));
      renderJournalList();
      renderStats();
      populateCoachSelect();
    });

    el.querySelector(".coach").addEventListener("click", () => {
      switchSubTab("coach");
      document.getElementById("coachText").value =
        `[수업 상황] ${entry.situation}\n[잘된 점] ${entry.good}\n[어려움] ${entry.hard}\n[다음 계획] ${entry.next}`;
      runCoachAnalysis();
    });

    jEntriesEl.appendChild(el);
  });
}

function populateCoachSelect() {
  const sel = document.getElementById("coachEntrySelect");
  const current = sel.value;
  const list = [...loadJournal()].sort((a, b) =>
    b.date.localeCompare(a.date) || b.createdAt - a.createdAt
  );
  sel.innerHTML =
    `<option value="">— 일지를 선택하세요 —</option>` +
    list
      .map((e) => `<option value="${e.id}">${esc(e.date)} · ${esc(e.title || "제목 없는 성찰")}</option>`)
      .join("");
  sel.value = current;
}

jForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const situation = jSituation.value.trim();
  if (!situation) {
    jSituation.focus();
    return;
  }
  const list = loadJournal();
  list.push({
    id: "j" + Date.now(),
    date: jDate.value || todayStr(),
    title: jTitle.value.trim(),
    situation,
    good: jGood.value.trim(),
    hard: jHard.value.trim(),
    next: jNext.value.trim(),
    createdAt: Date.now(),
  });
  saveJournal(list);
  jForm.reset();
  jDate.value = todayStr();
  renderJournalList();
  renderStats();
  populateCoachSelect();
});

document.getElementById("journalExport").addEventListener("click", () => {
  const list = loadJournal();
  if (!list.length) {
    alert("내보낼 기록이 아직 없습니다.");
    return;
  }
  const text =
    "주도성의 조화 — 교사 성찰일지\n" +
    "=".repeat(46) + "\n\n" +
    [...list]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) =>
        `[${e.date}] ${e.title || "제목 없는 성찰"}\n` +
        `· 수업 상황: ${e.situation}\n` +
        `· 잘된 점: ${e.good || "—"}\n` +
        `· 어려웠던 점: ${e.hard || "—"}\n` +
        `· 다음 계획: ${e.next || "—"}`
      )
      .join("\n\n" + "-".repeat(46) + "\n\n");

  const blob = new Blob(["\ufeff" + text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "교사_성찰일지.txt";
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ============================================================
   2) LLM 연동 인프라 (OpenAI 호환)
   ============================================================ */
const LLM_KEY = "agency-llm-config";
const LLM_DEFAULTS = {
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  apiKey: "",
};

const PROVIDER_DEFAULTS = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash" },
};

const PROVIDER_LABELS = { openai: "OpenAI 호환", gemini: "Google Gemini" };

function loadLLMConfig() {
  try {
    const raw = localStorage.getItem(LLM_KEY);
    const cfg = { ...LLM_DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
    // 이전 저장본(provider 없음)은 openai로 간주
    if (!cfg.provider) cfg.provider = "openai";
    return cfg;
  } catch {
    return { ...LLM_DEFAULTS };
  }
}

function saveLLMConfig(cfg) {
  localStorage.setItem(LLM_KEY, JSON.stringify(cfg));
}

function llmEnabled() {
  const c = loadLLMConfig();
  return Boolean(c.baseUrl && c.apiKey);
}

/* Gemini: OpenAI 메시지 배열을 Gemini contents로 변환 */
function messagesToGemini(messages) {
  const systemParts = [];
  const contents = [];
  messages.forEach((m) => {
    if (m.role === "system") {
      systemParts.push({ text: m.content });
    } else {
      contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] });
    }
  });
  return { systemInstruction: systemParts.length ? { parts: systemParts } : undefined, contents };
}

/* Gemini / OpenAI 응답에서 텍스트 추출 */
function llmText(data) {
  if (!data) return "";
  if (data.choices?.[0]?.message?.content != null) return data.choices[0].message.content;
  if (data.candidates?.[0]?.content?.parts) {
    return data.candidates[0].content.parts.map((p) => p.text || "").join("");
  }
  return "";
}

const COACH_SYSTEM_PROMPT = `너는 한국의 교육 전문가이자 '성찰 코치 에이전트'다. 교사의 수업 성찰일지를 읽고, 학생주도성(목소리, 선택권, 소유권·책임, 자기성찰, 안전한 실패, 비계·지원) 관점에서 깊이 있는 피드백을 준다.
반드시 아래 JSON 구조로만 답하고, JSON 외의 텍스트는 절대 출력하지 마라.
{
  "ack": "성찰 속에서 인정하고 격려할 빛나는 순간 (구체적으로, 한두 문장)",
  "sentiment": "positive 또는 negative 또는 mixed",
  "themes": ["성찰에서 드러난 주요 맥락 2~3개"],
  "agencyGaps": ["가장 부족하거나 발전 가능한 주도성 요소 2~3개 (목소리/선택권/소유권/자기성찰/안전한 실패/비계 중에서)"],
  "questions": ["교사가 스스로 더 깊이 성찰하도록 돕는 질문 3개"],
  "suggestions": ["학생주도성 원리에 기반한 구체적 실천 제안 3~4개"],
  "focus": "다음 성찰에서 집중할 포커스 (한 문장)"
}`;

async function llmComplete(messages, { stream = false } = {}) {
  const cfg = loadLLMConfig();
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const isGemini = cfg.provider === "gemini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    let url, headers, body;
    if (isGemini) {
      const method = stream ? "streamGenerateContent?alt=sse" : "generateContent";
      url = `${base}/models/${encodeURIComponent(cfg.model)}:${method}`;
      headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": cfg.apiKey,
      };
      const g = messagesToGemini(messages);
      body = JSON.stringify({
        ...g,
        generationConfig: { temperature: 0.7 },
      });
    } else {
      url = `${base}/chat/completions`;
      headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${cfg.apiKey}`,
      };
      body = JSON.stringify({ model: cfg.model, messages, temperature: 0.7, stream });
    }
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${err ? " · " + err.slice(0, 200) : ""}`);
    }
    return stream ? res : res.json();
  } finally {
    clearTimeout(timer);
  }
}

function extractJSON(text) {
  const fence = String(text || "").match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  try {
    return JSON.parse(candidate);
  } catch { /* 다음 전략 시도 */ }
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch { /* 실패 */ }
  }
  return null;
}

function friendlyError(err) {
  const m = String((err && err.message) || err);
  if (/failed to fetch|networkerror|load failed|cors/i.test(m)) {
    return "브라우저에서 API에 접속할 수 없습니다. (CORS·네트워크 차단) OpenAI API는 브라우저 직접 호출을 막는 경우가 있어, OpenRouter(openrouter.ai) 또는 자신의 프록시를 사용하거나 규칙 모드로 실행해 주세요.";
  }
  if (/401|403|api key not valid|invalid key/i.test(m)) {
    return "인증 실패입니다. API 키를 확인해 주세요. (Gemini 키는 AIza... 형식이며, 올바른 프로젝트에 대해 생성되었는지 확인하세요)";
  }
  if (/404/.test(m)) return "요청한 엔드포인트나 모델을 찾을 수 없습니다(404). 제공자·모델명·API 주소를 확인해 주세요.";
  if (/429/.test(m)) return "요청 한도 초과(429)입니다. 잠시 후 다시 시도하거나 다른 모델을 사용해 보세요.";
  if (/abort/i.test(m)) return "요청 시간이 초과되었습니다. 다시 시도해 주세요.";
  return m;
}

async function analyzeWithLLM(text) {
  const cfg = loadLLMConfig();
  const t0 = performance.now();
  const data = await llmComplete([
    { role: "system", content: COACH_SYSTEM_PROMPT },
    { role: "user", content: `아래는 교사의 수업 성찰일지다. 분석해줘.\n\n${text}` },
  ]);
  const latency = Math.round(performance.now() - t0);
  const content = llmText(data);
  const parsed = extractJSON(content);
  if (!parsed) throw new Error("LLM 응답을 JSON으로 해석하지 못했습니다. (모델에 따라 JSON 출력을 지원하지 않을 수 있습니다)");
  return { parsed, latency, model: cfg.model, raw: content };
}

async function streamChat(messages, onDelta) {
  const res = await llmComplete(messages, { stream: true });
  if (!res.body) throw new Error("이 API는 스트리밍을 지원하지 않습니다.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload);
        // OpenAI: choices[0].delta.content (증분) / Gemini: candidates[0].content.parts[0].text (누적)
        let delta = chunk.choices?.[0]?.delta?.content ?? "";
        if (!delta && chunk.candidates?.[0]?.content?.parts) {
          delta = chunk.candidates[0].content.parts.map((p) => p.text || "").join("");
        }
        if (delta) {
          if (delta.startsWith(full)) full = delta; // 누적형(Gemini)
          else full += delta; // 증분형(OpenAI)
          onDelta(full);
        }
      } catch { /* 분할된 청크 무시 */ }
    }
  }
  return full;
}

/* ============================================================
   3) 규칙 기반 분석 도구 (LLM 미설정 시 폴백)
   ============================================================ */
const POS_WORDS = ["좋았", "성공", "잘됐", "흥미", "적극", "참여", "재미", "칭찬", "향상", "기쁘", "감동", "잘했", "성장", "열정", "활발", "집중"];
const NEG_WORDS = ["어렵", "힘들", "실패", "문제", "부족", "아쉽", "고민", "걱정", "못했", "혼란", "지루", "소극", "무기력", "당황", "실수", "충돌", "지적", "야단"];

const AGENCY_KEYWORDS = {
  voice: ["목소리", "의견", "질문", "토론", "발표", "발문", "되묻", "의견을 묻", "말하게"],
  choice: ["선택", "고르", "옵션", "주도권", "결정", "정하게"],
  ownership: ["주인의식", "책임", "주도", "스스로", "자기주도", "소유"],
  reflection: ["성찰", "돌아보", "반성", "일지", "정리", "느낌", "배움 일지"],
  safety: ["실패", "틀려도", "안전", "시도", "모험", "괜찮"],
  scaffolding: ["비계", "지원", "도움", "안내", "보조", "발판", "피드백", "단계"],
};

const AGENCY_LABELS = {
  voice: "학생 목소리 · 질문",
  choice: "학생 선택권",
  ownership: "소유권 · 책임",
  reflection: "자기성찰",
  safety: "안전한 실패",
  scaffolding: "비계 · 지원",
};

function countKeywords(text, words) {
  return words.filter((w) => text.includes(w)).length;
}

function analyzeText(text) {
  const pos = countKeywords(text, POS_WORDS);
  const neg = countKeywords(text, NEG_WORDS);
  return { positive: pos, negative: neg, dominant: pos > neg ? "positive" : neg > pos ? "negative" : "mixed" };
}

function detectAgency(text) {
  return Object.fromEntries(
    Object.entries(AGENCY_KEYWORDS).map(([k, ws]) => [k, countKeywords(text, ws)])
  );
}

function pickGaps(analysis, n) {
  return Object.entries(analysis.agency)
    .sort((a, b) => a[1] - b[1])
    .slice(0, n)
    .map(([k]) => k);
}

const QUESTION_POOL = {
  voice: "이 수업에서 학생들은 질문하거나 의견을 말할 자유가 있었나요? 어떤 순간에 학생의 목소리가 가장 크게 들렸나요?",
  choice: "학생들이 스스로 고를 수 있었던 것은 무엇인가요? 선택권을 하나 더 준다면 어떤 선택을 주고 싶나요?",
  ownership: "학생들이 ‘나의 배움’이라고 느꼈을 순간이 있었나요? 무엇이 그 느낌을 만들었을까요?",
  reflection: "수업이 끝난 뒤 학생들은 자신의 배움을 돌아볼 시간을 가졌나요? 그 시간은 충분했나요?",
  safety: "학생들이 실수해도 괜찮다는 안전감을 느꼈을까요? 실패를 이야기할 수 있는 분위기였나요?",
  scaffolding: "어려움을 겪는 학생에게 어떤 비계(발판)를 놓아주었나요? 더 도움이 되려면 무엇이 필요했을까요?",
};

const GENERIC_QUESTIONS = [
  "이 수업에서 가장 기억에 남는 장면은 무엇인가요?",
  "학생 한 명을 떠올린다면, 그 학생은 오늘 무엇을 느꼈을까요?",
  "한 가지를 바꿀 수 있다면 무엇을 바꾸고 싶나요?",
];

const SUGGESTION_POOL = {
  voice: "다음 수업에서는 학생들의 질문을 먼저 받아 칠판에 모으고, 그중 하나를 수업의 탐구 문제로 삼아보세요.",
  choice: "주제·방법·발표 형식 중 하나는 학생이 고르게 해보세요. 작은 선택이 주인의식을 키웁니다.",
  ownership: "수업 마무리에 “오늘 내가 배운 것을 한 문장으로”라고 물어보세요. 스스로 정리하는 힘이 자랍니다.",
  reflection: "수업의 마지막 3분을 ‘배움 일지’ 시간으로 남겨보세요. 기록은 성찰의 가장 쉬운 문입니다.",
  safety: "“틀려도 괜찮아”를 말로만 하지 말고, 실수 사례를 함께 보며 배우는 시간을 가져보세요.",
  scaffolding: "어려운 과제는 작은 단계로 쪼개고, 각 단계마다 확인 질문을 넣어보세요. 비계는 서서히 거둬가는 것이 핵심입니다.",
};

const GENERIC_SUGGESTION = "수업 후 3분, 이 성찰일지를 쓰는 순간 자체가 다음 수업을 설계하는 힘입니다.";

function generateQuestions(analysis) {
  const questions = [];
  for (const k of pickGaps(analysis, 6)) {
    if (questions.length >= 3) break;
    if (QUESTION_POOL[k]) questions.push(QUESTION_POOL[k]);
  }
  for (const g of GENERIC_QUESTIONS) {
    if (questions.length >= 3) break;
    if (!questions.includes(g)) questions.push(g);
  }
  return questions.slice(0, 3);
}

function generateSuggestions(analysis) {
  const suggestions = [];
  for (const k of pickGaps(analysis, 6)) {
    if (suggestions.length >= 3) break;
    if (SUGGESTION_POOL[k]) suggestions.push(SUGGESTION_POOL[k]);
  }
  suggestions.push(GENERIC_SUGGESTION);
  return suggestions.slice(0, 4);
}

function findPositiveSentence(text) {
  const sentences = text.split(/[.!?。\n]+/).map((s) => s.trim()).filter(Boolean);
  const hit = sentences.find((s) => POS_WORDS.some((w) => s.includes(w)));
  return hit
    ? `오늘의 성찰 속에 빛나는 순간이 보입니다. “${hit}”`
    : "오늘도 수업을 돌아보고 기록한 것 자체가 이미 주도적인 첫걸음입니다.";
}

function nextFocus(analysis) {
  const [k] = pickGaps(analysis, 1);
  return AGENCY_LABELS[k] || "학생의 배움 경험";
}

function ruleAnalysis(text) {
  const a0 = { sentiment: analyzeText(text), agency: detectAgency(text) };
  return {
    ack: findPositiveSentence(text),
    questions: generateQuestions(a0),
    suggestions: generateSuggestions(a0),
    focus: nextFocus(a0),
  };
}

/* ============================================================
   4) 에이전트 코어 (트레이스 로그)
   ============================================================ */
const agentLogEl = document.getElementById("agentLog");

function clearAgentLog(container) {
  const el = container || agentLogEl;
  el.hidden = false;
  el.querySelectorAll(".agent-step").forEach((s) => s.remove());
}

function logAgentStep(icon, label, detail, done, container) {
  const el = container || agentLogEl;
  const step = document.createElement("div");
  step.className = "agent-step" + (done ? " done" : "");
  step.innerHTML = `<span class="agent-step-icon">${icon}</span><span><span class="agent-step-label">${label}</span><br /><span class="agent-step-detail">${esc(detail)}</span></span>`;
  el.appendChild(step);
  return step;
}

async function runAgentPipeline(steps, container) {
  for (const s of steps) {
    const step = logAgentStep(s.icon, s.label, "실행 중…", false, container);
    await delay(280);
    step.classList.add("done");
    step.querySelector(".agent-step-detail").textContent = s.detail;
  }
}

/* ============================================================
   5) 성찰 코치 흐름 (LLM / 규칙 하이브리드)
   ============================================================ */
const coachTextEl = document.getElementById("coachText");
const coachResponseEl = document.getElementById("agentResponse");
const coachChatEl = document.getElementById("agentChat");
const chatMessagesEl = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");

let coachSession = null; // { text, analysis, history }

function collectCoachText() {
  const sel = document.getElementById("coachEntrySelect");
  const chosen = loadJournal().find((e) => e.id === sel.value);
  if (chosen) {
    return (
      `[수업 상황] ${chosen.situation}\n[잘된 점] ${chosen.good}\n[어려움] ${chosen.hard}\n[다음 계획] ${chosen.next}`
    ).trim();
  }
  return coachTextEl.value.trim();
}

function renderCoachAnswer(a, meta) {
  coachResponseEl.innerHTML = `
    <div class="coach-answer">
      <div class="coach-answer-head">
        <span style="font-size:26px;">🤖</span>
        <strong>성찰 코치의 분석</strong>
        <em>${esc(meta)}</em>
      </div>
      <p class="coach-ack">💛 ${esc(a.ack || "")}</p>
      <div class="coach-block">
        <h4>🔍 나를 깊게 하는 반성 질문</h4>
        <ul>${(a.questions || []).map((q) => `<li>${esc(q)}</li>`).join("")}</ul>
      </div>
      <div class="coach-block suggest">
        <h4>🌱 오늘부터 실천할 제안</h4>
        <ul>${(a.suggestions || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      </div>
      <div class="coach-focus">🎯 다음 성찰 포커스: ${esc(a.focus || "")}</div>
    </div>`;
  coachResponseEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderLLMError(err) {
  const msg = friendlyError(err);
  logAgentStep("⚠️", "오류 발생", msg, true);
  coachResponseEl.innerHTML = `
    <div class="agent-error">
      <strong>⚠️ LLM 호출에 실패했습니다.</strong>
      <p>${esc(msg)}</p>
      <p class="agent-error-hint">API 주소·키·모델을 확인하거나, 아래 버튼으로 규칙 기반 모드로 전환해 다시 실행해 보세요.</p>
      <button class="btn btn-ghost" type="button" id="fallbackRun">🧩 규칙 기반으로 다시 실행</button>
    </div>`;
  coachResponseEl.querySelector("#fallbackRun").addEventListener("click", () => {
    localStorage.removeItem(LLM_KEY);
    updateLLMUI();
    runCoachAnalysis();
  });
}

async function runCoachAnalysis() {
  const text = collectCoachText();
  if (!text) {
    alert("분석할 일지를 선택하거나 텍스트를 붙여넣어 주세요.");
    return;
  }

  clearAgentLog();
  coachResponseEl.innerHTML = "";
  coachChatEl.hidden = true;
  chatMessagesEl.innerHTML = "";
  coachSession = null;

  const enabled = llmEnabled();
  const cfg = loadLLMConfig();

  logAgentStep("🧠", "목표 설정", enabled ? "성찰일지 심층 분석 (LLM 엔진)" : "성찰일지 분석 및 성장 포인트 도출", true);
  logAgentStep("🗂️", "도구 선택", enabled ? `llmChatCompletion(${cfg.model}, json)` : "analyzeText · detectAgency · generateQuestions · generateSuggestions", true);
  await delay(200);

  let analysis;
  let meta;

  if (enabled) {
    try {
      const r = await analyzeWithLLM(text);
      analysis = {
        ack: r.parsed.ack || ruleAnalysis(text).ack,
        questions: Array.isArray(r.parsed.questions) && r.parsed.questions.length
          ? r.parsed.questions
          : ruleAnalysis(text).questions,
        suggestions: Array.isArray(r.parsed.suggestions) && r.parsed.suggestions.length
          ? r.parsed.suggestions
          : ruleAnalysis(text).suggestions,
        focus: r.parsed.focus || ruleAnalysis(text).focus,
      };
      meta = `LLM 분석 · ${r.model} · ${r.latency}ms`;
      logAgentStep("📡", "LLM 호출", `${r.model} · ${r.latency}ms · JSON 응답 파싱 완료`, true);
      logAgentStep("🧩", "응답 합성", "질문·제안·포커스 정리 완료", true);
    } catch (err) {
      renderLLMError(err);
      return;
    }
  } else {
    await runAgentPipeline([
      {
        icon: "📊",
        label: "analyzeText",
        detail: (() => {
          const a = analyzeText(text);
          return `정서: ${a.positive} 긍정 / ${a.negative} 부정`;
        })(),
      },
      {
        icon: "🔍",
        label: "detectAgency",
        detail: (() => {
          const a = detectAgency(text);
          const found = Object.entries(a).filter(([, c]) => c > 0).map(([k]) => AGENCY_LABELS[k]);
          return `발견된 주도성 요소: ${found.length ? found.join(", ") : "아직 기록에 없음"}`;
        })(),
      },
      { icon: "❓", label: "generateQuestions", detail: "반성 질문 3개 생성 완료" },
      { icon: "🌱", label: "generateSuggestions", detail: "실천 제안 생성 완료" },
    ]);
    analysis = ruleAnalysis(text);
    meta = "규칙 기반 분석 완료";
  }

  coachSession = {
    text,
    analysis,
    history: [
      { role: "system", content: COACH_SYSTEM_PROMPT },
      { role: "user", content: `아래는 교사의 수업 성찰일지다. 분석해줘.\n\n${text}` },
      { role: "assistant", content: `분석 완료. 핵심 포커스: ${analysis.focus}` },
    ],
  };

  renderCoachAnswer(analysis, meta);
  coachChatEl.hidden = false;
  appendChat(
    "coach",
    enabled
      ? "LLM 분석을 마쳤습니다. 궁금한 점을 자연어로 물어보세요. (예: “조용한 학생들의 참여를 높이려면?”)"
      : "분석을 마쳤습니다. 궁금한 점이 있으면 물어보세요. 예: “학생 선택권을 늘리는 방법은?”"
  );
}

document.getElementById("coachRun").addEventListener("click", runCoachAnalysis);

/* -------- 후속 대화 (멀티턴) -------- */

function appendChat(who, text) {
  const b = document.createElement("div");
  b.className = "chat-bubble " + who;
  b.textContent = text;
  chatMessagesEl.appendChild(b);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  return b;
}

/* 규칙 기반 답변 (LLM 미설정 시) */
function coachChatReply(userText) {
  if (!coachSession) {
    return "아직 분석된 내용이 없습니다. 먼저 [에이전트 실행]으로 성찰을 분석해 주세요.";
  }
  const a = coachSession.analysis;

  if (/질문/.test(userText)) {
    return "반성 질문을 조금 더 드릴게요. " + (a.questions || []).join(" / ");
  }
  if (/선택/.test(userText)) {
    return SUGGESTION_POOL.choice + " 선택권을 주면 학생들은 결과에 더 주인의식을 느낍니다.";
  }
  if (/동기/.test(userText)) {
    return "내재적 동기는 선택과 성취 경험에서 자랍니다. 작은 성공을 함께 축하하는 순간을 만들어 보세요. 지금 기록에서는 “" + a.focus + "” 맥락이 특히 눈에 띕니다.";
  }
  if (/부족|약점|개선|어렵/.test(userText)) {
    return "지금 기록에서 주목할 점은 “" + a.focus + "”입니다. 다음 수업에서 그 부분을 하나씩 시도해 보고, 결과를 성찰일지에 남겨 보세요.";
  }
  if (/비계|지원|도움|발문/.test(userText)) {
    return SUGGESTION_POOL.scaffolding + " 비계의 목표는 영원히 붙어 있는 것이 아니라, 학생이 설 수 있을 때 서서히 거두는 것입니다.";
  }
  if (/성찰|일지/.test(userText)) {
    return "성찰은 평가가 아니라 관찰입니다. 잘된 점과 어려움을 같은 무게로 적어보면, 몇 주 후 자신의 수업 패턴이 보이기 시작합니다.";
  }
  return "핵심은 “" + a.focus + "”를 키우는 일입니다. 더 구체적으로는 “학생 선택권을 늘리는 방법은?”, “비계를 세우는 방법은?”처럼 물어봐 주세요.";
}

/* LLM 답변 (스트리밍) */
async function llmChatReply(userText) {
  const history = coachSession.history;
  history.push({ role: "user", content: userText });
  const bubble = appendChat("coach", "✍️ 답변 작성 중…");
  try {
    const full = await streamChat(history, (partial) => {
      bubble.textContent = partial + "▍";
    });
    bubble.textContent = full;
    history.push({ role: "assistant", content: full });
    // 컨텍스트 관리: 시스템 프롬프트 + 최근 10개 메시지 유지
    const sys = history[0];
    coachSession.history = [sys, ...history.slice(1).slice(-10)];
  } catch (err) {
    bubble.textContent = "⚠️ " + friendlyError(err);
    history.pop();
  }
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  if (!coachSession) {
    appendChat("coach", "먼저 [에이전트 실행]으로 성찰을 분석해 주세요.");
    return;
  }
  appendChat("user", msg);
  chatInput.value = "";
  if (llmEnabled()) {
    llmChatReply(msg);
  } else {
    setTimeout(() => appendChat("coach", coachChatReply(msg)), 350);
  }
});

/* -------- LLM 설정 UI -------- */
const llmProviderEl = document.getElementById("llmProvider");
const llmBaseUrlEl = document.getElementById("llmBaseUrl");
const llmApiKeyEl = document.getElementById("llmApiKey");
const llmModelEl = document.getElementById("llmModel");
const llmModePill = document.getElementById("llmModePill");
const llmStatusEl = document.getElementById("llmStatus");
const designModePillEl = document.getElementById("designModePill");
const reportModePillEl = document.getElementById("reportModePill");

function updateLLMUI() {
  const cfg = loadLLMConfig();
  llmProviderEl.value = cfg.provider || "openai";
  llmBaseUrlEl.value = cfg.baseUrl;
  llmApiKeyEl.value = cfg.apiKey;
  llmModelEl.value = cfg.model;
  const enabled = llmEnabled();
  llmModePill.textContent = enabled ? "🤖 LLM 모드" : "🧩 규칙 모드";
  llmModePill.classList.toggle("llm-on", enabled);
  llmStatusEl.textContent = enabled
    ? `✓ 연결 대상: ${PROVIDER_LABELS[cfg.provider] || cfg.provider} · ${cfg.model} · ${cfg.baseUrl}`
    : `미설정 — 규칙 기반 분석을 사용합니다. OpenAI 호환 API 또는 Google Gemini를 연결하면 더 깊은 분석이 가능합니다.`;
  // 수업 설계 어시스턴트 모드 표시
  if (designModePillEl) {
    designModePillEl.textContent = enabled ? "🤖 LLM 모드" : "🧩 규칙 모드";
    designModePillEl.classList.toggle("llm-on", enabled);
  }
  // 주간 리포트 모드 표시
  if (reportModePillEl) {
    reportModePillEl.textContent = enabled ? "🤖 LLM 모드" : "🧩 규칙 모드";
    reportModePillEl.classList.toggle("llm-on", enabled);
  }
}

// 제공자 전환 시 기본 주소·모델 자동 제안
llmProviderEl.addEventListener("change", () => {
  const p = llmProviderEl.value;
  const def = PROVIDER_DEFAULTS[p] || PROVIDER_DEFAULTS.openai;
  if (!llmBaseUrlEl.value.trim() || Object.values(PROVIDER_DEFAULTS).some((d) => d.baseUrl === llmBaseUrlEl.value.trim())) {
    llmBaseUrlEl.value = def.baseUrl;
  }
  if (!llmModelEl.value.trim() || Object.values(PROVIDER_DEFAULTS).some((d) => d.model === llmModelEl.value.trim())) {
    llmModelEl.value = def.model;
  }
  llmBaseUrlEl.placeholder = p === "gemini" ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1";
  llmModelEl.placeholder = p === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini";
  llmStatusEl.textContent =
    p === "gemini"
      ? "Gemini: API 키(AIza...)는 Google AI Studio(ai.google.dev)에서 발급받을 수 있습니다."
      : "OpenAI 호환: 키(sk-...)는 제공자 콘솔에서 발급받을 수 있습니다.";
});

document.getElementById("llmSave").addEventListener("click", () => {
  saveLLMConfig({
    provider: llmProviderEl.value,
    baseUrl: llmBaseUrlEl.value.trim() || PROVIDER_DEFAULTS[llmProviderEl.value].baseUrl,
    model: llmModelEl.value.trim() || PROVIDER_DEFAULTS[llmProviderEl.value].model,
    apiKey: llmApiKeyEl.value.trim(),
  });
  updateLLMUI();
  llmStatusEl.textContent = "✓ 저장되었습니다. 설정은 이 브라우저에만 보관됩니다.";
});

document.getElementById("llmClear").addEventListener("click", () => {
  localStorage.removeItem(LLM_KEY);
  updateLLMUI();
});

/* ============================================================
   6) 수업 설계 어시스턴트
   ============================================================ */
const dSubject = document.getElementById("dSubject");
const dGoal = document.getElementById("dGoal");
const dReadiness = document.getElementById("dReadiness");
const designOutput = document.getElementById("designOutput");

const READINESS_NOTES = {
  low: "준비도가 낮은 학생에게는 명확한 안내와 짧은 단계가 중요합니다. 선택지는 2개 이하로 줄이고, 비계를 촘촘히 놓아주세요.",
  mid: "보통 준비도의 학생에게는 적당한 선택지와 중간 점검이 효과적입니다. 실수해도 괜찮다는 안전감을 먼저 만들어 주세요.",
  high: "준비도가 높은 학생에게는 큰 선택권과 자기평가를 맡겨보세요. 교사는 조력자로, 안전망 역할에 집중하세요.",
};

function checkedValues() {
  return [...document.querySelectorAll(`input[type="checkbox"][value]`)].filter((c) => c.checked).map((c) => c.value);
}

function generatePlan() {
  const subject = dSubject.value.trim();
  const goal = dGoal.value.trim();
  const readiness = dReadiness.value;

  if (!subject || !goal) {
    alert("수업 주제와 학습 목표를 입력해 주세요.");
    return null;
  }

  const elements = checkedValues();
  const voice = elements.includes("voice");
  const choice = elements.includes("choice");
  const ownership = elements.includes("ownership");
  const reflection = elements.includes("reflection");
  const question = elements.includes("question");
  const material = elements.includes("material");
  const peer = elements.includes("peer");
  const safety = elements.includes("safety");
  const feedback = elements.includes("feedback");

  const intro = [];
  if (voice) intro.push("흥미 유발 질문: “이 주제에 대해 무엇이 궁금한가요?” 학생 질문을 받아 그중 하나를 수업의 탐구 문제로 삼기.");
  if (choice) intro.push("오늘의 선택지 소개: 활동 방법(개인/모둠, 글/발표/영상) 중 무엇을 고를 수 있는지 안내하기.");
  if (!voice && !choice) intro.push("오늘의 목표와 흐름을 함께 확인하고, 배울 내용에 대한 학생의 예상 질문을 하나씩 받기.");
  if (intro.length < 2) intro.push("오늘 배울 내용과 연결된 짧은 상황·자료로 호기심 열기.");

  const body = [];
  if (ownership) body.push("역할과 책임 나누기: 모둠 활동 시 역할을 학생들이 스스로 정하고, 결과물의 주인은 학생임을 명확히 하기.");
  if (choice) body.push("선택 활동: 준비된 활동 중 학생이 하나를 골라 진행하고, 선택한 이유를 한 문장으로 적게 하기.");
  if (voice) body.push("발문 비계: 답을 주기 전에 “왜?”, “그렇게 생각한 이유는?”으로 되묻고, 학생 질문을 수업 흐름에 반영하기.");
  if (reflection) body.push("중간 점검: 전개 중간에 “지금까지 배운 것을 한 문장으로” 정리하는 3분의 시간 갖기.");
  if (peer) body.push("모둠 협력: 서로 설명하고 확인하는 시간을 두어 ‘가르치며 배우기’가 일어나게 하기.");
  if (material) body.push("보조 자료: 개념 지도·예시 카드 등 학생이 스스로 참고할 수 있는 자료를 비치하기.");
  if (body.length < 3) body.push("핵심 내용을 학생 말로 다시 설명하는 정리 활동으로 이해를 확인하기.");

  const close = [];
  if (reflection) close.push("3분 배움 일지: “오늘 배운 것 / 더 알고 싶은 것 / 다음에 시도할 것”을 기록하기.");
  close.push("한 문장 배움 나누기: 각자 배운 것을 한 문장으로 나누고, 다음 수업에 가져갈 질문을 하나씩 남기기.");
  if (feedback) close.push("짧은 피드백: 잘된 점 한 가지와 다음 단계 한 가지를 구체적으로 돌려주기.");

  const scaffold = [];
  if (question) scaffold.push("질문·발문 비계 — 되묻기와 발문으로 학생이 스스로 답에 닿도록 돕기.");
  if (material) scaffold.push("자료·보조자료 — 필요한 순간 스스로 참고할 수 있는 자료 제공.");
  if (peer) scaffold.push("모둠 협력 — 서로 돕는 구조 만들기.");
  if (safety) scaffold.push("실패 안전망 — “틀려도 괜찮아” 문화와 실수 공유 시간.");
  if (feedback) scaffold.push("피드백 루틴 — 수업 중·후 짧고 구체적인 피드백 주고받기.");
  if (!scaffold.length) scaffold.push("준비도에 맞는 최소한의 안내와 격려를 유지하기.");

  const assess =
    readiness === "low"
      ? "과정 중심 평가: 작은 단계마다 성취를 확인하고, 칭찬과 다음 단계 안내를 함께 주기."
      : readiness === "high"
      ? "자기평가 + 동료평가: 학생 스스로 루브릭으로 평가하고, 교사는 조정자 역할하기."
      : "혼합 평가: 학생 자기평가 한 줄 + 교사 관찰 기록을 함께 활용하기.";

  return { subject, goal, readiness, intro, body, close, scaffold, assess, elements };
}

async function generatePlanWithLLM() {
  const subject = dSubject.value.trim();
  const goal = dGoal.value.trim();
  const readiness = dReadiness.value;
  const elements = checkedValues();

  if (!subject || !goal) {
    alert("수업 주제와 학습 목표를 입력해 주세요.");
    return null;
  }

  const designLogEl = document.getElementById("designLog");
  clearAgentLog(designLogEl);
  designOutput.innerHTML = "";

  const cfg = loadLLMConfig();
  logAgentStep("🧠", "목표 설정", `수업 설계안 생성 (LLM 엔진)`, true, designLogEl);
  logAgentStep("🗂️", "도구 선택", `llmChatCompletion(${cfg.model}, json)`, true, designLogEl);
  await delay(200);

  const userPrompt = `아래 조건으로 수업 설계안을 만들어줘.

수업 주제: ${subject}
학습 목표: ${goal}
학생 준비도: ${readiness === "low" ? "낮음" : readiness === "high" ? "높음" : "보통"}
담을 주도성 요소: ${elements.filter(e => ["voice", "choice", "ownership", "reflection"].includes(e)).map(e => AGENCY_LABELS[e]).join(", ") || "전체"}
비계·안전망 요소: ${elements.filter(e => ["question", "material", "peer", "safety", "feedback"].includes(e)).map(e => { const labels = {question:"질문·발문 비계", material:"자료·보조자료", peer:"모둠 협력", safety:"실패 안전망", feedback:"피드백 루틴"}; return labels[e]; }).join(", ") || "전체"}`;

  try {
    const t0 = performance.now();
    const data = await llmComplete([
      { role: "system", content: DESIGN_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ]);
    const latency = Math.round(performance.now() - t0);
    const content = llmText(data);
    const parsed = extractJSON(content);
    if (!parsed) throw new Error("LLM 응답을 JSON으로 해석하지 못했습니다.");

    const plan = {
      subject: parsed.subject || subject,
      goal: parsed.goal || goal,
      readiness: parsed.readiness || readiness,
      intro: Array.isArray(parsed.intro) && parsed.intro.length ? parsed.intro : generatePlan().intro,
      body: Array.isArray(parsed.body) && parsed.body.length ? parsed.body : generatePlan().body,
      close: Array.isArray(parsed.close) && parsed.close.length ? parsed.close : generatePlan().close,
      scaffold: Array.isArray(parsed.scaffold) && parsed.scaffold.length ? parsed.scaffold : generatePlan().scaffold,
      assess: parsed.assess || generatePlan().assess,
      elements,
    };

    logAgentStep("📡", "LLM 호출", `${cfg.model} · ${latency}ms · JSON 응답 파싱 완료`, true, designLogEl);
    logAgentStep("🧩", "응답 합성", "설계안 구성 완료", true, designLogEl);

    return plan;
  } catch (err) {
    const msg = friendlyError(err);
    logAgentStep("⚠️", "오류 발생", msg, true, designLogEl);
    designOutput.innerHTML = `
      <div class="agent-error">
        <strong>⚠️ LLM 설계안 생성에 실패했습니다.</strong>
        <p>${esc(msg)}</p>
        <p class="agent-error-hint">API 설정을 확인하거나, 아래 버튼으로 규칙 기반 설계안으로 전환해 보세요.</p>
        <button class="btn btn-ghost" type="button" id="designFallback">🧩 규칙 기반으로 다시 생성</button>
      </div>`;
    designOutput.querySelector("#designFallback").addEventListener("click", () => {
      const plan = generatePlan();
      if (plan) renderPlan(plan);
    });
    return null;
  }
}

function renderPlan(plan) {
  const readinessLabel = { low: "낮음", mid: "보통", high: "높음" }[plan.readiness];
  const metaPills =
    `<span class="plan-pill">📚 ${esc(plan.subject)}</span>` +
    `<span class="plan-pill">🎯 ${esc(plan.goal)}</span>` +
    `<span class="plan-pill">🧗 준비도: ${readinessLabel}</span>` +
    plan.elements
      .filter((e) => ["voice", "choice", "ownership", "reflection"].includes(e))
      .map((e) => `<span class="plan-pill">✨ ${AGENCY_LABELS[e]}</span>`)
      .join("");

  designOutput.innerHTML = `
    <div class="design-output">
      <h3>📋 수업 설계안 — ${esc(plan.subject)}</h3>
      <div class="plan-meta">${metaPills}</div>
      <div class="plan-phase">
        <h4>🧗 기본 원칙</h4>
        <ul><li>${esc(READINESS_NOTES[plan.readiness])}</li></ul>
      </div>
      <div class="plan-phase">
        <h4>🚪 도입 (5~7분)</h4>
        <ul>${plan.intro.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
      </div>
      <div class="plan-phase">
        <h4>🔍 전개</h4>
        <ul>${plan.body.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      </div>
      <div class="plan-phase">
        <h4>🌙 정리 (3~5분)</h4>
        <ul>${plan.close.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      </div>
      <div class="plan-phase">
        <h4>🛡️ 비계 · 안전망</h4>
        <ul>${plan.scaffold.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      </div>
      <div class="plan-phase">
        <h4>📝 평가 · 성찰</h4>
        <ul><li>${esc(plan.assess)}</li></ul>
      </div>
      <div class="design-actions">
        <button class="btn btn-teacher" type="button" id="planSave">💾 일지에 저장</button>
        <button class="btn btn-ghost" type="button" id="planCopy">📋 복사</button>
        <span class="design-saved" id="planSavedMsg" hidden>✓ 저장되었습니다</span>
      </div>
    </div>`;

  document.getElementById("planSave").addEventListener("click", () => savePlanToJournal(plan));
  document.getElementById("planCopy").addEventListener("click", () => copyPlan(plan));
  designOutput.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function planToText(plan) {
  return [
    `[수업 설계] ${plan.subject}`,
    `목표: ${plan.goal}`,
    `준비도: ${READINESS_NOTES[plan.readiness]}`,
    `\n[도입]\n- ` + plan.intro.join("\n- "),
    `\n[전개]\n- ` + plan.body.join("\n- "),
    `\n[정리]\n- ` + plan.close.join("\n- "),
    `\n[비계·안전망]\n- ` + plan.scaffold.join("\n- "),
    `\n[평가]\n- ` + plan.assess,
  ].join("\n");
}

function savePlanToJournal(plan) {
  const list = loadJournal();
  list.push({
    id: "j" + Date.now(),
    date: todayStr(),
    title: `수업 설계: ${plan.subject}`,
    situation: planToText(plan),
    good: "",
    hard: "",
    next: "",
    createdAt: Date.now(),
  });
  saveJournal(list);
  renderJournalList();
  renderStats();
  populateCoachSelect();
  document.getElementById("planSavedMsg").hidden = false;
  setTimeout(() => (document.getElementById("planSavedMsg").hidden = true), 2600);
}

function copyPlan(plan) {
  const text = planToText(plan);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => alert("설계안이 클립보드에 복사되었습니다."),
      () => fallbackCopy(text)
    );
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
  alert("설계안이 클립보드에 복사되었습니다.");
}

document.getElementById("designRun").addEventListener("click", async () => {
  if (llmEnabled()) {
    const plan = await generatePlanWithLLM();
    if (plan) renderPlan(plan);
  } else {
    const plan = generatePlan();
    if (plan) renderPlan(plan);
  }
});

/* ============================================================
   7) 주간 성찰 리포트 (LLM / 규칙 하이브리드 + 시각화)
   ============================================================ */
const reportDaysEl = document.getElementById("reportDays");
const reportRunEl = document.getElementById("reportRun");
const reportStatsEl = document.getElementById("reportStats");
const reportOutputEl = document.getElementById("reportOutput");
const reportLogEl = document.getElementById("reportLog");
const radarCanvas = document.getElementById("radarCanvas");
const radarLegendEl = document.getElementById("radarLegend");
const heatmapEl = document.getElementById("heatmap");

const RADAR_AXES = [
  { key: "voice", label: "목소리" },
  { key: "choice", label: "선택권" },
  { key: "ownership", label: "소유권" },
  { key: "reflection", label: "자기성찰" },
  { key: "safety", label: "안전한 실패" },
  { key: "scaffolding", label: "비계·지원" },
];

function weekEntries(days) {
  const list = loadJournal();
  const cutoff = Date.now() - days * 86400000;
  return [...list]
    .filter((e) => new Date(e.date + "T00:00:00").getTime() >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
}

function entryText(e) {
  return [e.title, e.situation, e.good, e.hard, e.next].filter(Boolean).join(" ");
}

function computeAgencyScores(entries) {
  const counts = { voice: 0, choice: 0, ownership: 0, reflection: 0, safety: 0, scaffolding: 0 };
  entries.forEach((e) => {
    const d = detectAgency(entryText(e));
    Object.entries(d).forEach(([k, v]) => {
      counts[k] += v;
    });
  });
  const max = Math.max(1, ...Object.values(counts));
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Math.round((v / max) * 100)]));
}

const WEEKLY_SYSTEM_PROMPT = `너는 한국의 교육 전문가이자 '주간 성찰 리포트 에이전트'다. 지난 기간 동안 교사가 쓴 수업 성찰일지들을 읽고, 반복되는 고민과 성장 포인트를 짚어 주간 리포트를 만든다.
반드시 아래 JSON 구조로만 답하고, JSON 외의 텍스트는 절대 출력하지 마라.
{
  "summary": "이번 기간의 성찰 전체를 아우르는 요약 (2~3문장, 구체적 근거를 함께)",
  "repeatedConcerns": ["반복적으로 나타난 고민·패턴 2~3개 (없으면 '뚜렷한 반복 패턴 없음'이라고 명시)"],
  "growthPoints": ["성장하거나 잘하고 있는 포인트 2~3개"],
  "nextWeekGoals": ["다음 주에 시도할 구체적 목표 2~3개"],
  "focus": "다음 주 한 가지 집중 포커스 (한 문장)"
}`;

const DESIGN_SYSTEM_PROMPT = `너는 한국의 교육 전문가이자 '수업 설계 어시스턴트'다. 교사가 입력한 주제, 목표, 준비도, 선택한 주도성 요소와 비계 요소를 바탕으로 학생주도성을 실현하는 수업 설계안을 만든다.
반드시 아래 JSON 구조로만 답하고, JSON 외의 텍스트는 절대 출력하지 마라.
{
  "subject": "수업 주제",
  "goal": "학습 목표",
  "readiness": "low 또는 mid 또는 high",
  "intro": ["도입 활동 2~4개 (구체적으로, 학생이 무엇을 하는지 명시)"],
  "body": ["전개 활동 3~5개 (구체적으로, 학생이 무엇을 하는지 명시)"],
  "close": ["정리 활동 2~3개 (구체적으로, 학생이 무엇을 하는지 명시)"],
  "scaffold": ["비계·안전망 2~4개 (구체적으로, 어떤 도움을 제공하는지 명시)"],
  "assess": "평가·성찰 방법 (한 문장, 준비도에 맞게)"
}

수업 설계 원칙:
1. 학생의 목소리(질문·의견)가 수업에 반영되도록 설계할 것
2. 학생이 선택할 수 있는 기회를 반드시 포함할 것
3. 결과물의 주인은 학생임을 명확히 할 것
4. 성찰 시간을 수업에 자연스럽게 포함할 것
5. 실패해도 괜찮은 안전한 분위기를 만들 것
6. 학생의 준비도에 맞는 비계(발판)를 제공할 것
7. 구체적이고 실행 가능한 활동으로 기술할 것
`;

function ruleWeekSummary(entries) {
  const all = entries.map(entryText).join(" ");
  const agency = detectAgency(all);
  const gaps = Object.entries(agency).sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const present = Object.entries(agency).filter(([, v]) => v > 0).map(([k]) => AGENCY_LABELS[k]);

  const concerns = [];
  if (gaps.length) {
    const weak = gaps.slice(0, 2);
    concerns.push(`${AGENCY_LABELS[weak[0]]} 영역의 언급이 가장 적었습니다. 이번 주 일지에서 이 요소에 주목해 보세요.`);
    if (weak[1]) concerns.push(`${AGENCY_LABELS[weak[1]]} 영역도 성찰의 폭을 넓힐 여지가 있습니다.`);
  }
  if (entries.some((e) => e.hard && /시간|진도|부족/.test(e.hard))) {
    concerns.push("시간·진도 부담에 대한 고민이 반복적으로 등장했습니다.");
  }
  if (!concerns.length) concerns.push("이번 기간에는 뚜렷한 반복 패턴이 없었습니다. 다음 주에도 기록을 이어가 보세요.");

  const growth = [];
  if (present.length) growth.push(`이번 기간 일지에는 ${present.slice(0, 3).join(", ")} 요소가 나타났습니다.`);
  const goodSentences = all.split(/[.!?。\n]+/).map((s) => s.trim()).filter((s) => POS_WORDS.some((w) => s.includes(w)));
  if (goodSentences.length) growth.push(`“${goodSentences[0].slice(0, 60)}” — 긍정적인 순간이 기록에 남아 있습니다.`);
  const hardCount = all.split(/[.!?。\n]+/).filter((s) => NEG_WORDS.some((w) => s.includes(w))).length;
  if (hardCount === 0) growth.push("부정적 표현 없이 기록한 기간이었습니다. 성찰의 톤이 안정적입니다.");
  if (!growth.length) growth.push("매일 기록을 남긴 것 자체가 가장 큰 성장입니다. 꾸준함이 힘입니다.");

  const nexts = entries.map((e) => e.next).filter(Boolean);
  const goals = nexts.length
    ? nexts.slice(0, 3).map((n) => `일지에 적은 계획 실천: ${n}`)
    : ["다음 수업에서 학생 선택권을 하나 늘려보기", "수업 마무리에 3분 배움 일지 시간 만들기", "이번 주에 배운 것을 한 가지씩 정리해 기록하기"];

  const focus = AGENCY_LABELS[gaps[0]] || "학생의 배움 경험";
  return {
    summary: `이번 기간 동안 ${entries.length}개의 성찰을 남겼습니다. 주로 ${present.slice(0, 2).join("과 ") || "수업 전반"}에 대한 이야기가 담겨 있었고, 기록이 쌓일수록 성찰의 깊이가 더해지고 있습니다.`,
    repeatedConcerns: concerns,
    growthPoints: growth,
    nextWeekGoals: goals,
    focus: `${focus}에 집중해 다음 주를 설계해 보세요.`,
  };
}

async function weekSummaryWithLLM(entries) {
  const cfg = loadLLMConfig();
  const t0 = performance.now();
  const texts = entries
    .map((e, i) => `[${e.date}] ${e.title || "제목 없는 성찰"}\n수업 상황: ${e.situation}\n잘된 점: ${e.good || "—"}\n어려움: ${e.hard || "—"}\n다음 계획: ${e.next || "—"}`)
    .join("\n\n" + "-".repeat(30) + "\n\n");
  const data = await llmComplete([
    { role: "system", content: WEEKLY_SYSTEM_PROMPT },
    { role: "user", content: `아래는 최근 성찰일지들이다. 주간 리포트를 작성해줘.\n\n${texts}` },
  ]);
  const latency = Math.round(performance.now() - t0);
  const parsed = extractJSON(llmText(data));
  if (!parsed) throw new Error("LLM 응답을 JSON으로 해석하지 못했습니다.");
  const rule = ruleWeekSummary(entries);
  return {
    parsed: {
      summary: parsed.summary || rule.summary,
      repeatedConcerns: Array.isArray(parsed.repeatedConcerns) && parsed.repeatedConcerns.length ? parsed.repeatedConcerns : rule.repeatedConcerns,
      growthPoints: Array.isArray(parsed.growthPoints) && parsed.growthPoints.length ? parsed.growthPoints : rule.growthPoints,
      nextWeekGoals: Array.isArray(parsed.nextWeekGoals) && parsed.nextWeekGoals.length ? parsed.nextWeekGoals : rule.nextWeekGoals,
      focus: parsed.focus || rule.focus,
    },
    latency,
    model: cfg.model,
  };
}

function renderReport(r, meta) {
  reportOutputEl.innerHTML = `
    <div class="report-output">
      <div class="report-output-head">
        <span style="font-size:26px;">📄</span>
        <strong>주간 성찰 리포트</strong>
        <em>${esc(meta)}</em>
      </div>
      <p class="report-summary">📝 ${esc(r.summary || "")}</p>
      <div class="report-block concern">
        <h4>🔁 반복되는 고민 · 패턴</h4>
        <ul>${(r.repeatedConcerns || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
      <div class="report-block growth">
        <h4>🌱 성장 포인트</h4>
        <ul>${(r.growthPoints || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
      <div class="report-block goal">
        <h4>🎯 다음 주 목표</h4>
        <ul>${(r.nextWeekGoals || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
      <div class="report-focus">⭐ 다음 주 포커스: ${esc(r.focus || "")}</div>
    </div>`;
  reportOutputEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderReportError(err) {
  const msg = friendlyError(err);
  logAgentStep("⚠️", "오류 발생", msg, true, reportLogEl);
  reportOutputEl.innerHTML = `
    <div class="agent-error">
      <strong>⚠️ LLM 리포트 생성에 실패했습니다.</strong>
      <p>${esc(msg)}</p>
      <p class="agent-error-hint">API 설정을 확인하거나, 아래 버튼으로 규칙 기반 요약으로 전환해 보세요.</p>
      <button class="btn btn-ghost" type="button" id="reportFallback">🧩 규칙 기반으로 다시 생성</button>
    </div>`;
  reportOutputEl.querySelector("#reportFallback").addEventListener("click", () => {
    localStorage.removeItem(LLM_KEY);
    updateLLMUI();
    runReport();
  });
}

/* ---------- 레이더 차트 (Canvas) ---------- */
function drawRadar(scores) {
  const ctx = radarCanvas.getContext("2d");
  const W = radarCanvas.width;
  const H = radarCanvas.height;
  const cx = W / 2;
  const cy = H / 2 + 6;
  const R = Math.min(W, H) / 2 - 72;
  const n = RADAR_AXES.length;

  ctx.clearRect(0, 0, W, H);
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.scale(dpr / dpr, dpr / dpr);

  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, r) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];

  // 그리드 링 + 축
  ctx.strokeStyle = "#e8e5de";
  ctx.fillStyle = "#5b5d78";
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const [x, y] = pt(i % n, (R * ring) / 4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(i, R);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  // 축 라벨
  ctx.font = "600 12.5px 'Noto Sans KR', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  RADAR_AXES.forEach((axis, i) => {
    const [x, y] = pt(i, R + 26);
    const label = axis.label;
    if (label.includes("·")) {
      const [a, b] = label.split("·");
      ctx.fillText(a, x, y - 7);
      ctx.fillText("·" + b, x, y + 8);
    } else {
      ctx.fillText(label, x, y);
    }
  });

  // 데이터 폴리곤
  const polygon = RADAR_AXES.map((axis, i) => pt(i, (R * (scores[axis.key] || 0)) / 100));
  ctx.beginPath();
  polygon.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = "rgba(245, 158, 11, 0.28)";
  ctx.fill();
  ctx.strokeStyle = "#ea7a0c";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 데이터 포인트
  polygon.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 3.6, 0, Math.PI * 2);
    ctx.fillStyle = "#4f46e5";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
  ctx.restore();

  // 범례
  radarLegendEl.innerHTML = RADAR_AXES.map(
    (a) =>
      `<span><i class="legend-dot" style="background:linear-gradient(135deg, var(--student), var(--teacher));"></i>${AGENCY_LABELS[a.key]} <strong>${scores[a.key] || 0}</strong></span>`
  ).join("");
}

/* ---------- 히트맵 (최근 12주) ---------- */
function buildHeatmap() {
  const entries = loadJournal();
  const byDate = {};
  entries.forEach((e) => {
    byDate[e.date] = (byDate[e.date] || 0) + 1;
  });

  const WEEKS = 12;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay())); // 이번 주 토요일
  const start = new Date(end);
  start.setDate(start.getDate() - (WEEKS * 7 - 1));

  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
  const cells = [];
  const monthCells = [];
  let lastMonth = -1;

  for (let w = 0; w < WEEKS; w++) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + w * 7);
    const m = weekStart.getMonth();
    monthCells.push(
      `<div class="hm-month" style="grid-column:${w + 2};">${m !== lastMonth ? (m + 1) + "월" : ""}</div>`
    );
    lastMonth = m;
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + d);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const count = byDate[key] || 0;
      const lvl = count === 0 ? 0 : count >= 4 ? 4 : count;
      cells.push(
        `<div class="hm-cell" data-lvl="${lvl}" style="grid-column:${w + 2};grid-row:${d + 2};" title="${key}${count ? ` · 성찰 ${count}개` : " · 기록 없음"}"></div>`
      );
    }
  }

  heatmapEl.style.gridTemplateColumns = `auto repeat(${WEEKS}, 1fr)`;
  heatmapEl.innerHTML =
    `<div></div>` + monthCells.join("") +
    dayLabels.map((l, i) => `<div class="hm-label" style="grid-column:1;grid-row:${i + 2};">${l}</div>`).join("") +
    cells.join("");
}

function renderReportStats(entries, days) {
  const total = loadJournal().length;
  const hardCount = entries.filter((e) => e.hard).length;
  const nextCount = entries.filter((e) => e.next).length;
  reportStatsEl.innerHTML =
    `<span class="stat-pill">🗓️ 분석 기간: 최근 ${days}일</span>` +
    `<span class="stat-pill">📓 해당 기간 ${entries.length}개</span>` +
    `<span class="stat-pill">🔍 전체 ${total}개</span>` +
    `<span class="stat-pill">💭 고민 기록 ${hardCount}개</span>` +
    `<span class="stat-pill">🗒️ 계획 기록 ${nextCount}개</span>`;
}

async function runReport() {
  const days = Number(reportDaysEl.value || 7);
  const entries = weekEntries(days);

  renderReportStats(entries, days);
  buildHeatmap();

  if (!entries.length) {
    reportOutputEl.innerHTML =
      `<div class="report-empty">🌱 최근 ${days}일 동안 기록이 없습니다.<br />성찰일지 탭에서 첫 기록을 남겨보세요. 그래야 주간 리포트가 쌓인 기록을 바탕으로 만들어집니다.</div>`;
    drawRadar(computeAgencyScores([]));
    return;
  }

  const scores = computeAgencyScores(entries);
  drawRadar(scores);

  clearAgentLog(reportLogEl);
  reportOutputEl.innerHTML = "";
  const enabled = llmEnabled();
  const cfg = loadLLMConfig();

  logAgentStep("🧠", "목표 설정", enabled ? `최근 ${days}일 성찰 ${entries.length}개 주간 요약 (LLM 엔진)` : `최근 ${days}일 성찰 ${entries.length}개 주간 요약 (규칙 엔진)`, true, reportLogEl);
  logAgentStep("🗂️", "도구 선택", enabled ? `llmChatCompletion(${cfg.model}, json) + computeAgencyScores` : "detectAgency · 패턴 추출 · computeAgencyScores", true, reportLogEl);
  await delay(200);

  let r;
  let meta;
  if (enabled) {
    try {
      const res = await weekSummaryWithLLM(entries);
      r = res.parsed;
      meta = `LLM 분석 · ${res.model} · ${res.latency}ms`;
      logAgentStep("📡", "LLM 호출", `${res.model} · ${res.latency}ms · JSON 응답 파싱 완료`, true, reportLogEl);
      logAgentStep("🧩", "응답 합성", "요약·고민·성장·목표 정리 완료", true, reportLogEl);
    } catch (err) {
      renderReportError(err);
      return;
    }
  } else {
    await runAgentPipeline(
      [
        {
          icon: "📊",
          label: "detectAgency",
          detail: (() => {
            const a = detectAgency(entries.map(entryText).join(" "));
            return "요소별 언급: " + Object.entries(a).filter(([, c]) => c > 0).map(([k, c]) => `${AGENCY_LABELS[k]} ${c}회`).join(", ") || "아직 요소 언급 없음";
          })(),
        },
        {
          icon: "🔁",
          label: "패턴 추출",
          detail: `일지 ${entries.length}개에서 고민·성장 패턴 추출 완료`,
        },
        {
          icon: "🎯",
          label: "다음 주 목표 생성",
          detail: "일지의 다음 계획을 바탕으로 목표 정리 완료",
        },
      ],
      reportLogEl
    );
    r = ruleWeekSummary(entries);
    meta = "규칙 기반 요약 완료";
  }

  renderReport(r, meta);
}

reportRunEl.addEventListener("click", runReport);
reportDaysEl.addEventListener("change", () => {
  renderReportStats(weekEntries(Number(reportDaysEl.value || 7)), Number(reportDaysEl.value || 7));
});

/* ============================================================
   스튜디오 서브탭 전환
   ============================================================ */
const subTabButtons = document.querySelectorAll(".sub-tab");
const subPanels = {
  journal: document.getElementById("sub-journal"),
  coach: document.getElementById("sub-coach"),
  designer: document.getElementById("sub-designer"),
  report: document.getElementById("sub-report"),
};

function switchSubTab(name) {
  subTabButtons.forEach((btn) => {
    const active = btn.dataset.stab === name;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  Object.entries(subPanels).forEach(([key, panel]) => {
    panel.hidden = key !== name;
    panel.classList.toggle("is-active", key === name);
  });
}

subTabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchSubTab(btn.dataset.stab));
});

/* ============================================================
   8) IndexedDB 기반 에이전트 장기 기억 (RAG)
   ============================================================ */
const MEMORY_DB_NAME = "agency-memory";
const MEMORY_DB_VERSION = 1;

/* ---------- IndexedDB 래퍼 ---------- */
let _memDB = null;

async function openMemoryDB() {
  if (_memDB) return _memDB;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MEMORY_DB_NAME, MEMORY_DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("journals")) {
        const s = db.createObjectStore("journals", { keyPath: "id" });
        s.createIndex("date", "date", { unique: false });
        s.createIndex("keywords", "keywords", { unique: false, multiEntry: true });
      }
      if (!db.objectStoreNames.contains("analyses")) {
        const s = db.createObjectStore("analyses", { keyPath: "id" });
        s.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains("conversations")) {
        const s = db.createObjectStore("conversations", { keyPath: "id" });
        s.createIndex("date", "date", { unique: false });
        s.createIndex("topic", "topic", { unique: false });
      }
    };
    req.onsuccess = (e) => { _memDB = e.target.result; resolve(_memDB); };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function memPut(storeName, record) {
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function memGet(storeName, key) {
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function memGetAll(storeName) {
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function memDelete(storeName, key) {
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function memCount(storeName) {
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function memClear(storeName) {
  const db = await openMemoryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/* ---------- 키워드 추출 ---------- */
function extractKeywords(text) {
  if (!text) return [];
  const tokens = text
    .replace(/[\n\r\t]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[^가-힣a-zA-Z0-9]/g, "").toLowerCase())
    .filter((w) => w.length >= 2);
  const stop = new Set(["것", "수", "등", "때", "더", "위해", "통해", "이", "그", "저", "것들", "으로", "에서", "의", "에", "를", "이", "가", "은", "는", "와", "과", "도", "로", "하고", "있는", "되는", "없는", "하는"]);
  return [...new Set(tokens.filter((t) => !stop.has(t)))];
}

/* ---------- 일지 → IndexedDB 동기화 ---------- */
async function syncJournalsToMemory() {
  const list = loadJournal();
  const count = await memCount("journals");
  // 이미 동기화된 경우 스킵 (간이: 개수 비교)
  if (count >= list.length) return count;
  for (const entry of list) {
    const fullText = entryText(entry);
    await memPut("journals", {
      id: entry.id,
      date: entry.date,
      title: entry.title || "",
      text: fullText,
      keywords: extractKeywords(fullText),
      agency: detectAgency(fullText),
      createdAt: entry.createdAt || Date.now(),
    });
  }
  return list.length;
}

/* ---------- 분석 결과 저장 ---------- */
async function saveAnalysisResult(journalId, analysis, meta) {
  await memPut("analyses", {
    id: "a" + journalId,
    journalId,
    date: todayStr(),
    ack: analysis.ack || "",
    focus: analysis.focus || "",
    questions: analysis.questions || [],
    suggestions: analysis.suggestions || [],
    themes: analysis.themes || [],
    meta,
    createdAt: Date.now(),
  });
}

/* ---------- 대화 이력 저장 ---------- */
async function saveConversationEntry(topic, userMsg, coachReply) {
  const id = "c" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  await memPut("conversations", {
    id,
    date: todayStr(),
    topic: topic || "general",
    userMsg,
    coachReply,
    keywords: extractKeywords(userMsg + " " + coachReply),
    createdAt: Date.now(),
  });
}

/* ============================================================
   8-2) 검색 엔진 (RAG Retrieval)
   ============================================================ */

/* 키워드 유사도 (자카드 기반) */
function keywordSimilarity(kw1, kw2) {
  if (!kw1.length || !kw2.length) return 0;
  const set2 = new Set(kw2);
  const overlap = kw1.filter((k) => set2.has(k)).length;
  return overlap / Math.max(kw1.length, kw2.length);
}

/* 주도성 요소 유사도 */
function agencySimilarity(a1, a2) {
  if (!a1 || !a2) return 0;
  const keys = Object.keys(AGENCY_KEYWORDS);
  const totalDist = keys.reduce((sum, k) => sum + Math.abs((a1[k] || 0) - (a2[k] || 0)), 0);
  const maxDist = keys.length * 10;
  return 1 - Math.min(totalDist / maxDist, 1);
}

/* RAG 검색: 쿼리와 유사한 일지/분석/대화를 검색 */
async function ragSearch(queryText, { limit = 5, includeAnalyses = true, includeConversations = true } = {}) {
  const queryKW = extractKeywords(queryText);
  const queryAgency = detectAgency(queryText);
  const results = [];

  // 1) 일지 검색
  const journals = await memGetAll("journals");
  for (const j of journals) {
    const kwSim = keywordSimilarity(queryKW, j.keywords || []);
    const agSim = agencySimilarity(queryAgency, j.agency || {});
    const score = kwSim * 0.6 + agSim * 0.4;
    if (score > 0.05) {
      results.push({ type: "journal", id: j.id, date: j.date, title: j.title, text: j.text, score, agency: j.agency });
    }
  }

  // 2) 분석 결과 검색
  if (includeAnalyses) {
    const analyses = await memGetAll("analyses");
    for (const a of analyses) {
      const combinedText = [a.ack, a.focus, ...(a.questions || []), ...(a.suggestions || [])].join(" ");
      const kwSim = keywordSimilarity(queryKW, extractKeywords(combinedText));
      const score = kwSim * 0.7 + 0.1;
      if (score > 0.1) {
        results.push({ type: "analysis", id: a.id, date: a.date, focus: a.focus, ack: a.ack, score });
      }
    }
  }

  // 3) 대화 이력 검색
  if (includeConversations) {
    const convos = await memGetAll("conversations");
    for (const c of convos) {
      const kwSim = keywordSimilarity(queryKW, c.keywords || []);
      const score = kwSim * 0.5 + 0.05;
      if (score > 0.1) {
        results.push({ type: "conversation", id: c.id, date: c.date, userMsg: c.userMsg, coachReply: c.coachReply, score });
      }
    }
  }

  // 점수순 정렬, 상위 N개 반환
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/* RAG 컨텍스트 문자열 생성 (LLM 프롬프트에 주입) */
function buildRAGContext(searchResults) {
  if (!searchResults.length) return "";
  const lines = [];
  lines.push("\n--- 장기 기억에서 검색된 관련 기록 ---");
  for (const r of searchResults) {
    if (r.type === "journal") {
      lines.push(`[일지 ${r.date}] ${r.title || "제목 없음"}`);
      lines.push(r.text.slice(0, 300));
    } else if (r.type === "analysis") {
      lines.push(`[이전 분석 ${r.date}] 포커스: ${r.focus || "—"}`);
      if (r.ack) lines.push(`  빛나는 순간: ${r.ack.slice(0, 100)}`);
    } else if (r.type === "conversation") {
      lines.push(`[이전 대화 ${r.date}] 질문: ${r.userMsg.slice(0, 80)}`);
      lines.push(`  답변 요약: ${r.coachReply.slice(0, 120)}`);
    }
  }
  lines.push("--- 장기 기억 끝 ---\n");
  return lines.join("\n");
}

/* 기간 내 반복 고민 패턴 감지 */
async function detectRepeatedPatterns(days = 28) {
  const journals = await memGetAll("journals");
  const cutoff = Date.now() - days * 86400000;
  const recent = journals.filter((j) => (j.createdAt || 0) >= cutoff);
  if (recent.length < 2) return [];

  const allKW = {};
  recent.forEach((j) => {
    (j.keywords || []).forEach((kw) => { allKW[kw] = (allKW[kw] || 0) + 1; });
  });
  const patterns = Object.entries(allKW)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));
  return patterns;
}

/* 주도성 요소별 누적 점수 추출 */
async function getAgencyTrend(days = 28) {
  const journals = await memGetAll("journals");
  const cutoff = Date.now() - days * 86400000;
  const recent = journals.filter((j) => (j.createdAt || 0) >= cutoff);
  const totals = { voice: 0, choice: 0, ownership: 0, reflection: 0, safety: 0, scaffolding: 0 };
  recent.forEach((j) => {
    Object.entries(j.agency || {}).forEach(([k, v]) => { totals[k] = (totals[k] || 0) + v; });
  });
  return { totals, count: recent.length };
}

/* ---------- RAG 강화 LLM 분석 ---------- */
async function analyzeWithLLMRAG(text, journalId) {
  // 1) 장기 기억에서 관련 기록 검색
  const searchResults = await ragSearch(text, { limit: 5 });
  const ragContext = buildRAGContext(searchResults);

  const cfg = loadLLMConfig();
  const t0 = performance.now();

  // 2) RAG 컨텍스트가 포함된 프롬프트로 LLM 호출
  const userMsg = `아래는 교사의 수업 성찰일지다. 분석해줘.\n\n${text}${ragContext ? "\n" + ragContext : ""}`;
  const data = await llmComplete([
    { role: "system", content: COACH_SYSTEM_PROMPT + "\n\n참고: 아래 '장기 기억에서 검색된 관련 기록' 섹션을 참고하여, 과거 성찰 패턴과의 연결을 발견하고 반복되는 고민이나 성장 궤적을 함께 분석해라. 장기 기억이 없으면 현재 일지만 분석하면 된다." },
    { role: "user", content: userMsg },
  ]);
  const latency = Math.round(performance.now() - t0);
  const content = llmText(data);
  const parsed = extractJSON(content);
  if (!parsed) throw new Error("LLM 응답을 JSON으로 해석하지 못했습니다.");

  // 3) 분석 결과 저장
  await saveAnalysisResult(journalId, parsed, `LLM+RAG 분석 · ${cfg.model} · ${latency}ms`);

  return { parsed, latency, model: cfg.model, raw: content, ragCount: searchResults.length };
}

/* ---------- RAG 강화 대화 ---------- */
async function ragChatReply(userText) {
  // 1) 장기 기억에서 관련 대화/일지 검색
  const searchResults = await ragSearch(userText, { limit: 3, includeAnalyses: false });
  const ragContext = buildRAGContext(searchResults);

  const history = coachSession.history;
  let augmentedMsg = userText;
  if (ragContext) {
    augmentedMsg = userText + "\n\n" + ragContext;
  }
  history.push({ role: "user", content: augmentedMsg });

  const bubble = appendChat("coach", "✍️ 답변 작성 중…");
  try {
    const full = await streamChat(history, (partial) => {
      bubble.textContent = partial + "▍";
    });
    bubble.textContent = full;
    history.push({ role: "assistant", content: full });

    // 4) 대화 이력 저장
    await saveConversationEntry(coachSession?.analysis?.focus || "general", userText, full);

    // 컨텍스트 관리: 시스템 프롬프트 + 최근 10개 메시지 유지
    const sys = history[0];
    coachSession.history = [sys, ...history.slice(1).slice(-10)];
  } catch (err) {
    bubble.textContent = "⚠️ " + friendlyError(err);
    history.pop();
  }
}

/* ============================================================
   8-3) RAG 메모리 패널 UI
   ============================================================ */

async function renderMemoryPanel() {
  const memPanelEl = document.getElementById("memoryPanel");
  if (!memPanelEl) return;

  const jCount = await memCount("journals");
  const aCount = await memCount("analyses");
  const cCount = await memCount("conversations");
  const patterns = await detectRepeatedPatterns(28);
  const trend = await getAgencyTrend(28);

  const patternHTML = patterns.length
    ? patterns.map((p) => `<li><strong>${esc(p.word)}</strong> — ${p.count}회 언급</li>`).join("")
    : "<li>아직 충분한 기록이 없습니다. 일지를 더 남겨주세요.</li>";

  const trendHTML = Object.entries(trend.totals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<span class="trend-pill">${AGENCY_LABELS[k] || k}: ${v}</span>`)
    .join("");

  memPanelEl.innerHTML = `
    <div class="memory-stats">
      <span class="stat-pill">📓 일지 ${jCount}건</span>
      <span class="stat-pill">🔍 분석 ${aCount}건</span>
      <span class="stat-pill">💬 대화 ${cCount}건</span>
    </div>
    <div class="memory-section">
      <h4>🔄 반복 패턴 (최근 28일)</h4>
      <ul>${patternHTML}</ul>
    </div>
    <div class="memory-section">
      <h4>📈 주도성 요소 누적</h4>
      <div class="trend-row">${trendHTML || "<span class='mini-note'>기록이 아직 없습니다.</span>"}</div>
    </div>`;
}

async function syncAndRenderMemory() {
  try {
    await syncJournalsToMemory();
    await renderMemoryPanel();
  } catch (err) {
    console.warn("Memory sync failed:", err);
  }
}

/* ============================================================
   8-4) RAG 통합 — 코치 분석·대화·일지 저장 시 자동 동기화
   ============================================================ */

/* 기존 runCoachAnalysis를 RAG 강화 버전으로 교체 */
const _origRunCoachAnalysis = runCoachAnalysis;

/* 코치 분석 시 RAG 사용 (전역 오버라이드) */
window._ragCoachAnalysisRunning = false;

/* 일지 저장 시 메모리 동기화 */
const _origSaveJournal = saveJournal;
function saveJournalWithSync(list) {
  _origSaveJournal(list);
  syncAndRenderMemory();
}
// saveJournal을 RAG 동기화가 포함된 버전으로 교체
// (전역 스코프에서 saveJournal을 직접 교체하면 다른 호출부도 영향을 받음)

/* 채팅 폼 제출 시 RAG 사용 */
const _origChatSubmit = chatForm.onsubmit;
chatForm.removeEventListener("submit", chatForm.onsubmit);
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  if (!coachSession) {
    appendChat("coach", "먼저 [에이전트 실행]으로 성찰을 분석해 주세요.");
    return;
  }
  appendChat("user", msg);
  chatInput.value = "";
  if (llmEnabled()) {
    ragChatReply(msg);
  } else {
    setTimeout(() => {
      const reply = coachChatReply(msg);
      appendChat("coach", reply);
      saveConversationEntry(coachSession?.analysis?.focus || "general", msg, reply);
    }, 350);
  }
});

/* ============================================================
   9) 초기화 (RAG 포함)
   ============================================================ */
renderJournalList();
renderStats();
populateCoachSelect();
updateLLMUI();
buildHeatmap();
drawRadar(computeAgencyScores(weekEntries(7)));
renderReportStats(weekEntries(7), 7);

/* RAG 초기 동기화 */
syncAndRenderMemory();

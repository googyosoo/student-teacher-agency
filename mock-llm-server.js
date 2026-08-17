/* ============================================================
   목 LLM 서버 (개발·테스트용)
   OpenAI 호환 /chat/completions + Google Gemini 호환 엔드포인트를 흉내 냅니다.

   - OpenAI:  API 주소 http://127.0.0.1:4180/v1, 키 아무 값, 모델 mock-model
   - Gemini:  API 주소 http://127.0.0.1:4180/v1beta, 키 아무 값, 모델 mock-gemini
   실제 키 없이도 LLM 모드 전체 흐름(분석·스트리밍 대화·주간 리포트)을 테스트할 수 있습니다.

   실행: node mock-llm-server.js
   ============================================================ */
const http = require("http");

const MOCK_ANALYSIS = {
  ack: "토론에 처음 참여한 학생이 질문을 던진 것은 의미 있는 변화입니다. 그 순간 교실의 주도권이 조금씩 학생에게 넘어가고 있었습니다.",
  sentiment: "positive",
  themes: ["토론 수업", "학생 참여", "시간 운영"],
  agencyGaps: ["자기성찰", "안전한 실패"],
  questions: [
    "조용한 학생들이 목소리를 낼 수 있는 구조를 만들려면 무엇이 필요할까요?",
    "학생들이 스스로 고를 수 있었던 선택은 무엇이었나요?",
    "실수해도 괜찮다는 안전감이 교실에 있었을까요?",
  ],
  suggestions: [
    "질문을 먼저 받아 칠판에 모으고, 그중 하나를 수업의 탐구 문제로 삼아보세요.",
    "주제·방법·발표 형식 중 하나는 학생이 고르게 해보세요.",
    "수업의 마지막 3분을 ‘배움 일지’ 시간으로 남겨보세요.",
    "조용한 학생에게는 짧은 쓰기 → 짝과 나누기 → 전체 발표 순서로 목소리를 키워주세요.",
  ],
  focus: "모든 학생의 목소리가 닿는 수업 구조 만들기",
};

const MOCK_CHAT =
  "학생 선택권을 늘리려면 주제·방법·발표 형식 중 하나는 학생이 고르게 해보세요. " +
  "작은 선택이 주인의식을 키웁니다. 특히 조용한 학생에게는 2~3개의 선택지 중 하나를 고르게 하는 것부터 시작해 보세요.";

const MOCK_GEMINI = {
  candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(MOCK_ANALYSIS) }] } }],
  usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 96, totalTokenCount: 216 },
};

function geminiStream(res) {
  // Gemini streamGenerateContent?alt=sse — 각 청크는 누적 텍스트를 담습니다
  const chunks = [...MOCK_CHAT];
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  let acc = "";
  let i = 0;
  const timer = setInterval(() => {
    if (i >= chunks.length) {
      clearInterval(timer);
      res.end();
      return;
    }
    acc += chunks[i];
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: acc }] } }],
    });
    res.write(`data: ${payload}\n\n`);
    i += 1;
  }, 15);
}

function sendJson(res, obj) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-goog-api-key");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(404);
    res.end("not found");
    return;
  }

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let parsed = {};
    try {
      parsed = JSON.parse(body);
    } catch { /* ignore */ }

    // ---- Google Gemini 호환 ----
    const urlLower = req.url.toLowerCase();
    if (urlLower.includes(":streamgeneratecontent")) {
      geminiStream(res);
      return;
    }
    if (urlLower.includes(":generatecontent")) {
      sendJson(res, MOCK_GEMINI);
      return;
    }

    // ---- OpenAI 호환 ----
    if (req.url.includes("/chat/completions")) {
      if (parsed.stream) {
        const chunks = [...MOCK_CHAT];
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        let i = 0;
        const timer = setInterval(() => {
          if (i >= chunks.length) {
            clearInterval(timer);
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }
          const payload = JSON.stringify({ choices: [{ delta: { content: chunks[i] } }] });
          res.write(`data: ${payload}\n\n`);
          i += 1;
        }, 15);
        return;
      }

      sendJson(res, {
        id: "mock-llm",
        object: "chat.completion",
        created: Date.now(),
        model: parsed.model || "mock-model",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: JSON.stringify(MOCK_ANALYSIS) },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 96, total_tokens: 216 },
      });
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });
});

server.listen(4180, "127.0.0.1", () => {
  console.log("Mock LLM server listening on http://127.0.0.1:4180");
});

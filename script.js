/* ============================================================
   주도성의 조화 — 인터랙션
   ============================================================ */

/* ---------- 모바일 내비게이션 ---------- */
const nav = document.getElementById("mainNav");
const navOpen = document.getElementById("navOpen");
const navClose = document.getElementById("navClose");

navOpen.addEventListener("click", () => {
  nav.classList.add("is-open");
  navOpen.setAttribute("aria-expanded", "true");
});
navClose.addEventListener("click", () => {
  nav.classList.remove("is-open");
  navOpen.setAttribute("aria-expanded", "false");
});
nav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    navOpen.setAttribute("aria-expanded", "false");
  });
});

/* ---------- 스크롤 리빌 애니메이션 ---------- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

/* ---------- 역할별 탭 ---------- */
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = {
  student: document.getElementById("panel-student"),
  teacher: document.getElementById("panel-teacher"),
};

function activateTab(name) {
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === name;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });
  Object.entries(tabPanels).forEach(([key, panel]) => {
    panel.hidden = key !== name;
    panel.classList.toggle("is-active", key === name);
  });
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

/* 히어로·마무리의 역할 버튼: 해당 탭을 열고 이동 */
document.querySelectorAll("[data-role]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    const role = btn.dataset.role;
    if (role === "student" || role === "teacher") {
      activateTab(role);
    }
  });
});

/* ---------- 균형 슬라이더 ---------- */
const slider = document.getElementById("balanceSlider");
const scaleFill = document.getElementById("scaleFill");
const scaleArrow = document.getElementById("scaleArrow");
const balanceTitle = document.getElementById("balanceTitle");
const balanceDesc = document.getElementById("balanceDesc");
const balanceFace = document.querySelector(".balance-face");

const balanceStages = [
  { min: 0, max: 24, face: "🧑‍🏫", title: "교사가 이끄는 배움", desc: "새로운 개념을 처음 만나는 순간에는 교사의 명확한 안내가 학습의 든든한 발판이 됩니다. 학생은 집중하며 안내를 따라가고, 이해의 기초를 쌓습니다." },
  { min: 25, max: 49, face: "🤝", title: "함께 설계하는 배움", desc: "교사가 방향을 제시하고 학생이 선택과 실행을 맡습니다. 질문이 오가는 대화형 수업이 좋은 예입니다." },
  { min: 50, max: 74, face: "🌟", title: "학생이 주도하는 배움", desc: "학생이 목표와 방법을 정하고 교사는 비계와 피드백을 제공합니다. 탐구·프로젝트 학습이 대표적입니다." },
  { min: 75, max: 100, face: "🚀", title: "학생의 주도권 확장", desc: "학생이 스스로 과제를 설계하고 교사는 조력자로 곁에 있습니다. 실패도 성장도 학생의 것이 되며, 교사는 안전망 역할을 합니다." },
];

function updateBalance() {
  const value = Number(slider.value);
  const stage = balanceStages.find((s) => value >= s.min && value <= s.max);
  if (!stage) return;

  scaleFill.style.width = value + "%";
  scaleArrow.style.left = `calc(${value}% - 6px)`;
  balanceFace.textContent = stage.face;
  balanceTitle.textContent = stage.title;
  balanceDesc.textContent = stage.desc;
}
slider.addEventListener("input", updateBalance);
updateBalance();

/* ---------- 주도성 자가진단 퀴즈 ---------- */
const QUESTIONS = [
  { text: "나는 배울 내용에 대해 스스로 질문을 던진다." },
  { text: "나는 스스로 학습 목표를 세우고 계획을 세운다." },
  { text: "어려운 과제를 만나면 포기하기보다 방법을 바꿔 다시 시도한다." },
  { text: "나는 배움의 과정을 돌아보며 스스로를 점검한다." },
  { text: "모르는 것을 질문하고, 도움을 요청하는 것을 어색해하지 않는다." },
  { text: "무엇을 어떻게 배울지 선택할 기회가 있을 때 적극적으로 참여한다." },
  { text: "실패한 경험에서 배운 점을 다음 시도에 활용한다." },
  { text: "나는 내가 배우는 것에 주인의식과 책임감을 느낀다." },
];

const OPTIONS = [
  { label: "전혀 그렇지 않다", score: 1 },
  { label: "그렇지 않다", score: 2 },
  { label: "보통이다", score: 3 },
  { label: "그렇다", score: 4 },
  { label: "매우 그렇다", score: 5 },
];

const quizBody = document.getElementById("quizBody");
const quizPrev = document.getElementById("quizPrev");
const quizNext = document.getElementById("quizNext");
const quizSubmit = document.getElementById("quizSubmit");
const quizProgress = document.getElementById("quizProgress");
const quizResult = document.getElementById("quizResult");

const answers = Array(QUESTIONS.length).fill(null);
let currentQuestion = 0;

function renderQuestion(index) {
  const q = QUESTIONS[index];
  quizBody.innerHTML = `
    <div class="quiz-question">
      <h3><span class="quiz-qnum">Q${index + 1}.</span> ${q.text}</h3>
      <div class="options">
        ${OPTIONS.map(
          (opt, i) => `
          <label class="option ${answers[index] === i ? "is-selected" : ""}">
            <input type="radio" name="q${index}" value="${i}" ${answers[index] === i ? "checked" : ""} />
            <span>${opt.label}</span>
          </label>`
        ).join("")}
      </div>
    </div>
  `;

  quizBody.querySelectorAll('input[name="q' + index + '"]').forEach((input) => {
    input.addEventListener("change", () => {
      answers[index] = Number(input.value);
      quizBody.querySelectorAll(".option").forEach((opt, i) => {
        opt.classList.toggle("is-selected", i === Number(input.value));
      });
      updateNav();
    });
  });

  quizProgress.textContent = `${index + 1} / ${QUESTIONS.length}`;
  quizPrev.hidden = index === 0;
  quizNext.hidden = index === QUESTIONS.length - 1;
  quizSubmit.hidden = index !== QUESTIONS.length - 1;
  updateNav();
}

function updateNav() {
  const currentAnswered = answers[currentQuestion] !== null;
  if (currentQuestion === QUESTIONS.length - 1) {
    quizSubmit.disabled = answers.some((a) => a === null);
  }
  if (currentQuestion < QUESTIONS.length - 1) {
    quizNext.disabled = !currentAnswered;
  }
}

quizNext.addEventListener("click", () => {
  if (answers[currentQuestion] !== null && currentQuestion < QUESTIONS.length - 1) {
    currentQuestion += 1;
    renderQuestion(currentQuestion);
  }
});

quizPrev.addEventListener("click", () => {
  if (currentQuestion > 0) {
    currentQuestion -= 1;
    renderQuestion(currentQuestion);
  }
});

quizSubmit.addEventListener("click", showResult);

function showResult() {
  const total = answers.reduce((sum, a) => sum + OPTIONS[a].score, 0);
  const max = QUESTIONS.length * 5; // 40

  let face, level, desc, tips;
  if (total >= 30) {
    face = "🌳";
    level = "주도성의 선순환 단계";
    desc = `높은 점수(${total}/${max})입니다. 당신은 자신의 배움에 주체적으로 참여하고 있습니다. 이제 이 힘을 나누는 일이 다음 성장입니다.`;
    tips = [
      "배우고 싶은 것을 더 깊이 탐구할 기회를 스스로 찾아보세요.",
      "친구나 동료에게 배움을 나누는 순간을 만들어 보세요. 가르치는 것이 가장 깊은 배움입니다.",
      "더 큰 목표를 세우고, 그 과정을 기록으로 남겨보세요.",
    ];
  } else if (total >= 20) {
    face = "🌱";
    level = "성장 단계 — 싹이 트는 중";
    desc = `좋은 출발입니다(${total}/${max}). 주도성의 씨앗이 싹트고 있습니다. 작은 실천이 반복되면 뿌리가 깊어집니다.`;
    tips = [
      "하루에 하나씩, 스스로 정한 질문이나 목표를 적어보세요.",
      "선택할 기회가 있을 때 조금 더 적극적으로 나서보세요.",
      "하루를 마치며 ‘오늘 내가 주도한 것’을 한 가지씩 찾아보세요.",
    ];
  } else {
    face = "🌰";
    level = "시작 단계 — 씨앗의 시간";
    desc = `지금이 바로 시작의 순간입니다(${total}/${max}). 주도성은 타고나는 것이 아니라 연습으로 자라는 힘입니다.`;
    tips = [
      "아주 작은 선택부터 시작하세요. ‘오늘은 무엇을 먼저 할지’ 정하는 것만으로 충분합니다.",
      "모르는 것을 질문하는 연습을 해보세요. 질문은 주도성의 첫 문입니다.",
      "실패를 두려워하지 마세요. 시도 자체가 이미 주도적인 행동입니다.",
    ];
  }

  quizResult.innerHTML = `
    <div class="quiz-result-card">
      <span class="quiz-result-face">${face}</span>
      <h3>${level}</h3>
      <p>${desc}</p>
      <div class="result-tips">
        <h4>다음 걸음을 위한 제안</h4>
        <ul>${tips.map((t) => `<li>${t}</li>`).join("")}</ul>
      </div>
      <button class="btn btn-ghost" type="button" id="quizRetry">다시 진단하기</button>
    </div>
  `;
  quizResult.hidden = false;
  quizBody.hidden = true;
  quizPrev.hidden = true;
  quizNext.hidden = true;
  quizSubmit.hidden = true;
  quizProgress.textContent = "";
  quizResult.scrollIntoView({ behavior: "smooth", block: "center" });

  document.getElementById("quizRetry").addEventListener("click", resetQuiz);
}

function resetQuiz() {
  answers.fill(null);
  currentQuestion = 0;
  quizResult.hidden = true;
  quizResult.innerHTML = "";
  quizBody.hidden = false;
  renderQuestion(0);
}

/* 초기 렌더 */
renderQuestion(0);

import { config } from "./config.js";
import { marked } from "./vendor/marked.esm.js";
import DOMPurify from "./vendor/purify.es.mjs";
import { Office, normalizeState } from "./office.js";
const $ = (selector) => document.querySelector(selector);
const stateLabels = {
  offline: "퇴근",
  idle: "대기",
  coding: "코딩 중",
  designing: "디자인 중",
  writing: "작성 중",
  reviewing: "리뷰 중",
  meeting: "회의 중",
  blocked: "도움 필요",
};
const approvalLabels = {
  pending: "결재 대기",
  approved: "승인",
  rejected: "반려",
};
const storageKey = "dot-office:read:v1";
let read;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
  read = new Set(Array.isArray(saved) ? saved : []);
} catch {
  read = new Set();
}
let feed = null,
  filter = "all",
  known = new Set(),
  initialized = false,
  demoSequence = 0;
const demos = [];
const office = new Office($("#office"));
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function externalLink(text, url) {
  const a = node("a", text);
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "github.com" ||
      !parsed.pathname.startsWith(`/${config.repository}/`)
    )
      return node("span", text);
    a.href = parsed.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  } catch {
    return node("span", text);
  }
  return a;
}
function date(value) {
  const d = new Date(value);
  return Number.isNaN(d.valueOf())
    ? "날짜 미상"
    : d.toLocaleDateString("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Seoul",
      });
}
function allReports() {
  return [...demos, ...(feed?.reports || [])];
}
function unreadCount() {
  const n = allReports().filter((r) => !read.has(String(r.id))).length;
  $("#unread").textContent = n;
  $("#scene-count").textContent = n;
}
function renderReports() {
  const list = $("#reports");
  list.replaceChildren();
  const author = $("#author").value;
  const reports = allReports().filter(
    (r) =>
      (filter === "all" || r.approval?.status === filter) &&
      (author === "all" || r.author === author),
  );
  $("#report-count").textContent = `서류 ${reports.length}건`;
  for (const r of reports) {
    const b = node("button", undefined, "report");
    const meta = node("div", undefined, "meta");
    meta.append(
      node("span", `${r.author === "gpt" ? "GPT" : "Claude"} · ${r.kind}`),
      node(
        "span",
        approvalLabels[r.approval?.status] || "결재 대기",
        `status ${r.approval?.status || "pending"}`,
      ),
    );
    const title = node("strong", r.title);
    if (!read.has(String(r.id))) title.prepend(node("span", "", "unread-dot"));
    const bottom = node("div", undefined, "meta");
    bottom.append(
      node("span", `${date(r.created_at)} · 업무 #${r.task}`),
      node("span", "서류 열기 ↗"),
    );
    b.append(meta, title, bottom);
    b.addEventListener("click", () => openReport(r));
    list.append(b);
  }
  if (!reports.length)
    list.append(node("p", "조건에 맞는 서류가 없습니다.", "empty"));
  unreadCount();
}
function openReport(r) {
  read.add(String(r.id));
  try {
    localStorage.setItem(storageKey, JSON.stringify([...read].slice(-2000)));
  } catch {
    /* 메모리에서 읽음 상태 유지 */
  }
  $("#report-title").textContent = r.title;
  $("#report-meta").textContent =
    `${r.author === "gpt" ? "GPT" : "Claude"} / ${r.kind} / ${date(r.created_at)}`;
  const approval = $("#approval");
  approval.replaceChildren();
  if (["approved", "rejected"].includes(r.approval?.status))
    approval.append(
      node(
        "span",
        approvalLabels[r.approval.status],
        `stamp ${r.approval.status}`,
      ),
    );
  if (r.approval?.status === "rejected" && r.approval.reason)
    approval.append(node("p", r.approval.reason, "reason"));
  $("#report-body").innerHTML = DOMPurify.sanitize(
    marked.parse(String(r.body_md || "")),
    {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["img", "style", "iframe", "form", "input", "button"],
      FORBID_ATTR: ["style", "id", "name"],
    },
  );
  for (const a of $("#report-body").querySelectorAll("a")) {
    try {
      if (
        !["https:", "http:"].includes(new URL(a.getAttribute("href")).protocol)
      )
        a.removeAttribute("href");
    } catch {
      a.removeAttribute("href");
    }
    a.rel = "noopener noreferrer";
    a.target = "_blank";
  }
  const links = $("#report-links");
  links.replaceChildren();
  if (!String(r.id).startsWith("demo-")) {
    links.append(externalLink("GitHub에서 결재하기 ↗", r.url));
    if (Number.isSafeInteger(r.pr) && r.pr > 0)
      links.append(
        externalLink(
          "관련 PR 보기 ↗",
          `https://github.com/${config.repository}/pull/${r.pr}`,
        ),
      );
  } else
    links.append(node("span", "체험용 서류입니다. 실제로 제출되지 않습니다."));
  renderReports();
  $("#report-dialog").showModal();
}
function renderEmployees() {
  const list = $("#employees");
  list.replaceChildren();
  for (const id of ["claude", "gpt"]) {
    const p = feed.employees[id] || {
      state: "offline",
      message: "퇴근했습니다.",
    };
    const card = node("div", undefined, "employee");
    const img = node("img");
    img.src = `./assets/${id}.svg`;
    img.alt = "";
    img.className = "avatar";
    const body = node("div");
    const title = node("strong", id === "gpt" ? "GPT" : "Claude");
    title.append(node("span", stateLabels[normalizeState(p.state)], "state"));
    body.append(title, node("small", p.message));
    card.append(img, body);
    list.append(card);
  }
}
function renderTasks() {
  const list = $("#tasks");
  list.replaceChildren();
  for (const task of feed.tasks) {
    const a = externalLink("", task.url);
    a.className = `task ${task.state === "closed" ? "closed" : ""}`;
    const meta = node("div", undefined, "meta");
    meta.append(
      node("span", `#${task.number}`),
      node("span", task.state === "closed" ? "✓ 완료" : "● 진행 중"),
    );
    a.append(
      meta,
      node("strong", task.title),
      node(
        "span",
        task.assignee === "gpt"
          ? "GPT"
          : task.assignee === "claude"
            ? "Claude"
            : "미배정",
        "small-label",
      ),
    );
    list.append(a);
  }
  if (!feed.tasks.length)
    list.append(node("p", "등록된 업무가 없습니다.", "empty"));
}
function updateTime() {
  if (!feed) return;
  const mins = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(feed.generated_at)) / 60000),
  );
  $("#updated").textContent = Number.isFinite(mins)
    ? `마지막 갱신: ${mins < 1 ? "방금" : `${mins}분 전`}`
    : "갱신 시각 미상";
}
async function load() {
  try {
    const response = await fetch(`${config.feedUrl}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    const next = await response.json();
    if (
      !next.employees ||
      !Array.isArray(next.reports) ||
      !Array.isArray(next.tasks)
    )
      throw Error("잘못된 피드 형식");
    feed = next;
    office.update(feed.employees);
    for (const report of feed.reports) {
      const id = String(report.id);
      if (initialized && !known.has(id) && !read.has(id))
        office.deliver(report);
      known.add(id);
    }
    initialized = true;
    renderEmployees();
    renderReports();
    renderTasks();
    updateTime();
    $("#demo").disabled = false;
    $("#notice").textContent = "샘플 데이터로 둘러보는 시안입니다.";
  } catch (error) {
    $("#notice").textContent =
      `데이터를 불러오지 못했습니다. 60초 후 다시 시도합니다. (${error.message})`;
    if (!feed)
      $("#reports").replaceChildren(
        node("p", "서류를 불러올 수 없습니다.", "empty"),
      );
  }
}
for (const el of document.querySelectorAll("[data-company]"))
  el.textContent = config.companyName;
document.title = config.companyName;
for (const button of document.querySelectorAll("[data-filter]"))
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    for (const sibling of document.querySelectorAll("[data-filter]"))
      sibling.setAttribute("aria-pressed", String(sibling === button));
    renderReports();
  });
$("#author").addEventListener("change", renderReports);
$("#close-dialog").addEventListener("click", () => $("#report-dialog").close());
$("#scene-inbox").addEventListener("click", () => {
  $("#inbox").scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
  $("#inbox [data-filter]").focus({ preventScroll: true });
});
$("#demo").addEventListener("click", () => {
  const n = ++demoSequence;
  const r = {
    id: `demo-${Date.now()}-${n}`,
    author: n % 2 ? "gpt" : "claude",
    kind: "작업보고",
    title: `[체험] 새로운 아이디어가 도착했어요 ${n}`,
    task: 5,
    body_md:
      "## 오늘의 작은 진전\n- 사무실에서 서류함까지 배달을 마쳤습니다.\n- 이 서류는 새로고침하면 사라집니다.\n\n**다음 이야기도 함께 만들어 주세요.**",
    created_at: new Date().toISOString(),
    approval: { status: "pending" },
  };
  demos.unshift(r);
  office.deliver(r);
  renderReports();
  $("#demo").disabled = true;
  $("#notice").textContent = "서류를 들고 결재함으로 이동하고 있습니다…";
});
$("#office").addEventListener("delivered", () => {
  $("#demo").disabled = false;
  $("#notice").textContent = "새 서류가 도착했습니다. 결재함에서 읽어 보세요.";
});
load();
setInterval(load, config.pollInterval);
setInterval(updateTime, 30_000);

import { renderDecisions, syncDecisions } from "./decision-ui.js";
import { employeePortrait } from "./office-art.js";
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
  feedback: "피드백 있음",
  answered: "반영 완료",
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
let selectedEmployee = null;
let selectedReport = null;
const approvals = new Map();
function reportStatus(report) {
  return report.status || report.approval?.status || "pending";
}
function reaction(report) {
  if (!report.status)
    return { key: report.approval?.status, status: report.approval?.status };
  const entry = [...(report.feedback || [])]
    .reverse()
    .find((f) => ["approve", "reject"].includes(f.type));
  return {
    key: entry ? JSON.stringify([entry.type, entry.at, entry.url]) : null,
    status:
      entry?.type === "approve"
        ? "approved"
        : entry?.type === "reject"
          ? "rejected"
          : null,
  };
}
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
  $("#pending-count").textContent = allReports().filter(
    (r) => reportStatus(r) === "pending",
  ).length;
}
function renderReports() {
  const list = $("#reports");
  list.replaceChildren();
  const author = $("#author").value;
  const reports = allReports().filter(
    (r) =>
      (filter === "all" || reportStatus(r) === filter) &&
      (author === "all" || r.author === author),
  );
  $("#report-count").textContent = `서류 ${reports.length}건`;
  for (const r of reports) {
    const b = node("button", undefined, "report");
    b.dataset.reportId = String(r.id);
    const meta = node("div", undefined, "meta");
    meta.append(
      node(
        "span",
        `${r.doc || "옛 양식"} · ${r.branch || r.kind} · ${r.author === "gpt" ? "GPT" : "Claude"}`,
      ),
      node(
        "span",
        approvalLabels[reportStatus(r)] || "결재 대기",
        `status ${reportStatus(r) || "pending"}`,
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
function openReport(r, refresh = false) {
  selectedReport = String(r.id);
  read.add(String(r.id));
  try {
    localStorage.setItem(storageKey, JSON.stringify([...read].slice(-2000)));
  } catch {
    /* 메모리에서 읽음 상태 유지 */
  }
  $("#report-title").textContent = r.title;
  $("#report-meta").textContent =
    `${r.doc || "번호 없는 옛 서류"} · ${r.branch || r.kind} / ${r.author === "gpt" ? "GPT" : "Claude"} / ${date(r.created_at)}`;
  const approval = $("#approval");
  approval.replaceChildren();
  if (
    ["pending", "approved", "rejected", "feedback", "answered"].includes(
      reportStatus(r),
    )
  )
    approval.append(
      node("span", approvalLabels[reportStatus(r)], `stamp ${reportStatus(r)}`),
    );
  if (!r.status && r.approval?.status === "rejected" && r.approval.reason)
    approval.append(node("p", r.approval.reason, "reason"));
  markdown($("#report-body"), r.body_md);
  const relations = $("#report-relations");
  relations.replaceChildren();
  if (r.answered_by) relations.append(docLink(r.answered_by, "최신 답변"));
  for (const doc of r.answers || [])
    relations.append(docLink(doc, "반영한 서류"));
  relations.hidden = !relations.childElementCount;
  const history = $("#report-history");
  history.replaceChildren();
  for (const entry of r.feedback || []) {
    const item = node(
      "li",
      undefined,
      `history-entry ${entry.closed ? "closed" : "open"}`,
    );
    const label =
      { feedback: "피드백", approve: "승인", reject: "반려" }[entry.type] ||
      "기록";
    item.append(
      node(
        "strong",
        `${label} · ${date(entry.at)} · ${entry.closed ? "처리 완료" : "미처리"}`,
      ),
    );
    const content = node("div", undefined, "history-body");
    markdown(
      content,
      entry.body_md || (entry.type === "reject" ? "사유 없음" : ""),
    );
    item.append(content);
    if (entry.resolved_by) item.append(docLink(entry.resolved_by, "반영 서류"));
    item.append(externalLink("원문 ↗", entry.url));
    history.append(item);
  }
  if (!history.childElementCount)
    history.append(
      node("li", "아직 피드백·결재 기록이 없습니다.", "small-label"),
    );
  renderDecisions(r, feed?.reports || [], feed?.version === 2);
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
  if (!refresh) {
    renderReports();
    $("#report-dialog").showModal();
  }
}
function markdown(container, value) {
  container.innerHTML = DOMPurify.sanitize(marked.parse(String(value || "")), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      "img",
      "style",
      "iframe",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "meta",
      "link",
      "base",
    ],
    FORBID_ATTR: ["style", "id", "name"],
  });
  for (const a of container.querySelectorAll("a")) {
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
}
function docLink(doc, label) {
  const target = feed?.reports.find((r) => r.doc === doc);
  if (!target)
    return node("span", `${label} ${doc} (현재 피드에 없음)`, "small-label");
  const button = node("button", `${label} ${doc} ↗`, "document-link");
  button.addEventListener("click", () => openReport(target));
  return button;
}
function renderEmployees() {
  const list = $("#staff-shortcuts");
  // 피드 갱신 중에도 키보드 포커스가 유지되도록 버튼을 재사용한다.
  for (const id of ["claude", "gpt"]) {
    const p = feed.employees[id] || {
      state: "offline",
      message: "퇴근했습니다.",
    };
    let button = list.querySelector(`[data-employee="${id}"]`);
    if (!button) {
      button = node("button", undefined, "staff-button");
      button.dataset.employee = id;
      button.setAttribute(
        "aria-label",
        `${id === "gpt" ? "GPT" : "Claude"} 사원 상태 열기`,
      );
      const img = node("img");
      img.src = employeePortrait(id);
      img.alt = "";
      const info = node("span");
      info.append(node("span", id === "gpt" ? "GPT" : "Claude"), node("small"));
      button.append(img, info);
      button.addEventListener("click", () => openEmployee(id));
      list.append(button);
    }
    button.querySelector("small").textContent =
      `${stateLabels[normalizeState(p.state)]} · 피드백 ${p.open_feedback || 0}`;
  }
  if (selectedEmployee && $("#employee-dialog").open)
    renderEmployeeDetail(selectedEmployee);
}
function renderEmployeeDetail(id) {
  const p = feed?.employees[id] || {
    state: "offline",
    message: "사원 정보가 없습니다.",
  };
  const name = id === "gpt" ? "GPT" : "Claude";
  $("#employee-title").textContent = `${name} · 사원 상태`;
  const portrait = node("div", undefined, "employee-portrait");
  const img = node("img");
  img.src = employeePortrait(id);
  img.alt = "";
  portrait.append(img);
  const summary = node("div", undefined, "employee-summary");
  summary.append(
    node("div", name),
    node("span", stateLabels[normalizeState(p.state)], "state"),
  );
  const task =
    Number.isSafeInteger(p.task) && p.task > 0
      ? externalLink(
          `담당 업무 #${p.task} ↗`,
          `https://github.com/${config.repository}/issues/${p.task}`,
        )
      : node("span", "배정된 업무 없음");
  task.className = "employee-task";
  $("#employee-detail").replaceChildren(
    portrait,
    summary,
    node("p", p.message || "상태 메시지 없음", "employee-message"),
    task,
    node("p", `미처리 피드백 ${p.open_feedback || 0}건`, "feedback-count"),
  );
}
function openEmployee(id) {
  selectedEmployee = id;
  renderEmployeeDetail(id);
  $("#employee-dialog").showModal();
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
  $("#task-count").textContent = feed.tasks.filter(
    (task) => task.state === "open",
  ).length;
  $("#working-count").textContent = ["claude", "gpt"].filter(
    (id) =>
      feed.employees[id] &&
      normalizeState(feed.employees[id].state) !== "offline",
  ).length;
  if (!feed.tasks.length)
    list.append(node("p", "등록된 업무가 없습니다.", "empty"));
}
function updateTime() {
  $("#clock").textContent =
    new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " KST";
  $("#clock").dateTime = new Date().toISOString();
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
    $('[data-filter="rejected"]').hidden = feed.version === 2;
    if (feed.version === 2 && filter === "rejected") {
      filter = "all";
      for (const button of document.querySelectorAll("[data-filter]"))
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.filter === "all"),
        );
    }
    office.update(feed.employees);
    for (const report of feed.reports) {
      const id = String(report.id);
      if (initialized && !known.has(id) && !read.has(id))
        office.deliver(report);
      const current = reaction(report);
      if (approvals.has(id) && approvals.get(id) !== current.key && current.key)
        office.react(report.author, current.status);
      approvals.set(id, current.key);
      known.add(id);
    }
    initialized = true;
    renderEmployees();
    renderReports();
    renderTasks();
    syncDecisions(feed.reports);
    if ($("#report-dialog").open) {
      const selected = allReports().find(
        (r) => String(r.id) === selectedReport,
      );
      if (selected) openReport(selected, true);
      else $("#report-dialog").close();
    }
    updateTime();
    $("#demo").disabled = false;
    const live = feed.version === 2;
    $(".version").textContent = live
      ? "OFFICE · 업무 현황"
      : "OFFICE · 샘플 모드";
    $("#notice").textContent =
      `${live ? "업무 현황" : "샘플 모드"} · 물건이나 사원을 선택하세요.`;
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
for (const link of document.querySelectorAll("[data-repo-link]")) {
  link.href = `https://github.com/${config.repository}${link.dataset.repoLink}`;
}
for (const button of document.querySelectorAll("[data-open]")) {
  button.addEventListener("click", () =>
    document.getElementById(button.dataset.open).showModal(),
  );
}
for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", () => button.closest("dialog").close());
}
$("#report-dialog").addEventListener("close", () => {
  if (!$("#inbox-dialog").open) return;
  const button = [...document.querySelectorAll(".report")].find(
    (el) => el.dataset.reportId === selectedReport,
  );
  (button || $("#inbox-dialog [data-close]")).focus();
});
$("#office").addEventListener("employee-select", (event) =>
  openEmployee(event.detail),
);
for (const button of document.querySelectorAll("[data-filter]"))
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    for (const sibling of document.querySelectorAll("[data-filter]"))
      sibling.setAttribute("aria-pressed", String(sibling === button));
    renderReports();
  });
$("#author").addEventListener("change", renderReports);
$("#demo").addEventListener("click", () => {
  const n = ++demoSequence;
  const r = {
    id: `demo-${Date.now()}-${n}`,
    author: n % 2 ? "gpt" : "claude",
    kind: "작업보고",
    title: `[테스트] 서류 배달 보고 ${n}`,
    task: 5,
    body_md:
      "## 배달 결과\n- 사무실에서 서류함까지 배달을 마쳤습니다.\n- 이 테스트 서류는 새로고침하면 사라집니다.",
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
updateTime();
load();
setInterval(load, config.pollInterval);
setInterval(updateTime, 30_000);

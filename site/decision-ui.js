import {
  tokenStore,
  registerToken,
  decisionComment,
  postDecision,
} from "./office-approve.js";
import { config } from "./config.js";
const $ = (s) => document.querySelector(s);
const owner = config.repository.split("/")[0];
const pending = new Map();
let context = null;
let kind = null;
let signature = "";

function keyStatus() {
  $("#key-status").textContent = tokenStore.get()
    ? `등록됨 · ${owner}`
    : "미등록";
}
function openKey() {
  $("#key-message").textContent = "";
  $("#key-dialog").showModal();
  $("#key-input").focus();
}
$("#open-key").addEventListener("click", openKey);
$("#key-dialog").addEventListener("close", () => {
  $("#key-input").value = "";
});
$("#key-register").addEventListener("click", async () => {
  const raw = $("#key-input").value;
  $("#key-input").value = "";
  $("#key-register").disabled = true;
  $("#key-clear").disabled = true;
  try {
    await registerToken(raw, owner);
    $("#key-message").textContent =
      "등록했습니다. 서류 창에서 결재할 수 있습니다.";
  } catch (error) {
    $("#key-message").textContent = error.message;
  } finally {
    $("#key-register").disabled = false;
    $("#key-clear").disabled = false;
    keyStatus();
  }
});
$("#key-clear").addEventListener("click", () => {
  tokenStore.clear();
  $("#key-input").value = "";
  $("#key-message").textContent = "이 브라우저의 열쇠를 지웠습니다.";
  keyStatus();
});
keyStatus();

function preview() {
  try {
    $("#decision-preview").textContent = decisionComment(
      kind,
      context.report,
      $("#decision-text").value,
      context,
    );
  } catch (error) {
    $("#decision-preview").textContent = error.message;
  }
}
$("#decision-text").addEventListener("input", preview);
$("#decision-cancel").addEventListener("click", () => {
  kind = null;
  $("#decision-editor").hidden = true;
});
for (const button of document.querySelectorAll("[data-decision]")) {
  button.addEventListener("click", () => {
    if (!tokenStore.get()) {
      openKey();
      return;
    }
    kind = button.dataset.decision;
    if (kind === "approve") {
      submit();
      return;
    }
    $("#decision-editor").hidden = false;
    $("#decision-text").value = "";
    $("#decision-label").textContent =
      kind === "feedback" ? "피드백 내용 (필수)" : "반려 사유 (선택)";
    $("#decision-submit").textContent =
      kind === "feedback" ? "피드백 보내기" : "반려 보내기";
    $("#decision-message").textContent = "";
    preview();
    $("#decision-text").focus();
  });
}
$("#decision-submit").addEventListener("click", submit);
async function submit() {
  if (!context || pending.has(String(context.report.id))) return;
  if (!tokenStore.get()) {
    openKey();
    return;
  }
  const current = context;
  const id = String(current.report.id);
  const selectedKind = kind;
  const text = $("#decision-text").value;
  try {
    decisionComment(selectedKind, current.report, text, current);
  } catch (error) {
    $("#decision-message").textContent = error.message;
    return;
  }
  const transaction = {
    count: current.report.feedback?.length || 0,
    sending: true,
  };
  pending.set(id, transaction);
  updateLocks();
  try {
    await postDecision({
      repo: config.repository,
      ...current,
      kind: selectedKind,
      text,
    });
    transaction.sending = false;
    if (context === current) {
      $("#decision-editor").hidden = true;
      $("#decision-text").value = "";
    }
  } catch (error) {
    pending.delete(id);
    if (context === current) $("#decision-message").textContent = error.message;
  } finally {
    updateLocks();
  }
}
function updateLocks() {
  const state = context && pending.get(String(context.report.id));
  for (const button of document.querySelectorAll("#decision-controls button"))
    button.disabled = Boolean(state);
  $("#decision-text").disabled = Boolean(state);
  $("#decision-pending").textContent = state
    ? state.sending
      ? "결재 제출 중…"
      : "결재 반영 중 (1~2분)"
    : "";
}
export function syncDecisions(reports) {
  for (const report of reports) {
    const id = String(report.id),
      state = pending.get(id);
    if (state && !state.sending && (report.feedback?.length || 0) > state.count)
      pending.delete(id);
  }
  updateLocks();
}
export function renderDecisions(report, reports, live) {
  const latest = reports
    .filter((r) => r.task === report.task)
    .sort(
      (a, b) =>
        Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id,
    )[0];
  const latestInIssue = latest?.id === report.id;
  const nextSignature = JSON.stringify([
    report.id,
    report.status,
    latestInIssue,
    live,
  ]);
  // 동일 서류의 주기 갱신은 작성 중인 내용을 지우지 않는다.
  if (signature !== nextSignature) {
    signature = nextSignature;
    context = { report, latestInIssue };
    kind = null;
    $("#decision-editor").hidden = true;
    $("#decision-text").value = "";
    $("#decision-message").textContent = "";
  } else context.report = report;
  const valid =
    Number.isSafeInteger(report.task) &&
    report.task > 0 &&
    (report.doc == null ||
      new RegExp(`^${report.task}-[1-9]\\d*$`).test(report.doc));
  const eligible =
    live &&
    valid &&
    !String(report.id).startsWith("demo-") &&
    (report.doc != null || latestInIssue);
  $("#decision-controls").hidden = !eligible;
  $("#decision-help").textContent =
    !live || String(report.id).startsWith("demo-")
      ? "샘플·체험 서류는 실제로 결재할 수 없습니다."
      : !eligible
        ? "옛 양식 서류는 GitHub에서 결재해 주세요."
        : "결재는 이 서류의 업무 Issue에 사장님 댓글로 기록됩니다.";
  for (const button of document.querySelectorAll("[data-decision]")) {
    button.hidden =
      report.doc == null
        ? button.dataset.decision === "feedback"
        : report.status === "approved" &&
          button.dataset.decision !== "feedback";
  }
  updateLocks();
}

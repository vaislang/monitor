import "./styles.css";

type TaskState = "Todo" | "Doing" | "Done";

type TaskSummary = {
  id: number;
  title: string;
  score: number;
  state: TaskState;
};

const summaries: TaskSummary[] = [
  { id: 1, title: "Verify enum layout", score: 21, state: "Doing" },
  { id: 2, title: "Document runtime boundary", score: 16, state: "Done" },
];

const stateLabel: Record<TaskState, string> = {
  Todo: "Todo",
  Doing: "Doing",
  Done: "Done",
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("missing #app root");
}

app.innerHTML = `
  <section class="shell" aria-labelledby="page-title">
    <header class="topbar">
      <div>
        <p class="eyebrow">Vais reference app</p>
        <h1 id="page-title">Monitor</h1>
      </div>
      <span class="gate">IR-only server gate</span>
    </header>

    <section class="summary-grid" aria-label="Reference slice status">
      <article>
        <span>Language surface</span>
        <strong>fn / struct / enum / Option / Result / match</strong>
      </article>
      <article>
        <span>Runtime boundary</span>
        <strong>No db/server/ws symbols linked</strong>
      </article>
      <article>
        <span>Next gate</span>
        <strong>HTTP adapter after runtime promotion</strong>
      </article>
    </section>

    <section class="task-list" aria-label="Seed monitor tasks">
      ${summaries
        .map(
          (task) => `
            <article class="task">
              <div>
                <span class="task-id">#${task.id}</span>
                <h2>${task.title}</h2>
              </div>
              <div class="task-meta">
                <span class="state state-${task.state.toLowerCase()}">${stateLabel[task.state]}</span>
                <strong>${task.score}</strong>
              </div>
            </article>
          `,
        )
        .join("")}
    </section>
  </section>
`;

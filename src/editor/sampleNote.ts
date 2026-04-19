const variableField = (
  id: string,
  label: string,
  displayValue: string,
  state: "set" | "placeholder" | "unset",
) =>
  `<span data-type="variableField" data-variable-id="${id}" data-variable-label="${label}" data-display-value="${displayValue}" data-variable-state="${state}" data-unset="${
    state === "unset" ? "true" : "false"
  }">${displayValue}</span>`;

export const sampleNoteHtml = `
  <h1>
    ${variableField("project-name", "Project Name", "Program Alpha", "set")}:
    End-to-End Working Notes
  </h1>
  <p>
    Hello ${
  variableField("client-name", "Client Name", "Your name", "placeholder")
},
    this is an intentionally exhaustive seed note to validate editing behavior,
    rich blocks, task workflows, and design-token consistency under long-form content.
  </p>
  <p>
    Primary goals today: align scope with ${
  variableField("account-manager", "Account Manager", "Jordan Lee", "set")
},
    confirm dependencies in ${
  variableField("region", "Region", "North America", "set")
},
    lock rollout timeline, and capture operational playbooks in one place.
  </p>

  <div data-callout="info">
    <p>
      Team reminder: keep this note as the source of truth. If a decision changes,
      update it here first and then fan out to downstream docs.
      Use ${
  variableField("support-email", "Support Email", "help@acme.test", "set")
} for rapid escalation.
    </p>
  </div>

  <h2>Variable Template Preview</h2>
  <table>
    <tbody>
      <tr>
        <th>Field</th>
        <th>Value In Doc</th>
        <th>State</th>
      </tr>
      <tr>
        <td>Client Name</td>
        <td>${
  variableField("client-name", "Client Name", "Your name", "placeholder")
}</td>
        <td>placeholder</td>
      </tr>
      <tr>
        <td>Language</td>
        <td>${variableField("language", "Language", "English", "set")}</td>
        <td>set</td>
      </tr>
      <tr>
        <td>Budget Owner</td>
        <td>${
  variableField("budget-owner", "Budget Owner", "Budget Owner", "unset")
}</td>
        <td>unset</td>
      </tr>
      <tr>
        <td>Kickoff Date</td>
        <td>${
  variableField("kickoff-date", "Kickoff Date", "YYYY-MM-DD", "placeholder")
}</td>
        <td>placeholder</td>
      </tr>
      <tr>
        <td>Reference ID</td>
        <td>${
  variableField("reference-id", "Reference ID", "Reference ID", "unset")
}</td>
        <td>unset</td>
      </tr>
      <tr>
        <td>Proposal Version</td>
        <td>${
  variableField("proposal-version", "Proposal Version", "v3.2", "set")
}</td>
        <td>set</td>
      </tr>
    </tbody>
  </table>

  <h2>Milestone Snapshot</h2>
  <table>
    <tbody>
      <tr>
        <th>Milestone</th>
        <th>Owner</th>
        <th>Status</th>
        <th>Window</th>
      </tr>
      <tr>
        <td>Design System Stabilization</td>
        <td>${
  variableField("account-manager", "Account Manager", "Jordan Lee", "set")
}</td>
        <td>In progress</td>
        <td>Apr 15 - Apr 29</td>
      </tr>
      <tr>
        <td>Editor Workflow Hardening</td>
        <td>Notes Team (${
  variableField("region", "Region", "North America", "set")
})</td>
        <td>In progress</td>
        <td>Apr 17 - May 03</td>
      </tr>
      <tr>
        <td>Pilot Rollout</td>
        <td>Product Ops</td>
        <td>Todo</td>
        <td>${
  variableField("kickoff-date", "Kickoff Date", "YYYY-MM-DD", "placeholder")
} - May 17</td>
      </tr>
      <tr>
        <td>Post-Launch Audit</td>
        <td>QA + Analytics</td>
        <td>Todo</td>
        <td>May 20 - May 24</td>
      </tr>
    </tbody>
  </table>

  <h2>Execution Checklist</h2>
  <ul data-type="taskList">
    <li data-type="taskItem" data-status="done" data-checked="true" data-due-date="2026-04-11" data-due-time="10:00">
      <p>Finalize kickoff agenda and distribution list for ${
  variableField("project-name", "Project Name", "Program Alpha", "set")
}</p>
    </li>
    <li data-type="taskItem" data-status="done" data-checked="true" data-due-date="2026-04-14" data-due-time="16:30">
      <p>Confirm accessibility baseline and keyboard interactions in ${
  variableField("language", "Language", "English", "set")
}</p>
    </li>
    <li data-type="taskItem" data-status="in_progress" data-checked="false" data-due-date="2026-04-22" data-due-time="13:00">
      <p>Refine slash command discoverability and menu ranking for ${
  variableField("client-name", "Client Name", "Your name", "placeholder")
}</p>
    </li>
    <li data-type="taskItem" data-status="in_progress" data-checked="false" data-due-date="2026-04-24" data-due-time="15:00">
      <p>Complete due-date behavior parity across wrappers and status tasks in ${
  variableField("timezone", "Timezone", "America/Toronto", "set")
}</p>
    </li>
    <li data-type="taskItem" data-status="todo" data-checked="false" data-due-date="2026-04-27" data-due-time="11:00">
      <p>Run 30-minute onboarding test with first-time editor users and track ${
  variableField("reference-id", "Reference ID", "Reference ID", "unset")
}</p>
    </li>
    <li data-type="taskItem" data-status="todo" data-checked="false" data-due-date="2026-04-29" data-due-time="09:30">
      <p>Publish release notes draft and support macros with tone ${
  variableField("tone", "Template Tone", "Professional", "set")
}</p>
    </li>
    <li data-type="taskItem" data-status="archived" data-checked="false" data-due-date="2026-03-18" data-due-time="17:00">
      <p>Legacy migration checklist from retired beta editor approved by ${
  variableField(
    "legal-approver",
    "Legal Approver",
    "Approver name",
    "placeholder",
  )
}</p>
    </li>
  </ul>

  <h2>Critical Dates</h2>
  <div data-type="dueDate" data-due-date="2026-04-25" data-due-time="14:30">
    <p><strong>Feature freeze</strong></p>
    <p>No new capabilities after freeze; bug fixes and polishing only for ${
  variableField("project-name", "Project Name", "Program Alpha", "set")
}.</p>
  </div>
  <div data-type="dueDate" data-due-date="2026-05-02" data-due-time="11:00">
    <p><strong>Cross-functional demo</strong></p>
    <p>Walk stakeholders through end-to-end authoring, review, and handoff. Primary contact: ${
  variableField("support-email", "Support Email", "help@acme.test", "set")
}.</p>
  </div>
  <div data-type="dueDate" data-due-date="2026-05-08" data-due-time="10:00">
    <p><strong>Pilot launch decision</strong></p>
    <p>Go / no-go based on QA checklist, support readiness, and next action ${
  variableField("next-step", "Next Step", "Define next action", "placeholder")
}.</p>
  </div>

  <h2>Implementation Notes</h2>
  <p>
    We need clarity on extension ownership boundaries so new node views stay composable.
    Current version ${
  variableField("proposal-version", "Proposal Version", "v3.2", "set")
}
    and budget owner ${
  variableField("budget-owner", "Budget Owner", "Budget Owner", "unset")
}:
  </p>
  <ul>
    <li>Keep user-facing controls inside node views only when they are context-specific.</li>
    <li>Route global actions through slash and toolbar commands for discoverability.</li>
    <li>Prefer semantic data attributes over structural selectors in CSS.</li>
  </ul>

  <h3>Tabbed Seed Section</h3>
  <div data-type="tabsBlock" data-active-index="0">
    <div data-type="tabsPanel" data-title="Overview">
      <p><strong>Overview</strong></p>
      <p>${
  variableField("project-name", "Project Name", "Program Alpha", "set")
} is tracking on schedule with design and editor hardening in progress.</p>
    </div>
    <div data-type="tabsPanel" data-title="Risks">
      <p><strong>Risks</strong></p>
      <ul>
        <li>Regression risk in nested node view interactions</li>
        <li>Inconsistent UX across keyboard and pointer workflows</li>
        <li>Unset review owner ${
  variableField("budget-owner", "Budget Owner", "Budget Owner", "unset")
}</li>
      </ul>
    </div>
    <div data-type="tabsPanel" data-title="Next Steps">
      <p><strong>Next Steps</strong></p>
      <ol>
        <li>Finish interaction QA for tabs + slash menus</li>
        <li>Run pilot walkthrough with ${
  variableField("client-name", "Client Name", "Your name", "placeholder")
} and two cross-functional reviewers</li>
      </ol>
    </div>
  </div>

  <h3>Seeded Nested Page</h3>
  <div data-type="nestedPage" data-page-id="seed-nested-page-field-ops">
    <h2>Field Ops Runbook</h2>
    <p>
      This seeded nested page is here for interaction testing. Click the row preview to open
      it as a full editor sheet, then edit these blocks directly.
    </p>
    <ul data-type="taskList">
      <li data-type="taskItem" data-status="in_progress" data-checked="false">
        <p>Review dispatch handoff notes with ${
  variableField("account-manager", "Account Manager", "Jordan Lee", "set")
}</p>
      </li>
      <li data-type="taskItem" data-status="todo" data-checked="false">
        <p>Confirm pilot routing in ${
  variableField("region", "Region", "North America", "set")
}</p>
      </li>
    </ul>
    <blockquote>
      Keep this page concise: first line acts as the nested-page title preview.
    </blockquote>
  </div>

  <blockquote>
    The best editor experience is one where controls feel obvious before users think about them.
    Reference ${
  variableField("reference-id", "Reference ID", "Reference ID", "unset")
}.
  </blockquote>

  <h3>Quotes to Seed</h3>
  <blockquote data-quote-footer-value="Product team retrospective">
    Clarity first, polish second, scale third.
  </blockquote>
  <blockquote data-quote-footer-value="Design systems notes" data-quote-footer-href="https://tiptap.dev/">
    If the workflow feels heavy, the feature is probably doing too much.
  </blockquote>
  <blockquote>
    Make the right path easy, and the hard path still possible in ${
  variableField("language", "Language", "English", "set")
}.
  </blockquote>

  <h3>Code Sample: Theme and Token Application</h3>
  <pre><code class="language-typescript">type Mode = "light" | "dark" | "system";
type Palette = "sage" | "ocean" | "rose";
type Accent = "coral" | "indigo" | "emerald";

function applyTheme(mode: Mode, palette: Palette, accent: Accent) {
  const root = document.documentElement;
  root.setAttribute("data-mode", mode);
  root.setAttribute("data-palette", palette);
  root.setAttribute("data-accent", accent);
}

applyTheme("system", "sage", "coral");</code></pre>

  <h3>Code Sample: Status Update Helper</h3>
  <pre><code class="language-tsx">export function updateTaskStatus(id: string, status: "todo" | "in_progress" | "done" | "archived") {
  return {
    id,
    status,
    updatedAt: new Date().toISOString(),
  };
}</code></pre>

  <h2>Risk Register</h2>
  <table>
    <tbody>
      <tr>
        <th>Risk</th>
        <th>Likelihood</th>
        <th>Impact</th>
        <th>Mitigation</th>
      </tr>
      <tr>
        <td>Node view event conflicts in nested controls</td>
        <td>Medium</td>
        <td>High</td>
        <td>Centralize stopEvent logic and add focused interaction tests</td>
      </tr>
      <tr>
        <td>Visual regressions across theme combinations</td>
        <td>High</td>
        <td>Medium</td>
        <td>Run screenshot matrix for mode/theme/font/radius permutations in ${
  variableField("timezone", "Timezone", "America/Toronto", "set")
}</td>
      </tr>
      <tr>
        <td>Unclear ownership for extension-level decisions</td>
        <td>Medium</td>
        <td>Medium</td>
        <td>Assign extension maintainers and review cadence with ${
  variableField(
    "legal-approver",
    "Legal Approver",
    "Approver name",
    "placeholder",
  )
}</td>
      </tr>
    </tbody>
  </table>

  <h2>Comms Draft</h2>
  <p>
    Hello ${
  variableField("client-name", "Client Name", "Your name", "placeholder")
},
    we are preparing the first pilot of the upgraded editor experience for
    ${variableField("project-name", "Project Name", "Program Alpha", "set")}
    (${variableField("proposal-version", "Proposal Version", "v3.2", "set")}).
  </p>
  <p>
    This includes status-based task rows, due-date context wrappers, slash command menus,
    code block tools, and table authoring support.
    Please review readiness items by EOD Thursday and flag any blocker via
    <a href="https://tiptap.dev/" target="_blank">implementation thread</a>
    or ${
  variableField("support-email", "Support Email", "help@acme.test", "set")
}.
  </p>

  <hr />

  <h2>Appendix</h2>
  <h3>QA Focus Areas</h3>
  <ul>
    <li>Keyboard navigation parity across all popups and dropdowns</li>
    <li>Date/time persistence in both wrapper and task contexts</li>
    <li>Table editing behavior on mobile viewport sizes</li>
    <li>Copy button behavior in restricted clipboard environments</li>
    <li>Escalation reference ${
  variableField("reference-id", "Reference ID", "Reference ID", "unset")
}</li>
  </ul>

  <h3>Nested Task Sample</h3>
  <ul data-type="taskList">
    <li data-type="taskItem" data-status="in_progress" data-checked="false" data-due-date="2026-04-30" data-due-time="12:00">
      <p>Prepare launch checklist package for ${
  variableField("region", "Region", "North America", "set")
}</p>
      <ul data-type="taskList">
        <li data-type="taskItem" data-status="done" data-checked="true"><p>Draft release summary in ${
  variableField("language", "Language", "English", "set")
}</p></li>
        <li data-type="taskItem" data-status="todo" data-checked="false"><p>Collect final screenshots and define ${
  variableField("next-step", "Next Step", "Define next action", "placeholder")
}</p></li>
      </ul>
    </li>
  </ul>
`;

export const emptyNoteHtml = `
  <h2>Untitled note</h2>
  <p>Start writing...</p>
`;

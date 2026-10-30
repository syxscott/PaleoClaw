import io

# --- en-cron.ts: add missing cron.* catalog keys ---
p = 'ui/src/i18n/locales/en-cron.ts'
s = io.open(p, encoding='utf-8').read()

# form subsection additions (after requiredSr)
anchor = '      requiredSr: "required",\n'
form_add = '''      required: "Required",
      basics: "Basics",
      basicsSub: "Name the automation and choose the agent that runs it.",
      newJob: "New automation",
      editJob: "Edit automation",
      createSubtitle: "Describe what paleoclaw should do, then pick when it runs.",
      updateSubtitle: "Update the schedule and payload for this automation.",
      schedule: "Schedule",
      scheduleSub: "Pick a schedule kind and set the timing.",
      execution: "Execution",
      executionSub: "Choose the session and delivery behavior for each run.",
      session: "Session",
      main: "Main session",
'''
assert s.count(anchor) == 1
s = s.replace(anchor, anchor + form_add, 1)

# jobs subsection additions (after reset)
anchor = '      reset: "Reset",\n'
jobs_add = '''      title: "Automations",
      subtitle: "Scheduled automations and their next runs",
      searchJobs: "Search",
      searchPlaceholder: "Search automations…",
      noMatching: "No automations match the current filters.",
      loading: "Loading…",
      loadMore: "Load more",
      enabled: "Enabled",
      shownOf: "Showing {shown} of {total} automations",
'''
assert s.count(anchor) == 1
s = s.replace(anchor, anchor + jobs_add, 1)

# runs subsection additions (after checks)
anchor = '      checks: "Checks",\n'
runs_add = '''      title: "Run history",
      scope: "Scope",
      allJobs: "All automations",
      selectedJob: "Selected automation",
      subtitleAll: "Run history across all automations",
      subtitleJob: "Run history for {title}",
      selectJobHint: "Select an automation to see its run history.",
'''
assert s.count(anchor) == 1
s = s.replace(anchor, anchor + runs_add, 1)

# new summary + jobList subsections (insert before form)
anchor = '    form: {\n'
new_sections = '''    summary: {
      jobs: "Automations",
      enabled: "Enabled",
      nextWake: "Next wake",
      yes: "Yes",
      no: "No",
      refresh: "Refresh",
      refreshing: "Refreshing…",
    },
    jobList: {
      allJobs: "All automations",
      selectJob: "Select an automation",
    },
    form: {
'''
assert s.count(anchor) == 1
s = s.replace(anchor, new_sections, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('en-cron.ts updated')

# --- en.ts: chat.* + common.resources ---
p = 'ui/src/i18n/locales/en.ts'
s = io.open(p, encoding='utf-8').read()

anchor = '  chat: {\n'
chat_add = '''  chat: {
    refreshTitle: "Refresh chat",
    thinkingToggle: "Toggle thinking mode",
    focusToggle: "Toggle focus mode",
    showCronSessions: "Show scheduled-run sessions",
    showCronSessionsHidden: "Show {count} scheduled-run sessions",
    hideCronSessions: "Hide scheduled-run sessions",
    disconnected: "Chat is unavailable while the gateway is disconnected.",
'''
assert s.count(anchor) == 1
s = s.replace(anchor, chat_add, 1)

anchor = '  common: {\n'
common_add = '''  common: {
    resources: "Resources",
'''
assert s.count(anchor) == 1
s = s.replace(anchor, common_add, 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('en.ts updated')

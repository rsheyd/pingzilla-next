# PingZilla Next Unexpected Exit Tracker

Use this document to track cases where PingZilla Next disappears without an intentional quit. Keep confirmed evidence separate from hypotheses.

## Quick capture checklist

When the menu-bar icon disappears:

1. Record when you first noticed it and when you last remember seeing it.
2. Do not relaunch immediately if diagnosis is more important than restoring monitoring.
3. Check whether the process is running:

   ```bash
   pgrep -afil '/Applications/PingZilla Next.app/Contents/MacOS/pingzilla'
   ```

4. Capture the lifecycle log:

   ```bash
   tail -40 "$HOME/Library/Containers/pingzilla.pixeltowers.io/Data/Library/Logs/PingZilla Next/lifecycle.log"
   ```

5. Record the history file timestamp as an estimate of last activity:

   ```bash
   stat -f '%Sm %N' -t '%Y-%m-%d %H:%M:%S %Z' "$HOME/Library/Containers/pingzilla.pixeltowers.io/Data/Library/Application Support/pingzilla/history_v2.json"
   ```

6. Check `~/Library/Logs/DiagnosticReports` and the app container's `Library/Logs/DiagnosticReports` for a PingZilla report.
7. Query macOS unified logs as soon as possible using the PID from the lifecycle log. Relevant records can expire before the incident is investigated.

## Incident summary

| Incident | Version | Last known activity | Detection | Clean exit | Crash report | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| PZ-001 | Before lifecycle logging | Before August 12, 2026 11:10 EDT | App absent; launching through Spotlight created a new process | Unknown | None found | At least the second disappearance reported by the user. Insufficient instrumentation to classify. |
| PZ-002 | 1.4.2 | August 14, 2026 21:25 EDT | August 19, 2026 | No | None found | PID 53351. Mac did not reboot until August 16. Automatic or sudden termination was the leading hypothesis. |
| PZ-003 | 1.5.0 | August 20, 2026 11:53 EDT | August 20, 2026 16:57 EDT | No | None found | PID 92646. Lifecycle log confirms the macOS automatic/sudden termination guard ran. No matching termination reason remained in the focused unified-log query. This weakens the automatic-termination hypothesis. |

## Incident details

### PZ-003 — Version 1.5.0

- Started: August 19, 2026 12:31 EDT (`2026-08-19T16:31:40Z`)
- PID: 92646
- Termination guard confirmed: August 19, 2026 12:31 EDT
- Last history save: August 20, 2026 11:53:23 EDT
- Found not running: August 20, 2026 16:57 EDT
- Explicit Quit recorded: no
- Clean Tauri exit recorded: no
- Rust panic recorded: no
- macOS crash report: none found
- Focused unified-log termination evidence: none found

Assessment: confirmed unexpected exit. Because the process-level automatic and sudden termination guard ran, this incident is more consistent with an external signal, low-level native termination without a report, or another uninstrumented exit path than with the original automatic-termination theory.

## Current instrumentation

The sandboxed lifecycle log records:

- app version, PID, and startup time
- detection that the previous run lacked a clean exit
- explicit menu-bar Quit requests
- Rust panics
- clean Tauri exits
- activation of the macOS automatic/sudden termination guard
- five-minute heartbeats containing the process PID
- catchable termination signals (`SIGTERM`, `SIGINT`, `SIGHUP`, and `SIGQUIT`)
- size-based lifecycle-log rotation at 512 KB

It cannot record `SIGKILL`, a power loss, or anything that prevents the process from executing cleanup code.

## Next diagnostic improvements

1. Preserve the process PID and launch timestamp in every incident entry before relaunching.
2. If another guarded exit occurs, capture unified logs immediately and check for memory-pressure or jetsam events involving the PID.
3. If another exit remains unexplained, consider an opt-in restart mechanism after ensuring intentional Quit will not relaunch the app.

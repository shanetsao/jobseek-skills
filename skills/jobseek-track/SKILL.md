---
name: jobseek-track
description: Review or update local job application status, deadlines, approved material versions, checkpoints, and applicant-reported or observed outcomes. Use for jobseek progress tracking, dashboard tracker sync, and the weekly refresh, not automatic submission or outreach.
---

# Jobseek Track — Status, Outcomes, and Refresh

Keep the applicant's application record truthful: every status reflects a real event, every deadline is a verified posting fact, and the dashboard tracker never drifts from the underlying record.

## Purpose in one line

Record what actually happened to each opening and application — nothing inferred, nothing merged away, nothing reminded or sent that the applicant did not ask for.

## Inspect before updating

Resolve the selected workspace and applicant before inspecting records. For each saved job and application, be able to report: employer, role, verified requisition, deadline if supported by the official posting, status, current material approval, last action, and next action. Distinguish posting dates, retrieval times, deadlines, and submission dates — they are different facts. Reconcile a manually edited `LEDGER.md` instead of overwriting it (see `skills/jobseek/references/records.md`), and preserve snapshots so work resumes through the relevant skill after inspecting current state.

## Application states

Use exactly this progression for work in flight:

**Drafting → Awaiting review → Approved → Filling ↔ Awaiting applicant action → Submitted**

- Keep Awaiting review, Approved, Filling, and Awaiting applicant action distinct; never collapse them into a generic "in progress."
- Check exact-package approval before entering Filling. Any change to the JD, dependent facts, documents, or answers can return an application to Awaiting review.
- A prepared document, completed fields, or an interrupted browser session never moves an application to Submitted (see the submission rule below).

## Outcomes — only from actual events

Record an outcome **only from an actual event or the applicant's explicit report**:

**Responded / Interview / Offer / Rejection / Withdrawal / Closure**

- Require an observed confirmation or an explicit applicant report to mark Submitted; retain the evidence and its timestamp.
- Record rejection, interview, offer, withdrawal, or closure only when supported by an event or a report. Do not infer an outcome from silence, from a posting disappearing, or from wording — and do not infer that wording in a document caused an outcome.
- A deadline passing closes a *posting* in a refresh (below); it is not, by itself, an outcome for an application already submitted.

## The single status-event record

**`recordStatusEvent` is the only way a status change is written** — whether it originates here, in chat, or on the dashboard. Every status change is one event record carrying: the application / opening identifier, the new status, the date, and its evidence (observed confirmation, applicant report, or email evidence as below). No surface edits a status field directly; surfaces that need a change call the same event mechanism, so the tracker, the dashboard, and the chat record can never disagree about how a status was reached.

## Recruiter email counts as an actual event

A recruiter or employer email in the applicant's own mailbox **counts as an actual event** for a submitted application. When such an email is found for an employer with a submitted application:

1. Record the resulting status change (for example Responded, Interview scheduled, or Rejected) through the single status-event record, with the email as its evidence: **sender, date, and subject**.
2. **Surface the email to the applicant** when recording it — do not silently change a status on the strength of an email the applicant has not been shown.
3. Link the same evidence in the tracker and in the dashboard Tracker tab so both show why the status changed.

An email about a different role, a general newsletter, or an automated posting alert is not an event for an application; when in doubt, surface it and ask rather than recording.

## Deadlines are facts, not reminders

- Tracking a deadline does **not** create a reminder, send a message, or schedule a search. Those happen only on a separate, explicit applicant request.
- Deadlines recorded here come from the verified official posting only (see `jobseek-search`); a best-consideration date is recorded as priority review, not as a hard close.

## Duplicates, reposts, and changed requisitions

- Before tailoring or applying, **check for an existing application to the same verified opening** and present its recorded outcome.
- A repost or a changed requisition is **investigated, not silently merged**: compare requisition ID, JD text, location, and dates; if it is genuinely a new opening, create a distinct record and link it to the earlier one; if it is the same opening, keep one record and note the repost. Distinct requisitions remain distinct.

## Dashboard Tracker sync

The dashboard Tracker is a view over these records, kept in step in the same pass that changes them. The dashboard stages are:

**Initiated / Applied / Responded / Interview scheduled / Offer received / Rejected / Withdrawn**

Map the internal record onto them as follows, and keep the mapping stable so a status means the same thing in both places:

| Internal state / outcome | Dashboard Tracker stage |
|---|---|
| Application created, drafting, awaiting review, approved, or filling | Initiated |
| Submitted | Applied |
| Responded | Responded |
| Interview | Interview scheduled |
| Offer | Offer received |
| Rejection or Closure of a submitted application | Rejected |
| Withdrawal | Withdrawn |

Status changes reach the dashboard only through the status-event record above — the dashboard never writes its own copy of a status (see `jobseek-dashboard` for the sync mechanics).

## Weekly refresh duties

On the weekly refresh (run when scheduled or when the applicant asks), in one pass:

1. **Re-verify postings** for every still-open tracked opening on its official careers page: still live, JD changed, dates changed, or posting gone. Update the record with the check date; a changed JD flags dependent packages for re-review.
2. **Flag deadlines within 21 days** — name each opening, its verified closing or best-consideration date (labelled as which), and its current state, so the applicant can prioritise. A flagged deadline is a report, not a reminder or a nudge to apply.
3. **Close expired postings** — postings whose verified closing date has passed, or that have disappeared from the official site, move to closed in the tracker, with the closing evidence recorded. Submitted applications to a closed posting keep their own outcome tracking.
4. **Check recruiter email** for submitted applications (above) and record any evidenced status changes, surfacing each email.
5. **Sync the dashboard alongside the tracker in the same pass** — the refresh is not complete until the dashboard Tracker and document index reflect the same records (see `jobseek-dashboard`).

Report the refresh as: postings re-verified, postings closed, 21-day deadline flags, email-evidenced status changes, and anything that could not be verified and why.

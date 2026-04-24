# Quiet escalation — without a human in the loop

Some people walk into the chair carrying things much larger than a blood pressure number. Suicidality. An abusive partner. A child in danger. An overdose last night. A neighbor-who-is-a-nurse would notice. So does this coach.

Concierge30 has no clinician on staff and no human reviewer of any kind. The promise is hard: **we never loop in any human on our side.** And yet, the coach must respond when someone tells it something hard. This doc is how we square those.

## The principle

The user is not a case file. The coach does not "alert," "report," or "escalate" anything to anyone on our side. Instead:

- The coach **stays present**. It does not pivot back to vitals. It does not hand a list of three things.
- The screen offers **public hotlines** — calm, non-alarming, dignified. The user calls, themselves, if they choose. We never see the call.
- For imminent physical danger, the coach asks **once**, calmly, for the user's explicit consent before referencing a 911 call. The user's "yes" is the only thing that moves anything.

This is the strongest interpretation of "no human in the loop" we know how to make. We don't see them. We don't observe their call. We don't have a phone number for them. We hold the space and step aside.

## Detection

`lib/coach/crisis.ts` is a deterministic phrase scanner — no LLM, no network. It runs on every user turn in the browser. It returns one of four levels:

| Level | What it means | What happens |
|---|---|---|
| `none` | Nothing flagged. | Visit proceeds normally. |
| `standby` | A subtle cue (passive ideation, "walking on eggshells"). | The coach is told to slow down and stay one step closer. No resources surfaced unless asked. |
| `acute` | A clear cue (suicidality, IPV disclosure, can't-stop-using). | The CrisisPanel appears on screen. The coach weaves one resource by name. The visit's standard pivot to vitals is suspended. The takeaway card automatically includes the resources. |
| `imminent` | Statement of immediate intent or means, abuser present, overdose just happened, child in current danger. | All of the above, plus: coach asks once, calmly, for explicit consent before referencing a 911 call. Speaks slower. Short sentences. Stays. |

Multiple `standby` cues in one conversation escalate to `acute`. Three `acute` cues across two or more categories escalate to `imminent`. See `crisis.ts` for the patterns and `crisis.test.ts` for the 28 cases that lock the behavior in.

Languages: English and Spanish are covered today. Other languages return `none` from the scanner — but the coach itself (Claude) is reading the transcript regardless and is instructed to weave in resources when it hears these things, so coverage is best-effort even where the scanner is silent.

## Resources

`lib/coach/resources.ts` carries a small, curated set of US public hotlines:

- **988** — Suicide & Crisis Lifeline (call or text 988)
- **Veterans Crisis Line** — 988 then 1, or text 838255
- **National Domestic Violence Hotline** — 1-800-799-7233, text START to 88788
- **RAINN** — 1-800-656-4673
- **SAMHSA helpline** — 1-800-662-4357
- **Trevor Project** — 1-866-488-7386
- **Childhelp** — 1-800-422-4453
- **Poison Control** — 1-800-222-1222
- **911** — when in immediate danger

`pickResources(categories, imminent)` returns at most three, ranked by category match. The coach is told to mention **one** in conversation — not all three. The on-screen panel shows up to three so the user has options.

These are **public** services. The user calls them themselves. We do not call on their behalf. We do not observe the call. We have no record of whether they called.

## What the coach NEVER does

- Says "I detected a crisis cue." That would feel like surveillance.
- Says "you're in crisis." Not the coach's role to label.
- Says "I'm going to call someone for you" without explicit consent.
- Reads all three resources out loud as a list.
- Refers to the assessment level in conversation. ("level acute" — no.)
- Pretends the call has happened when it hasn't.
- Pushes if the person says no. The user's no is final.

## What the chair NEVER does

- Sends an alert anywhere on our side.
- Opens a ticket. There is no ticketing system.
- Logs the cues that fired. (`lib/privacy/policy.ts::logSafe` strips them.)
- Stores the assessment past the current visit. `useSession.getState().reset()` wipes `crisis` along with everything else on `beforeunload`, navigation, and tab close.
- Calls a hotline on the user's behalf. The `tel:` and `sms:` links open the user's own dialer; the user presses send.

## The takeaway card

If the visit hit `acute` or `imminent`, the printable takeaway automatically includes the resource panel. Someone leaving the suite should not have to remember the number — the paper holds it. No name on it. Nothing identifying.

## Auditing this yourself

```bash
# the detector is pure, no network
grep -n "fetch\|http" lib/coach/crisis.ts             # → no hits

# the assessment never reaches a vendor
grep -n "crisisLevel\|crisisCategories" lib/        # → only the coach route + stream-client + store

# /api/privacy declares the posture
curl http://localhost:3000/api/privacy | jq .crisis
```

If any of those answers ever changes silently, the promise has been broken.

## What this is not

Not a clinical screening tool. Not a substitute for trained crisis intervention. The deterministic detector will miss things; the on-screen resources are not therapy. The coach is a calm, attentive presence that knows when to point — gently, with no fanfare — at the people whose actual job this is.

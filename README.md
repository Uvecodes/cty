<!-- bible verse logic and algorithm approaches -->

3 viable approaches
A Pre-seeded corpus (public-domain text) + smart picker ✅ (cheapest, most reliable)

Use a public-domain translation (e.g., WEB or KJV) so you can ship the text without licenses. WEB is explicitly public domain. 
World English Bible
eBible
Bible Gateway

Store a curated bank of verses grouped by topic and difficulty, with short morals and reflection questions written once.

Daily content = deterministic pick using a seeded RNG from YYYY-MM-DD + ageGroup (so everyone in 7–10 sees the same thing that day).

Cache the day’s selection to Firestore (dailyContent/2025-08-16/groups/7-10) so the UI is just a read.
Pros: zero vendor downtime, zero per-request cost, blazing fast.
Cons: upfront effort to seed ~300–600 references + 1–2 moral lines each (we can bootstrap small and grow).

B API-driven text + caching 🔌 (flexible translations/audio)

Use a scripture API to fetch by reference and cache the result in Firestore. Good options:

API.Bible (ABS): lots of translations, free for non-commercial use, rate limits; has a “verse of the day” tutorial. 
API.Bible
API.bible Documentation
+1

ESV API (Crossway): ESV text with key; free for non-commercial; endpoints for passage text/HTML/audio. 
ESV Bible
+2
ESV Bible
+2

Bible Brain (Faith Comes By Hearing): text + audio/video sets; requires key. 
faithcomesbyhearing.com
+1
v4.dbt.io

You still pick references from your curated list; the API just returns the text. Cache per day so you’re not calling on every page load.
Pros: translation variety, audio support.
Cons: keys, rate limits, reliability of third-party; many popular translations are not public domain. 
support.biblegateway.com

C Hybrid with AI for age-appropriate “morals” ✨ (do generation offline, serve cached)

Keep verse text from PD translation or from an API (per license).

Use an LLM once per verse to produce age-graded explanations/morals/reflection questions, then store the result in Firestore (generated ahead for the next 30–90 days).

On device, you only read cached content; no live AI calls required.
Pros: super tailored voice per age, minimal runtime cost.
Cons: some infra to pre-generate + review content; you must moderate and keep theology/style consistent.



<!-- the core functionality rendition step by step approach -->
# Catch Them Young — Daily Content v1 (Product Spec)

## 1) Goal

Ship a **deterministic, offline-ready daily verse & moral** experience per age band, **no repeats until cycle**, auto-advancing bands as users grow — with **privacy-light** birthday handling (month/day only). Build **minimal, function-by-function** (Cursor friendly).

## 2) In-Scope (v1)

* Read from static JSON files per band (already created).
* Daily picker algorithm (unique per user, no repeats until N).
* Store month/day (no year) + anchor fields to derive age over time.
* Auto switch bands on user’s birthday.
* Migration UX for existing users missing birthday.
* Timezone-correct day rollovers (user’s tz).
* Basic caching (Firestore + localStorage).

*Out of scope (v1):* full DOB, AI/API selection, admin curation UI (only mention blocklist hook), notifications.

## 3) Age Bands (corrected)

* **4–6** → key `4-6`
* **7–10** → key `7-10`
* **11–13** → key `11-13`
* **14–17** → key `14-17`

> Note: **10** belongs to `7-10`; **11–13** is its own band (replaces 10–13).

## 4) Data Model (users/{uid})

* `tz: string` — IANA timezone (e.g., “Africa/Lagos”).
* `birthMonth: number` (1–12)
* `birthDay: number` (1–31)
* `ageAtSet: number` — age when birthday was captured.
* `ageSetAt: "YYYY-MM-DD"` — date (in user tz) when we anchored `ageAtSet`.
* `activeGroup: "4-6" | "7-10" | "11-13" | "14-17"`
* `contentState: { [groupKey]: { startIndex: number, startDate: "YYYY-MM-DD", lastServedDate: "YYYY-MM-DD", lastServedIndex: number } }`
* (Existing) `age: number` — legacy, used only for migration seeding.

*Optional ops doc:*

* `blockedRefs: string[]` — refs to skip when rendering.

## 5) Files (CDN)

* `/data/cty_content_4-6.json`
* `/data/cty_content_7-10.json`
* `/data/cty_content_11-13.json`
* `/data/cty_content_14-17.json`

Each is an array of items with fields: `ref, translation, passage, topic, moral, reflectionQ, challenge, crossRefs?, length`.

## 6) Deterministic Daily Picker (spec)

* **Unique sequence per user+group:**
  `startIndex = hash(uid + ":" + groupKey) % N` (stable hash; djb2 OK).
* **Anchor:** on first use of a group, set
  `startDate = today(tz)` (YYYY-MM-DD).
* **Daily index:**
  `dayNumber = daysBetween(startDate, today(tz))`
  `index = (startIndex + max(0, dayNumber)) % N`
* **Idempotent per day:** if `lastServedDate == today`, reuse `lastServedIndex`.
* **Blocklist:** if `item.ref` in `blockedRefs`, advance `(index+1)%N` once and cache that as `lastServedIndex`.

## 7) Age Derivation (V1 logic)

* Store `birthMonth`, `birthDay`, `ageAtSet`, `ageSetAt`.
* Each render:

  1. Compute `today` in `tz`.
  2. Count how many birthdays (month/day) occurred between `ageSetAt` (exclusive) and `today` (inclusive).
  3. `derivedAge = ageAtSet + bumps`.
* Leap-day rule: celebrate on **Feb 28** (or Mar 1). Pick **one**; document (recommend **Feb 28**).

**Age → Group mapping**

* 4–6 → `4-6`
* 7–10 → `7-10`
* 11–13 → `11-13`
* 14–17 → `14-17`

If computed group ≠ `activeGroup`, update `activeGroup`. If that group lacks `contentState`, initialize it (set `startIndex`, `startDate`, clear `lastServed*`).

## 8) Flows

### A) New Sign-Up (with birthday)

1. Collect `age`, `birthMonth`, `birthDay`.
2. Set `ageAtSet = age`; `ageSetAt = today(tz)`; `tz` if missing.
3. Compute `derivedAge` → set `activeGroup`.
4. Ensure `contentState[activeGroup]`.
5. Render daily item (idempotent caching).

### B) Migration UX (existing user without birthday)

* **Trigger:** auth success AND (`birthMonth` or `birthDay` missing).
* **Modal copy:** “Add your birthday (month & day) so lessons adjust automatically as you grow.”
* **Actions:** **Save** / **Not now**.

  * Save: write `birthMonth`, `birthDay`, `ageAtSet = legacy age`, `ageSetAt = today(tz)`, set `tz` if missing, recompute `activeGroup`, init state if needed, continue.
  * Not now: continue using legacy `age`; re-prompt after 7 days.

### C) Daily Render

* Get user + profile → ensure `tz`.
* Compute `derivedAge` → `groupKey`.
* Ensure `activeGroup` and group state.
* Load JSON for `groupKey`, compute `index`, apply blocklist skip, cache `lastServed*`.
* Render fields to DOM.

### D) Band Transition (birthday)

* On day where `derivedAge` crosses boundary: update `activeGroup`; initialize its `contentState` if absent; render from that group. Past group history still reproducible via recompute if needed.

## 9) UX Copy (short)

* **Migration modal title:** “Help us tailor your lessons”

* **Body:** “Add your birthday (month & day) so your content updates as you grow.”

* **Fields:** Month ▸, Day ▸

* **Buttons:** “Save” (primary), “Not now” (secondary)

* **Success toast:** “Birthday saved. We’ll keep your lessons growing with you.”

* **Out-of-range message:** “Catch Them Young is for ages 4–17. Please update your profile.”

## 10) Privacy & Security (requirements)

* Firestore Rules: users may **read/write only their own** `/users/{uid}` doc; deny list queries that expose others’ fields.
* Store **month/day only** in V1; no year.
* Don’t send birthday fields to analytics.
* Add a brief parental consent note if required by your region (copy only; legal review later).

## 11) Telemetry (non-PII)

* `profile_missing_birthday_shown` (bool)
* `birthday_captured` (bool)
* `age_group_changed` ({from, to})
* `daily_content_served` ({groupKey, index, ref})
* `content_blocked_skipped` ({groupKey, fromIndex, toIndex})

## 12) Edge Cases

* Leap-day birthdays → treat as **Feb 28** annually.
* Timezone changes → recompute “today” using new `tz`; don’t change `startDate`.
* N shorter than 365 → cycles after N days; no repeat within a cycle.
* Manual birthday edits → when saving, **re-anchor** (`ageAtSet = current derivedAge`, `ageSetAt = today`).

## 13) Acceptance Criteria

**Migration**

* When a legacy user without birthday logs in, a modal appears post-auth.
* Saving month/day stores `birthMonth`, `birthDay`, `ageAtSet`, `ageSetAt`, sets `tz` if missing, and computes `activeGroup`.
* “Not now” bypasses and re-prompts after 7 days.

**Daily render**

* Same item shows for a given user+group on the same local day (idempotent).
* New day (in user tz) advances to next deterministic item.
* Blocklisted ref is skipped exactly once and result is cached for that day.

**Band transition**

* At midnight (user tz) on the user’s birthday that crosses a boundary, `activeGroup` switches and the item renders from the new group.

**Mapping correctness**

* Ages map: 4–6 → `4-6`; 7–10 → `7-10`; **11–13 → `11-13`**; 14–17 → `14-17`.

14) Build Plan (Cursor-friendly: function-by-function)

**Phase 1 — Foundations**

1. `getUserTZ()` — ensure/store `tz` (Intl API).
2. `localDateInTZ(date, tz) -> "YYYY-MM-DD"`
3. `daysBetweenISO(a, b) -> number`
4. `hashUIDGroup(uid, groupKey) -> uint32` (djb2).

**Phase 2 — Age & Group**
5\. `deriveAge(userDoc, tz) -> number` (V1 month/day + anchor; fallback to legacy).
6\. `ageToGroupKey(age) -> "4-6"|"7-10"|"11-13"|"14-17"|null`
7\. `ensureActiveGroup(uid, userDoc, tz) -> groupKey` (switch/init as needed).

**Phase 3 — Daily Picker**
8\. `loadGroupData(groupKey) -> items[]` (fetch JSON).
9\. `ensureGroupState(uid, groupKey, N) -> state`
10\. `computeIndex(state, todayISO, N) -> index` (with idempotence).
11\. `applyBlocklist(index, items, blockedRefs) -> resolvedIndex`
12\. `persistServed(uid, groupKey, todayISO, index)` (+ localStorage mirror).

**Phase 4 — UI**
13\. `renderItemToDOM(item)`
14\. `showToast(type, message)` (reuse existing)
15\. **Migration modal UI**:
\- `shouldShowMigration(userDoc) -> bool`
\- `openMigrationModal()` / `submitMigration(month, day)`
\- `scheduleRePrompt()` (7-day soft remind)

**Phase 5 — QA hooks & Telemetry**
16\. `logEvent(name, payload)` (pluggable)
17\. Add console asserts in dev (group mapping, tz stringify, idempotence).

 15) Rollout

1. Ship with migration modal **flagged off**; verify daily picker in prod with test users.
2. Enable modal for 10% of legacy users; monitor errors + telemetry.
3. Ramp to 100%.
4. Monitor `age_group_changed` spikes around midnights (tz).

 16) Future (post-launch backlog)

* V2: full `dob` + consent; drop anchors.
* Admin curation: blocklist UI, seasonal overrides.
* Topic-bias weeks (e.g., anxiety/hope).
* Notifications (email/push) “Your new reading is ready”.
* AI summaries for younger bands (optional).

---


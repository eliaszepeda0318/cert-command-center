# Firestore schema

## Shared reference data (read-only to clients; written only by `npm run seed` via Admin SDK)
| Collection | Doc id | Key fields |
|---|---|---|
| `certifications` | `ccna-200-301` | title, fullTitle, status (`active`/`coming_later`), order, activeBlueprintId |
| `courses` | `ccna-jeremy` | certificationId, title, playlistUrl, lessonCount, labCount, contentVersion, primarySource (`youtube_free`), freeResources[] ({id,title,url,access,note,verifiedFrom}) |
| `modules` | (unused in v1) | lessons carry `moduleId: null`; no official module grouping was verified |
| `lessons` | `ccna-jeremy-day-01` ... `ccna-jeremy-mega-lab` | certificationId, courseId, order, dayNumber, title, altTitles[], lectures[] (embedded), labIds[] (required, free), extraLabIds[] (optional paid, never counted), reviewFlags[] |
| `labs` | `ccna-jeremy-day-01-lab-1` | lessonId, courseId, certificationId, order, title, durationSec, reviewFlags[] + the free-resource fields below, labFilesUrl/labFilesAccess/labFilesVerification |
| `blueprints` | `ccna-200-301-v1.1`, later `ccna-200-301-v2.0` | certificationId, version, effectiveFrom, retiresOn, status |
| `blueprintObjectives` | `ccna-200-301-v1.1__1.1` | blueprintId, domainCode, code, parentCode, text, v11Change/changeNote |
| `lessonObjectiveMappings` | `<blueprintId>__<itemId>__<code>` | blueprintId, objectiveId, objectiveCode, lessonId, itemId, itemKind (`lecture`/`lab`), confidence (`high`/`needs_review`), basis, source, reviewed |
| `topics` | | certificationId, title, lessonIds[], labIds[] (per-certification topic list) |

### Free-first study resources (lectures and labs)
Every lecture and lab item carries: `freeYoutubeUrl`, `youtubeVideoId`, `youtubeTitle`, `youtubePlaylistPosition`, `youtubeVerification` (`verified`|`needs_review`), `sourceType` (`youtube_free`|`academy_only`), `resourceAccess` (`free`|`paid_optional`|`unverified`), and optional Academy metadata `academyUrl`, `academyTitle`, `academyDurationSec`. `title`/`durationSec` are the YouTube values. Rule: a required item must be `free` with a `freeYoutubeUrl`; `paid_optional` items are `kind: extra` (lectures) or live in `extraLabIds` (labs) and never block the next study day, course completion, blueprint coverage or readiness. The seed fails if a required item has no free video. Stable ids never change when sources change.

Blueprint versioning: objectives and mappings are keyed by `blueprintId`, so v2.0 is added as new
docs. Nothing in a user's personal data references an objective id, and blueprint coverage is
*computed* from progress + mappings, so v1.1 progress is never rewritten when v2.0 is added.

## Personal data (owner-only: `users/{uid}/...`)
- `users/{uid}`: profile, `settings` {weeklyGoalMinutes, activeCertificationId}, `stats` {xp, totalStudyMinutes, ankiSessions} (aggregates avoid reading every session).
- `users/{uid}/progress/{lessonId|labId}`: `type: 'lesson'|'lab'`. Doc ids equal the stable curriculum ids, so re-seeding never orphans progress.
- `users/{uid}/progress/{lessonId}` fields: `completedLectureIds[]` (authoritative, stable lecture item ids), `lectureCompleted` (derived; legacy docs with only this are read as "all required lectures done"), `lastAnkiDate` (metadata only).
- `users/{uid}/ankiDays/{YYYY-MM-DD}`: existence = Anki done that local day. Written inside the save transaction, which makes Anki XP once-per-day.
- `users/{uid}/studySessions/{autoId}`: one per saved session (lessonId, durationMin, activities, confidence, notes, `startedAt` = when Start was clicked, `completedAt` = when saved, `localDate`). Dashboard queries the last 35 days by `completedAt`; History uses its own paginated query.
- `users/{uid}/reviewDays/{YYYY-MM-DD}`: existence = review-session XP already awarded that day.
- `users/{uid}/topicProgress/{topicId}`: `confidence` 1-5 (manual), `missCount`/`lastMissedAt` (denormalized from practice exams).
- `users/{uid}/practiceExams/{autoId}`: provider, examName, scorePercent, takenOn, notes, missedTopicIds[]. Saving increments `missCount` on missed topics in the same batch.
- `users/{uid}/workApplications/{autoId}`: date, title, situation, knowledgeApplied, optional topicId.
- Lesson notes (clicked/confused/commands/general) live in `progress/{lessonId}.notes`; lab notes in `progress/{labId}.notes`. There is no separate notes collection.
- `progress/{labId}.xpAwarded {lab, independent}` guards lab XP to once per lab, ever.
(All covered by the single owner-only rule on `users/{uid}/**`.)

All timestamps are Firestore `Timestamp` (`serverTimestamp()` for user doc, `Timestamp.now()` inside batches).

## Paid access (server-controlled; see docs/paid-access.md)
| Collection | Doc id | Fields | Client rules |
|---|---|---|---|
| `appConfig` | `access` | salesOpen, maxPaidUsers, currentPaidUsers, foundingPriceCents (1000) | signed-in read of `access` only; no writes |
| `entitlements` | `{uid}` | status (`active`/`expired`/`comped`/`admin`), accessStartedAt, accessExpiresAt (null for admin), stripeCustomerId, lastCheckoutSessionId, lastPaymentIntentId, updatedAt, seatHeld, email | owner read only; no writes |
| `seatReservations` | `{uid}` | sessionId, createdAt, expiresAt (31-min hold taken when a NEW buyer starts checkout) | none (default deny) |
| `stripePayments` | `{sessionId}` | uid, paymentIntentId, paidAt, processedAt, outcome, refundId (idempotency record) | none (default deny) |

Access = `admin`, or status `active`/`comped` with `accessExpiresAt` in the future. Curriculum reads and `users/**` writes require it; `users/**` reads stay owner-only.

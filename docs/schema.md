# Firestore schema

## Shared reference data (read-only to clients; written only by `npm run seed` via Admin SDK)
| Collection | Doc id | Key fields |
|---|---|---|
| `certifications` | `ccna-200-301` | title, fullTitle, status (`active`/`coming_later`), order, activeBlueprintId |
| `courses` | `ccna-jeremy` | certificationId, title, playlistUrl, lessonCount, labCount, contentVersion |
| `modules` | (unused in v1) | lessons carry `moduleId: null`; no official module grouping was verified |
| `lessons` | `ccna-jeremy-day-01` ... `ccna-jeremy-mega-lab` | certificationId, courseId, order, dayNumber, title, altTitles[], lectures[] (embedded), labIds[], reviewFlags[] |
| `labs` | `ccna-jeremy-day-01-lab-1` | lessonId, courseId, certificationId, order, title, url, durationSec, downloadUrl (null), reviewFlags[] |
| `blueprints` (Stage 3) | `ccna-200-301-v1.1`, later `ccna-200-301-v2.0` | certificationId, version, effectiveFrom, retiresOn, status |
| `blueprintObjectives` (Stage 3) | `ccna-200-301-v1.1-1.1` | blueprintId, domain, weight, code, text |
| `lessonObjectiveMappings` (Stage 3) | `<blueprintId>__<lessonId>` | blueprintId, lessonId/labIds, objectiveIds[], confidence (`verified`/`needs_review`) |
| `topics` (Stage 2) | | per-certification topic list |

Blueprint versioning: objectives and mappings are keyed by `blueprintId`, so v2.0 is added as new
docs. Nothing in a user's personal data references an objective id, and blueprint coverage is
*computed* from progress + mappings, so v1.1 progress is never rewritten when v2.0 is added.

## Personal data (owner-only: `users/{uid}/...`)
- `users/{uid}`: profile, `settings` {weeklyGoalMinutes, activeCertificationId}, `stats` {xp, totalStudyMinutes, ankiSessions} (aggregates avoid reading every session).
- `users/{uid}/progress/{lessonId|labId}`: `type: 'lesson'|'lab'`. Doc ids equal the stable curriculum ids, so re-seeding never orphans progress.
- `users/{uid}/progress/{lessonId}` fields: `completedLectureIds[]` (authoritative, stable lecture item ids), `lectureCompleted` (derived; legacy docs with only this are read as "all required lectures done"), `lastAnkiDate` (metadata only).
- `users/{uid}/ankiDays/{YYYY-MM-DD}`: existence = Anki done that local day. Written inside the save transaction, which makes Anki XP once-per-day.
- `users/{uid}/studySessions/{autoId}`: one per saved session (lessonId, durationMin, activities, confidence, notes, `startedAt` = when Start was clicked, `completedAt` = when saved, `localDate`). Dashboard queries the last 35 days by `completedAt`; History uses its own paginated query.
- Later stages: `practiceExams`, `notes`, `workApplications`, `topicProgress` (same owner-only rule already covers them).

All timestamps are Firestore `Timestamp` (`serverTimestamp()` for user doc, `Timestamp.now()` inside batches).

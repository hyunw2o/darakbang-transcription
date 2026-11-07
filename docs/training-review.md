# Private Audio Review

The web admin workspace is `/admin/training`, including mobile browser layouts.
It does not change the native application or train a model automatically.

## Setup

1. Run `backend/sql/training_data_assets.sql`, then `backend/sql/training_review.sql`
   in the project's Supabase SQL editor. The `training-audio` bucket stays private.
2. Set `TRAINING_REVIEW_ADMIN_USER_IDS` to a comma-separated list of verified
   Supabase Auth user UUIDs on the backend. No users are allowed by default.
   This is deliberately unrelated to billing bypass or a client-editable role.
3. Deploy backend/frontend, or run them locally with the existing authentication
   and database settings. Sign in again to refresh the admin navigation link.

Each administrator can access only the files they imported. Nothing is shared
across accounts. Every API route checks authorization server-side. Cookie writes
use the existing trusted-origin guard. Account deletion removes storage objects
and training records via the existing deletion workflow.

## Local Sources

`prepare_training_review.py ROOT --report PRIVATE_PATH/report.json` scans audio
and TXT pairs by relative path and Unicode-normalized stem, computes audio hashes,
and flags repeated reference passages. It does not upload anything or call AI.
Reports, originals and reviewed exports must not be committed to Git.

In the admin screen, select the `학습` folder (or individual pairs), inspect the
pair list, confirm the rights to store/use these recordings and click import.
This action uploads originals and reference text to private Supabase storage/DB.
Imports are sequential, bounded to 200 MB audio and 1 MB UTF-8 TXT per pair, and
deduplicated per admin by audio SHA-256. Re-importing does not overwrite reviews
or existing reference text. Failed uploads remain in the pending import list.

The current TXT files are unreviewed or rewritten summaries. Their paragraphs
cannot honestly be assigned exact audio timestamps without additional alignment
and listening. They appear as read-only references, NOT automatic ground truth.
Repeated passages are text-only leads, not confirmed audio errors. Create a
segment with explicit start/end seconds (max 60 seconds), listen, and type the
verbatim reference. Preserve genuine repetitions and partial names; do not turn
the ASR target into a summary or written-style rewrite. Inaudible/uncertain
segments should remain pending or excluded, not approved with guessed text.

## Review and Export

- Draft, approved and excluded states are separate. Approval requires text,
  listening and verbatim-review attestations plus active audio consent.
- Editing an approved example and saving a draft removes its approval. Completed
  rows carry reviewer, time and revision; compare-and-swap prevents stale writes.
  The last 50 revisions are retained in private row metadata, not an immutable audit.
- Consent can be revoked. Revoked/expired/deleted audio is excluded from playback
  link issuance and export. Existing signed playback links expire within 10 minutes;
  revocation cannot retract a URL or file already downloaded during its validity.
- Assign train/validation/test once per original recording. Export skips
  unassigned audio and rejects overlaps or identical audio hashes across splits.
  Different recordings of the same speaker/event still need manual group splitting
  to prevent evaluation leakage; filenames cannot prove speaker identity.
- Export downloads approved JSONL only, not audio or summaries. It includes
  filenames, SHA-256, source interval, verbatim text, split and review revision.
- Build a local corpus without external calls:

```sh
python backend/scripts/prepare_training_review.py /private/path/to/originals \
  --reviewed-manifest /private/path/reviewed-dataset.jsonl \
  --clips-output /private/path/new-reviewed-corpus
```

This hashes the local originals, cuts only approved intervals to 16 kHz mono WAV,
checks extracted duration, and writes `dataset.jsonl`. It refuses an existing
output directory. Downloaded corpora remain private and must be deleted when
consent is withdrawn; previous exports cannot be remotely revoked.

## Fidelity

Source occurrence IDs preserve real repeated utterances. Correction rejects
missing/reordered IDs, cross-unit copying and different source sentences that
collapse into the same edited sentence. Merge checks owned, contiguous intervals,
result chunk identity and the final endpoint against original duration. Invalid
merges fail rather than return a silently incomplete transcript. These checks
protect pipeline bookkeeping, not proof that ASR recognized every audible word.

Offline checks: `backend/scripts/check_training_review.py`,
`backend/scripts/check_transcript_fidelity.py`, and
`node --test frontend/scripts/check_training_review.cjs`.

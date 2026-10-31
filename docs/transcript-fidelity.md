# Source-owned transcript pipeline

## Invariants

- Primary ASR uses disjoint source intervals, cut at detected silence near the
  existing 90-second target and within the existing 120-second maximum. Every
  interval must return a result. Joining rejects gaps, overlaps, missing results
  and out-of-order IDs instead of silently skipping them.
- If normal silence detection cannot find a boundary, retry with 120ms pauses.
  Remaining non-silent boundaries are marked for review, including after retry.
  `WHISPER_CHUNK_OVERLAP_SECONDS` is no longer used for primary extraction.
  Without reliable word timestamps, text similarity is not evidence that two
  occurrences are the same utterance. Identical adjacent phrases are preserved.
- Opening recovery only adds a prefix before a unique shared sentence anchor.
  Alternative or unanchored hypotheses are not blindly concatenated.
- Repetition detectors trigger retry/review, never unconditional collapse of
  raw speech. The legacy collapse helper is not called by production paths.
- Source sentence/line occurrences receive distinct ordered IDs before correction.
  Every response must cover those IDs once, in order. Invalid coverage preserves
  the whole batch; unsafe text edits preserve the affected source unit.
- Correction permits conservative in-place spelling/style changes, with existing
  special-term normalization used for comparison. It rejects word-span insertion,
  deletion, number changes and copied source sentences. This is a textual guard,
  not a semantic proof or a measurement of ASR accuracy.
- Layout contains only paragraph/section metadata. The renderer emits each ID
  once. Sermon sections cannot restart in each batch. There is no generated
  summary appended to the verbatim body; the separate summarization API remains.
- Final source-alignment checks also cover deterministic and optional fine-tuned
  postprocessing. Raw and corrected transcripts remain separately stored.

The Gemini call uses its [structured output contract](https://ai.google.dev/api/generate-content#v1beta.GenerationConfig),
plus local validation; schema-valid JSON alone is not trusted for content fidelity.

## Verification

```sh
python backend/scripts/check_transcript_fidelity.py
python backend/scripts/run_feature_quality_gates.py
```

Tests use synthetic text, mock providers with network disabled, and a generated
sine-wave file for real ffmpeg extraction. Cases include one omission in 100
sentences, duplicates below the previous 12% growth threshold, real repetitions,
missing/reordered IDs, partial model responses, concurrent correction ordering,
known term corrections, unverified boundaries and provider failure fallback.

No private recordings or paid API calls are needed. These tests do not establish
100% acoustic recognition. Slurred speech, continuous speech without silence,
and ASR-origin hallucinations still require audio-grounded review. Conservative
fallback may retain typos or less polished formatting instead of guessing.

## Deployment

Deploy the same commit to the backend and transcription worker. No schema
migration or client/native rebuild is required. New conversions use this path;
saved results and already-running old-worker jobs are not rewritten.

`GET /health` exposes `transcription.fidelity_pipeline = source-owned-v1`.
Verify the worker's live commit and startup logs separately. To roll back, deploy
the prior known-good commit on both services; do not alter existing saved records.

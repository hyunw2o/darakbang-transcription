#!/usr/bin/env python3
"""Run mallog24 feature-change quality gates before push/deploy."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
PYTHON_FILES = [
    "backend/main.py",
    "backend/church_terms.py",
    "backend/transcription_chunking.py",
    "backend/worker.py",
    "backend/scripts/export_correction_finetune_dataset.py",
    "backend/scripts/manage_correction_finetune.py",
    "backend/scripts/evaluate_correction_model.py",
    "backend/scripts/check_feature_readiness.py",
    "backend/scripts/build_feature_sql_bundle.py",
    "backend/scripts/smoke_transcription_api.py",
    "backend/scripts/smoke_glossary_api.py",
    "backend/scripts/smoke_correction_sample_api.py",
    "backend/scripts/smoke_saved_record_edit_api.py",
    "backend/scripts/run_post_deploy_checks.py",
    "backend/scripts/print_rollback_plan.py",
    "backend/scripts/report_correction_samples.py",
]


def run_command(command: list[str], *, cwd: Path = REPO_ROOT, env: dict[str, str] | None = None) -> None:
    print(f"+ {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=str(cwd), env=env, check=True)


def run_py_compile() -> None:
    env = os.environ.copy()
    env.setdefault("PYTHONPYCACHEPREFIX", "/private/tmp/pycache")
    run_command([sys.executable, "-m", "py_compile", *PYTHON_FILES], env=env)


def run_main_import() -> None:
    run_command([
        sys.executable,
        "-c",
        (
            "import sys; "
            "sys.path.insert(0, 'backend'); "
            "import main; "
            "assert main.ENABLE_FINE_TUNED_CORRECTION is False; "
            "print('main-import-ok')"
        ),
    ])


def run_special_term_sample() -> None:
    run_command([
        sys.executable,
        "-c",
        (
            "import sys; "
            "sys.path.insert(0, 'backend'); "
            "from transcription_chunking import build_silence_aware_chunk_plan, find_coverage_gaps; "
            "plans=build_silence_aware_chunk_plan(3600, [(89.5,90.5),(179.5,180.5)], "
            "target_seconds=90, min_seconds=60, max_seconds=120, overlap_seconds=12); "
            "assert not find_coverage_gaps(plans, 3600, tolerance=0.1); "
            "assert max(plan.duration for plan in plans) <= 120.001; "
            "assert plans[0].core_start == 0 and plans[-1].core_end == 3600; "
            "print('silence-aware-chunk-coverage-ok', len(plans))"
        ),
    ])
    run_command([
        sys.executable,
        "-c",
        (
            "import sys; "
            "sys.path.insert(0, 'backend'); "
            "from main import _build_compact_whisper_prompt, _build_gemini_only_system_instruction, _build_history_items, _build_transcription_progress, _build_transcription_status_response, _collapse_pathological_repeats, _contains_pathological_repeats, _discard_task_api_usage, _extract_transcription_logprob_stats, _finalize_task_api_usage, _is_low_confidence_transcription, _join_whisper_chunk_results, _prefer_retry_transcription, _record_gemini_api_usage, _record_openai_api_usage, _start_task_api_usage, _transcription_retry_reasons; "
            "stats=_extract_transcription_logprob_stats({'logprobs':[{'logprob':-0.01},{'logprob':-1.2},{'logprob':-0.02}]}); "
            "assert _is_low_confidence_transcription(stats); "
            "progress=_build_transcription_progress('transcribing', {'current_chunk':2,'total_chunks':4}); "
            "assert progress['percent'] == 45; "
            "status=_build_transcription_status_response({'status':'processing','progress':progress,'chunk_manifest':[{'index':0}]}, 't1'); "
            "assert status['progress']['stage'] == 'transcribing' and len(status['chunk_manifest']) == 1; "
            "fallback_status=_build_transcription_status_response({'status':'processing'}, 't2'); "
            "assert fallback_status['progress']['stage'] == 'transcribing'; "
            "joined=_join_whisper_chunk_results([{'start':0,'end':102},{'start':78,'end':180}], "
            "[{'text':'오늘 우리는 렘넌트의 언약을 확인합니다.'},{'text':'렘넌트의 언약을 확인합니다. 그리고 세계복음화를 시작합니다.'}]); "
            "assert joined.count('렘넌트의 언약을 확인합니다') == 1 and '세계복음화' in joined; "
            "loop=', '.join(['우리 장노님도 있고']*40)+'.'; "
            "collapsed=_collapse_pathological_repeats(loop); "
            "assert collapsed.count('우리 장노님도 있고') == 1, collapsed; "
            "mixed=', '.join(['요즘 우리 장노님도 있고']+['우리 장노님도 있고']*24+['우리 장노님도 우리 장노님도 있고']+['우리 장노님도 있고']*25)+'.'; "
            "mixed_collapsed=_collapse_pathological_repeats(mixed); "
            "assert mixed_collapsed.count('장노님') == 1, mixed_collapsed; "
            "deliberate=', '.join(['반드시 확인합니다']*3)+'.'; "
            "assert _collapse_pathological_repeats(deliberate) == deliberate; "
            "short_loop=', '.join(['이 말씀을 꼭 기억해야 합니다']*5)+'.'; "
            "assert _contains_pathological_repeats(short_loop); "
            "assert _collapse_pathological_repeats(short_loop).count('이 말씀을 꼭 기억해야 합니다') == 1; "
            "token_loop=('우리 장노님도 있고 '*12).strip(); "
            "assert _contains_pathological_repeats(token_loop); "
            "assert _collapse_pathological_repeats(token_loop).count('우리 장노님도 있고') == 1; "
            "reasons=_transcription_retry_reasons({'text':loop}, {'index':0,'duration':90}, 1); "
            "assert 'pathological_repeat' in reasons, reasons; "
            "clean={'text':'요즘 우리 장로님도 있고 함께 예배드리는 성도들도 있습니다. 오늘의 말씀을 확인합니다.'}; "
            "assert _prefer_retry_transcription({'text':loop}, clean) is clean; "
            "_start_task_api_usage('usage-test', 60); "
            "_record_openai_api_usage('usage-test', {'usage':{'input_tokens':100,'input_token_details':{'audio_tokens':90,'text_tokens':10},'output_tokens':20,'total_tokens':120}}, model='gpt-4o-transcribe', operation='primary_transcription', processed_seconds=60); "
            "_record_gemini_api_usage('usage-test', {'usage_metadata':{'prompt_token_count':30,'candidates_token_count':15,'thoughts_token_count':5,'total_token_count':50}}, model='gemini-2.5-flash', operation='correction'); "
            "usage=_finalize_task_api_usage('usage-test'); "
            "assert usage['total_reported_tokens'] == 170 and usage['total_requests'] == 2 and usage['complete_token_reporting'] is True, usage; "
            "plain_history=_build_history_items([{'task_id':'t1','status':'completed'}]); "
            "admin_history=_build_history_items([{'task_id':'t1','status':'completed'}], {'t1':usage}); "
            "assert 'api_usage' not in plain_history[0] and admin_history[0]['api_usage']['total_reported_tokens'] == 170; "
            "_discard_task_api_usage('usage-test'); "
            "_start_task_api_usage('usage-duration-test', 10); "
            "_record_openai_api_usage('usage-duration-test', {'usage':{'seconds':10}}, model='whisper-1', operation='timestamp_audit', processed_seconds=10); "
            "duration_usage=_finalize_task_api_usage('usage-duration-test'); "
            "assert duration_usage['total_requests'] == 1 and duration_usage['complete_token_reporting'] is False, duration_usage; "
            "_discard_task_api_usage('usage-duration-test'); "
            "whisper_prompt=_build_compact_whisper_prompt('ko','sermon'); "
            "assert '성교사→선교사' in whisper_prompt and '선교사' in whisper_prompt and '장노님→장로님' in whisper_prompt and '두음법칙' in whisper_prompt and 'RVS' in whisper_prompt, whisper_prompt; "
            "assert all(name in whisper_prompt for name in ['김성빈','김준서','박수경','양하준','이세라','한세희','이정민']), whisper_prompt; "
            "gemini_audio_prompt=_build_gemini_only_system_instruction('ko','sermon'); "
            "assert '성교사→선교사' in gemini_audio_prompt and '장노님→장로님' in gemini_audio_prompt and '원노트' in gemini_audio_prompt, gemini_audio_prompt; "
            "assert all(name in gemini_audio_prompt for name in ['김성빈','김준서','박수경','양하준','이세라','한세희','이정민']), gemini_audio_prompt; "
            "print('selective-retry-time-merge-and-repeat-guard-ok')"
        ),
    ])
    run_command([
        sys.executable,
        "-c",
        (
            "import sys; "
            "sys.path.insert(0, 'backend'); "
            "from church_terms import _normalize_special_term_rules; "
            "text=_normalize_special_term_rules('RVH, NRDC, H M C, R V I S, C V D I P.'); "
            "assert 'RVS' in text and 'RUTC' in text and 'HMC' in text and 'RVIS' in text and 'CVDIP' in text; "
            "print('sample-term-correction-ok', text)"
        ),
    ])
    run_command([
        sys.executable,
        "-c",
        (
            "import sys; "
            "sys.path.insert(0, 'backend'); "
            "from main import _build_fine_tuned_correction_messages; "
            "messages=_build_fine_tuned_correction_messages("
            "'RBS 흐름', 'sermon', 'ko', ['RVS (Remnant Vision School; misheard as RBS)']"
            "); "
            "assert 'User glossary' in messages[1]['content'] and 'RVS' in messages[1]['content']; "
            "print('fine-tuned-glossary-context-ok')"
        ),
    ])
    run_command([
        sys.executable,
        "-c",
        (
            "import sys; "
            "sys.path.insert(0, 'backend'); "
            "from church_terms import correct_text, get_special_term_prompt_hint; "
            "en=correct_text('The seven artisan and watch tower are part of the prayer flow.', language='en'); "
            "ja=correct_text('七つのバーティザンと見張り 台を確認します。', language='ja'); "
            "hint=get_special_term_prompt_hint('en'); "
            "assert 'Bartizan' in en and 'watchtower' in en, en; "
            "assert 'バルティザン' in ja and '見張り台' in ja, ja; "
            "assert 'Bartizan' in hint and 'watchtower' in hint and '망대' in hint and '파수대' in hint; "
            "print('multilingual-domain-term-correction-ok')"
        ),
    ])
    run_command([
        sys.executable,
        "-c",
        (
            "import sys; "
            "sys.path.insert(0, 'backend'); "
            "from church_terms import correct_text, get_correction_prompt_by_type, get_gemini_correction_prompt; "
            "ko=correct_text('이거를 확인하고 이게 맞으면 이건 그대로 둡니다. 승경이와 주현도 그대로 기록합니다. 우리 장노님도 계십니다.', "
            "transcription_type='sermon', language='ko'); "
            "prompt=get_gemini_correction_prompt(); "
            "assert '이것을' in ko and '이것이' in ko and '이것은' in ko, ko; "
            "assert '승경이' in ko and '주현도' in ko and '장승경' not in ko and '이주현' not in ko, ko; "
            "assert '장로님' in ko and '장노님' not in ko, ko; "
            "phonology=correct_text('성교사를 파송하고 성교사님을 위해 기도합니다. 성녕의 능녁으로 협녁하고 동닙합니다. 어냐글 붙잡고 보그믈 전하며 말쓰믈 확인합니다. 력사와 리유, 령혼과 륙신, 률법과 례배입니다.', transcription_type='sermon', language='ko'); "
            "expected_terms=['선교사를','선교사님을','성령의','능력으로','협력하고','독립합니다','언약을','복음을','말씀을','역사와','이유','영혼과','육신','율법과','예배입니다']; "
            "assert all(term in phonology for term in expected_terms), phonology; "
            "protected=correct_text('리더 류광수 노회 원노트', transcription_type='sermon', language='ko'); "
            "assert protected == '리더 류광수 노회 원노트', protected; "
            "phonology_prompt=get_correction_prompt_by_type('sermon','ko'); "
            "assert '성교사→선교사' in phonology_prompt and '장노님→장로님' in phonology_prompt and '리더, 류광수' in phonology_prompt, phonology_prompt; "
            "assert '승경이→장승경이' in prompt and '주현→이주현이' in prompt, prompt; "
            "print('ko-colloquial-name-and-phonology-ok')"
        ),
    ])
    run_command([
        sys.executable,
        "-c",
        (
            "import sys; "
            "from datetime import datetime, timedelta; "
            "sys.path.insert(0, 'backend'); "
            "from main import _build_usage_snapshot, PAID_PLAN_TIER, USAGE_FREE_PLAN; "
            "base={'user_id':'u1','plan_tier':USAGE_FREE_PLAN,'used_audio_seconds':120,"
            "'usage_month':'2026-05-01','trial_started_at':datetime.utcnow().isoformat(),"
            "'trial_ends_at':(datetime.utcnow()+timedelta(days=10)).isoformat(),"
            "'trial_source':'welcome_signup_30d','trial_consumed':True}; "
            "trial=_build_usage_snapshot(base); "
            "assert trial['plan_tier'] == PAID_PLAN_TIER and trial['access_source'] == 'welcome_trial' and trial['remaining_seconds'] is None, trial; "
            "forced=_build_usage_snapshot(base, force_free_plan=True); "
            "assert forced['plan_tier'] == USAGE_FREE_PLAN and forced['access_source'] == 'free', forced; "
            "expired={**base,'trial_ends_at':(datetime.utcnow()-timedelta(seconds=1)).isoformat()}; "
            "free=_build_usage_snapshot(expired); "
            "assert free['plan_tier'] == USAGE_FREE_PLAN and free['trial_active'] is False, free; "
            "print('welcome-trial-usage-snapshot-ok')"
        ),
    ])


def run_script_self_tests() -> None:
    run_command([sys.executable, "backend/scripts/check_feature_readiness.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/export_correction_finetune_dataset.py", "--self-test", "--dry-run", "--min-kept", "1"])
    run_command([sys.executable, "backend/scripts/evaluate_correction_model.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/build_feature_sql_bundle.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/smoke_transcription_api.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/smoke_glossary_api.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/smoke_correction_sample_api.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/smoke_saved_record_edit_api.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/run_post_deploy_checks.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/print_rollback_plan.py", "--self-test"])
    run_command([sys.executable, "backend/scripts/report_correction_samples.py", "--self-test"])
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".jsonl", delete=False) as handle:
        training_file = handle.name
        handle.write(json.dumps({
            "messages": [
                {"role": "system", "content": "Correct transcript text."},
                {"role": "user", "content": "RBS and R U T C"},
                {"role": "assistant", "content": "RVS and RUTC"},
            ]
        }, ensure_ascii=False) + "\n")
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".jsonl", delete=False) as handle:
        validation_file = handle.name
        handle.write(json.dumps({
            "messages": [
                {"role": "system", "content": "Correct transcript text."},
                {"role": "user", "content": "H M C"},
                {"role": "assistant", "content": "HMC"},
            ]
        }, ensure_ascii=False) + "\n")
    try:
        run_command([
            sys.executable,
            "backend/scripts/manage_correction_finetune.py",
            "create",
            "--training-file",
            training_file,
            "--validation-file",
            validation_file,
            "--dry-run",
            "--min-examples",
            "1",
        ])
    finally:
        Path(training_file).unlink(missing_ok=True)
        Path(validation_file).unlink(missing_ok=True)


def run_frontend_build() -> None:
    run_command(["npm", "run", "build"], cwd=REPO_ROOT / "frontend")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--with-frontend-build", action="store_true", help="Also run frontend npm build.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    run_py_compile()
    run_main_import()
    run_special_term_sample()
    run_script_self_tests()
    if args.with_frontend_build:
        run_frontend_build()
    print("feature-quality-gates-ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

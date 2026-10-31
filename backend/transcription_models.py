"""Model-specific Audio API arguments and a hard stop for retired models."""
from datetime import date, datetime, timezone

DEFAULT_TRANSCRIPTION_MODEL = "gpt-transcribe"
LEGACY_SHUTDOWN = date(2027, 2, 26)


def is_legacy(model):
    return model == "whisper-1" or model.startswith(("gpt-4o-transcribe", "gpt-4o-mini-transcribe"))


def legacy_available(today=None):
    return (today or datetime.now(timezone.utc).date()) < LEGACY_SHUTDOWN


def model_candidates(primary, fallbacks=(), today=None):
    models = list(dict.fromkeys(str(m).strip() for m in [primary, *fallbacks] if str(m or "").strip()))
    models = [m for m in models if not is_legacy(m) or legacy_available(today)]
    return models or [DEFAULT_TRANSCRIPTION_MODEL]


def transcription_arguments(model, language, prompt, terms, recording_type, timeout, temperature=0, logprobs=False):
    args = {"model": model, "response_format": "json", "timeout": timeout}
    if model.startswith("gpt-transcribe"):
        keywords = list(dict.fromkeys(
            term.strip() for term in (terms or [])
            if isinstance(term, str) and term.strip() and len(term) <= 100
            and not any(c in term for c in "<>\r\n")
        ))[:100]
        context = {"sermon": "A recorded sermon.", "prayer": "A recorded prayer.",
                   "phonecall": "A recorded phone call.",
                   "conversation": "A recorded conversation or meeting."}.get(recording_type, "A recorded speech.")
        args.update(prompt=context, extra_body={"languages": [language], "keywords": keywords})
        return args
    args.update(language=language, prompt=prompt, temperature=temperature)
    if model == "whisper-1":
        args["response_format"] = "text"
    elif logprobs and model in {"gpt-4o-transcribe", "gpt-4o-mini-transcribe", "gpt-4o-mini-transcribe-2025-12-15"}:
        args["include"] = ["logprobs"]
    return args

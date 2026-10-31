#!/usr/bin/env python3
"""Explicit paid smoke check using synthetic speech, never user recordings."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from transcription_models import transcription_arguments


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-paid-synthetic-check", action="store_true")
    args = parser.parse_args()
    if not args.run_paid_synthetic_check:
        print("No API call. Use --run-paid-synthetic-check for one short generated audio request.")
        return
    from dotenv import load_dotenv
    from openai import OpenAI
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    with tempfile.TemporaryDirectory(prefix="mallog-model-smoke-") as directory:
        aiff, wav = Path(directory) / "synthetic.aiff", Path(directory) / "synthetic.wav"
        subprocess.run(["say", "-v", "Samantha", "-o", str(aiff), "This is a synthetic transcription test. The meeting starts at ten. Thank you."], check=True)
        subprocess.run(["/opt/homebrew/bin/ffmpeg", "-v", "error", "-i", str(aiff), "-ar", "16000", "-ac", "1", str(wav)], check=True)
        with wav.open("rb") as audio:
            response = OpenAI(timeout=90, max_retries=0).audio.transcriptions.create(file=audio, **transcription_arguments(
                "gpt-transcribe", "en", "", ["meeting"], "conversation", 90))
        text = response.text
        assert "meeting" in text.lower() and "ten" in text.lower(), "Synthetic speech failed expected words"
        print(json.dumps({"model": "gpt-transcribe", "synthetic_only": True, "text": text, "passed": True}))


if __name__ == "__main__": main()

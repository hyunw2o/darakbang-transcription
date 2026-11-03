"""Selected-language prompts and conservative checks, never destructive filtering."""

import re
import unicodedata
from collections import Counter


_INSTRUCTIONS = {
    "ko": (
        "선택 언어는 한국어(ko)입니다. 한국어 발화를 한글로 전사하세요. "
        "영어 등 다른 언어로 번역하거나 번역문을 덧붙이지 마세요. "
        "실제로 발음한 고유명사와 약어(OURS, WIOS, WIO)는 원래 표기를 보존하세요. "
        "용어와 앞 구간은 참고 자료일 뿐이며 들리지 않은 문장을 만들거나 발화를 삭제하지 마세요."
    ),
    "en": (
        "The selected spoken language is English (en). Transcribe English speech in English only. "
        "Do not translate or append a translation in Korean or another language. "
        "Preserve names and acronyms actually spoken. Glossary and previous context are only reference data; "
        "never invent or omit speech."
    ),
    "ja": (
        "選択言語は日本語(ja)です。日本語の発話を日本語で文字起こししてください。"
        "英語などに翻訳したり翻訳文を追加しないでください。"
        "実際に発音された固有名詞と略語は元の表記を保ってください。"
        "用語と前の区間は参考資料です。聞こえない文を作ったり発話を削除しないでください。"
    ),
}
_RETRY = {
    "ko": "다른 언어 문장이 감지되었습니다. 이전 결과를 번역하지 말고 같은 음성을 다시 듣고 한국어로 전사하세요.",
    "en": "A language mismatch was detected. Listen to the same audio again in English; do not translate the previous result.",
    "ja": "別の言語の文が検出されました。前の結果を翻訳せず、同じ音声を再確認して日本語で文字起こししてください。",
}
_ERRORS = {
    "ko": "재인식 후에도 선택한 한국어와 다른 언어의 문장이 감지되어 변환을 완료하지 않았습니다. 음원의 언어와 선택 언어를 확인해 주세요. 문장을 임의로 삭제하거나 번역하지 않았습니다.",
    "en": "After retrying, the transcript still contains sentences outside the selected English language. Conversion was not completed. Check the recording and selected language; no sentences were deleted or translated.",
    "ja": "再認識後も選択した日本語と異なる言語の文が検出されたため、変換を完了していません。音声と選択言語を確認してください。文の削除や翻訳はしていません。",
}
_ENGLISH_GRAMMAR = frozenset("the a an is are was were we you it this that to of and for in will have".split())


def normalize_language(language: str) -> str:
    normalized = str(language or "").strip().lower()
    if normalized not in _INSTRUCTIONS:
        raise ValueError("Unsupported transcription language")
    return normalized


class TranscriptionLanguageError(RuntimeError):
    def __init__(self, language: str, start_seconds: float | None = None):
        self.language = normalize_language(language)
        self.start_seconds = start_seconds
        position = ""
        if start_seconds is not None:
            seconds = max(0, int(start_seconds))
            position = f" [{seconds // 60:02d}:{seconds % 60:02d}]"
        super().__init__(_ERRORS[self.language] + position)


def language_instruction(language: str) -> str:
    return _INSTRUCTIONS[normalize_language(language)]


def language_prompt(language: str, context: str = "", *, retry: bool = False, max_chars: int = 1200) -> str:
    language = normalize_language(language)
    prefix = language_instruction(language)
    if retry:
        prefix += "\n" + _RETRY[language]
    context = (context or "").strip()
    budget = max(0, max_chars - len(prefix) - 1)
    if len(context) > budget:
        # Keep both opening instructions and the latest previous-chunk context.
        half = max(0, (budget - 5) // 2)
        context = context[:half] + "\n...\n" + context[-half:] if half else ""
    return prefix + ("\n" + context if context else "")


def language_mismatch(text: str, language: str) -> bool:
    """Flag sentence-sized script drift, not isolated foreign names or acronyms.

    This is a retry signal, not proof of hallucination or a language classifier.
    Real mixed-language recordings may also trigger it and must not be filtered.
    """
    language = normalize_language(language)
    text = unicodedata.normalize("NFC", text or "")
    text = re.sub(r"https?://\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]+", "", text)
    for sentence in re.split(r"[.!?。！？\n]+", text):
        hangul = re.findall(r"[가-힣]+", sentence)
        kana = re.findall(r"[ぁ-ゖァ-ヺー]", sentence)
        han = re.findall(r"[一-鿿]", sentence)
        if language != "ko" and (len(hangul) >= 3 or sum(map(len, hangul)) >= 12):
            return True
        if language != "ja" and (len(kana) >= 8 or len(han) >= 12):
            return True
        if language == "en":
            continue
        # Inspect runs within a sentence so a long Korean paragraph cannot hide English drift.
        for run in re.findall(r"[A-Za-z][A-Za-z'’ ,;:\-]*", sentence):
            words = re.findall(r"[A-Za-z]+(?:['’][A-Za-z]+)?", run)
            lower_count = sum(word[0].islower() for word in words)
            grammar_count = sum(word.lower() in _ENGLISH_GRAMMAR for word in words)
            if len(words) >= 5 and (lower_count >= 3 or grammar_count >= 2):
                return True
            if len(words) >= 3 and lower_count >= len(words) - 1 and grammar_count:
                return True
    return False


def language_retry_preserves_content(source: str, candidate: str, language: str) -> bool:
    """A language retry cannot 'fix' a mixed result by dropping its valid content."""
    pattern = {"ko": r"[가-힣]", "ja": r"[ぁ-ゖァ-ヺー一-鿿]", "en": r"[A-Za-z]"}[normalize_language(language)]
    original = "".join(re.findall(pattern, unicodedata.normalize("NFC", source))).lower()
    replacement = "".join(re.findall(pattern, unicodedata.normalize("NFC", candidate))).lower()
    if len(original) < 30:
        return True
    # Linear-time coverage check, including occurrence counts for real repetitions.
    source_grams = Counter(original[i:i + 3] for i in range(len(original) - 2))
    candidate_grams = Counter(replacement[i:i + 3] for i in range(len(replacement) - 2))
    matched = sum((source_grams & candidate_grams).values())
    return matched / sum(source_grams.values()) >= 0.75

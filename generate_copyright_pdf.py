#!/usr/bin/env python3
"""
mallog24 소프트웨어 저작권 등록용 소스코드 PDF 생성 스크립트

사용법:
  1. 이 파일을 mallog24 프로젝트 최상위 폴더에 복사
  2. pip install fpdf2 (설치 안 되어 있다면)
  3. python generate_copyright_pdf.py
  4. 생성된 mallog24_v1.0.0_소스코드.pdf 를 CROS에 업로드

설명:
  - 프로젝트의 핵심 소스코드 파일을 자동 수집
  - 앞 30페이지 + 뒤 30페이지 형태로 PDF 생성
  - 총 60페이지 이내로 구성 (CROS 제출 기준)
"""

import argparse
import os
import sys
from pathlib import Path

try:
    from fpdf import FPDF
    HAS_FPDF = True
except Exception:
    # dry-run 모드에서는 fpdf2 없이도 동작할 수 있게 지연 처리
    FPDF = object
    HAS_FPDF = False


# ============================================================
# 🔧 설정 - 필요에 따라 수정하세요
# ============================================================

SCRIPT_DIR = Path(__file__).resolve().parent

# 프로그램 정보 (표지에 표시)
PROGRAM_NAME = "mallog24 AI 녹취록 자동 생성 시스템"
PROGRAM_NAME_EN = "mallog24 AI Transcription System"
PROGRAM_VERSION = "1.0.0"
COPYRIGHT_HOLDER = "김현우"  # ← 본인 이름으로 변경하세요
CREATION_DATE = "2026년 2월 5일"  # ← 최초 커밋일로 변경하세요

# 출력 파일명
OUTPUT_FILENAME = "mallog24_v1.0.0_소스코드.pdf"

# 소스코드 파일 확장자
SOURCE_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".yaml", ".yml",
    ".sh", ".sql", ".html", ".css"
}
SOURCE_FILENAME_SUFFIXES = {
    ".env.example",
}
SOURCE_EXACT_FILENAMES = {
    "dockerfile", "requirements.txt", "render.yaml", "railway.json",
    "app.json", "babel.config.js", "metro.config.js",
}

# 제외할 디렉토리
EXCLUDE_DIRS = {
    "node_modules", ".git", "__pycache__", ".expo", ".gradle",
    "build", "dist", "android/app/build", "ios/Pods",
    ".next", "venv", "env", ".venv", "coverage",
    "android/build", "ios/build", ".idea", ".vscode", "debug_venv",
    "transcripts", "assets", "store-graphics"
}

# 제외할 파일 패턴
EXCLUDE_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "Podfile.lock", "Gemfile.lock", ".DS_Store",
    "generate_copyright_pdf.py",  # 이 스크립트 자체 제외
    OUTPUT_FILENAME,
}

# 우선 포함할 파일 패턴 (핵심 로직이 담긴 파일을 먼저 배치)
# 리스트 순서대로 우선 배치됩니다 (부분 일치)
PRIORITY_PATTERNS = [
    # mallog24 현재 구조 핵심 파일
    "backend/main.py",
    "backend/church_terms.py",
    "backend/sql",
    "frontend/pages/index.js",
    "frontend/pages/en.js",
    "mobile/app.js",
    # 백엔드 핵심 로직
    # 백엔드 핵심 로직
    "transcri",       # transcription, transcribe 등
    "whisper",        # whisper 관련
    "gemini",         # gemini 관련
    "pipeline",       # 파이프라인
    "domain",         # 도메인 사전
    "dictionary",     # 사전
    "correct",        # 교정 로직
    "process",        # 처리 로직
    "convert",        # 변환 로직
    "sermon",         # 설교 관련
    "meeting",        # 회의 관련
    "medical",        # 의료 관련
    "summary",        # 요약 관련
    "main.py",        # 메인 서버
    "app.py",         # 앱 서버
    "server",         # 서버
    "api",            # API
    "route",          # 라우터
    # 프론트엔드 핵심 화면
    "Screen",         # React Native 화면
    "screen",
    "Convert",        # 변환 화면
    "Result",         # 결과 화면
    "History",        # 히스토리
    "Record",         # 기록
    "Auth",           # 인증
    "Login",          # 로그인
    "App.js",         # 앱 진입점
    "App.tsx",
    "index.js",       # 인덱스
    "config",         # 설정
]

# 페이지 설정
LINES_PER_PAGE = 55  # A4 기준 한 페이지당 줄 수
MAX_CHARS_PER_LINE = 95  # 한 줄 최대 글자 수
TOTAL_TARGET_PAGES = 60  # 목표 총 페이지 (앞 30 + 뒤 30)


# ============================================================
# 코드 수집
# ============================================================

def _is_source_file(path: Path) -> bool:
    name = path.name.lower()
    rel = path.as_posix().lower()

    # 민감한 환경변수 파일 제외 (.env.example만 허용)
    if name.startswith(".env") and name != ".env.example":
        return False

    if name in SOURCE_EXACT_FILENAMES:
        return True

    if any(name.endswith(suffix) for suffix in SOURCE_FILENAME_SUFFIXES):
        return True

    if path.suffix.lower() in SOURCE_EXTENSIONS:
        return True

    # path 기준 suffix 매칭 (예: backend/.env.example)
    return any(rel.endswith(suffix) for suffix in SOURCE_FILENAME_SUFFIXES)

def collect_source_files(root_dir: str) -> list[tuple[str, str]]:
    """소스코드 파일들을 수집하고 우선순위 정렬"""
    files = []
    root = Path(root_dir).resolve()

    for path in sorted(root.rglob("*")):
        # 디렉토리 제외
        if any(exc in path.parts for exc in EXCLUDE_DIRS):
            continue
        # 파일만
        if not path.is_file():
            continue
        # 확장자/파일명 필터
        if not _is_source_file(path):
            continue
        # 제외 파일
        if path.name in EXCLUDE_FILES:
            continue
        # 너무 큰 파일 제외 (500KB 이상)
        if path.stat().st_size > 500_000:
            continue

        rel_path = path.relative_to(root).as_posix()
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        if content.strip():
            files.append((rel_path, content))

    # 우선순위 정렬
    def priority_score(item):
        path_lower = item[0].lower()
        for i, pattern in enumerate(PRIORITY_PATTERNS):
            if pattern.lower() in path_lower:
                return i
        return len(PRIORITY_PATTERNS) + 1  # 우선순위 없는 파일은 뒤로

    files.sort(key=priority_score)
    return files


def format_source_lines(files: list[tuple[str, str]]) -> list[str]:
    """소스 파일들을 줄 단위 리스트로 변환"""
    lines = []
    for rel_path, content in files:
        # 파일 구분 헤더
        lines.append("")
        lines.append(f"{'=' * 70}")
        lines.append(f"  FILE: {rel_path}")
        lines.append(f"{'=' * 70}")
        lines.append("")

        for line in content.splitlines():
            # 긴 줄은 잘라서 여러 줄로
            if len(line) > MAX_CHARS_PER_LINE:
                while len(line) > MAX_CHARS_PER_LINE:
                    lines.append(line[:MAX_CHARS_PER_LINE])
                    line = "    " + line[MAX_CHARS_PER_LINE:]  # 들여쓰기로 이어짐 표시
                lines.append(line)
            else:
                lines.append(line)

    return lines


def select_pages(all_lines: list[str], lines_per_page: int, target_pages: int) -> list[str]:
    """앞 30페이지 + 뒤 30페이지 선택"""
    total_lines = len(all_lines)
    target_lines = target_pages * lines_per_page
    if total_lines <= target_lines:
        # 전체가 목표 페이지 이내면 그대로 사용
        return all_lines

    # 구분선 줄 수를 고려해 앞/뒤 수록 줄 수를 계산
    # (구분선 문자열은 아래에서 front/back 줄 수 계산 후 생성)
    separator_line_count = 9
    source_budget = max(0, target_lines - separator_line_count)
    if source_budget <= 0:
        return all_lines[:target_lines]

    front_lines = source_budget // 2
    back_lines = source_budget - front_lines
    front = all_lines[:front_lines]
    back = all_lines[-back_lines:]

    separator = [
        "",
        "",
        "=" * 70,
        "",
        f"  ... 중간 생략 (총 {total_lines}줄 중 앞 {front_lines}줄 + 뒤 {back_lines}줄 수록) ...",
        "",
        "=" * 70,
        "",
        "",
    ]

    return front + separator + back


# ============================================================
# PDF 생성
# ============================================================

class SourceCodePDF(FPDF):
    """소스코드 PDF 생성 클래스"""

    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=20)

    def setup_fonts(self):
        """한글 지원 폰트 설정"""
        # 시스템에서 한글 폰트 찾기
        font_candidates = [
            # macOS
            "/System/Library/Fonts/AppleSDGothicNeo.ttc",
            "/Library/Fonts/AppleGothic.ttf",
            "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
            # Linux
            "/usr/share/fonts/truetype/nanum/NanumGothicCoding.ttf",
            "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
            "/usr/share/fonts/nanum/NanumGothicCoding.ttf",
            # Windows
            "C:/Windows/Fonts/malgun.ttf",
            "C:/Windows/Fonts/gulim.ttc",
        ]

        font_found = False
        for font_path in font_candidates:
            if os.path.exists(font_path):
                try:
                    self.add_font("Korean", "", font_path, uni=True)
                    self.add_font("Korean", "B", font_path, uni=True)
                    font_found = True
                    print(f"  한글 폰트 로드: {font_path}")
                    break
                except Exception:
                    continue

        if not font_found:
            # NanumGothicCoding 다운로드 시도
            print("  한글 폰트를 찾을 수 없습니다. NanumGothicCoding 다운로드 시도...")
            try:
                import urllib.request
                import zipfile
                import tempfile

                url = "https://github.com/naver/nanumfont/releases/download/VER2.5/NanumGothicCoding-2.5.zip"
                tmp_dir = tempfile.mkdtemp()
                zip_path = os.path.join(tmp_dir, "nanum.zip")
                urllib.request.urlretrieve(url, zip_path)

                with zipfile.ZipFile(zip_path, "r") as z:
                    z.extractall(tmp_dir)

                for f in Path(tmp_dir).rglob("*.ttf"):
                    if "NanumGothicCoding" in f.name and "Bold" not in f.name:
                        self.add_font("Korean", "", str(f), uni=True)
                        self.add_font("Korean", "B", str(f), uni=True)
                        font_found = True
                        print(f"  폰트 다운로드 완료: {f.name}")
                        break
            except Exception as e:
                print(f"  폰트 다운로드 실패: {e}")

        if not font_found:
            print("  ⚠️  한글 폰트를 찾을 수 없어 기본 폰트를 사용합니다.")
            print("     한글이 깨질 수 있습니다.")
            print("     NanumGothicCoding.ttf를 이 스크립트와 같은 폴더에 넣어주세요.")
            # 로컬 폰트 파일 확인
            local_fonts = list(SCRIPT_DIR.glob("*.ttf")) + list(SCRIPT_DIR.glob("*.ttc"))
            if local_fonts:
                try:
                    self.add_font("Korean", "", str(local_fonts[0]), uni=True)
                    self.add_font("Korean", "B", str(local_fonts[0]), uni=True)
                    font_found = True
                    print(f"  로컬 폰트 사용: {local_fonts[0]}")
                except Exception:
                    pass

        return font_found

    def add_cover_page(self):
        """표지 페이지"""
        self.add_page()
        self.ln(60)

        self.set_font("Korean", "B", 22)
        self.cell(0, 15, "프로그램 저작권 등록 신청", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(5)

        self.set_font("Korean", "B", 16)
        self.cell(0, 12, "소스코드 제출물", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(20)

        self.set_font("Korean", "", 14)
        info_lines = [
            f"프로그램명(국문): {PROGRAM_NAME}",
            f"프로그램명(영문): {PROGRAM_NAME_EN}",
            f"버전: {PROGRAM_VERSION}",
            f"창작연월일: {CREATION_DATE}",
            f"저작권자: {COPYRIGHT_HOLDER}",
        ]
        for line in info_lines:
            self.cell(0, 10, line, align="C", new_x="LMARGIN", new_y="NEXT")

        self.ln(30)
        self.set_font("Korean", "", 11)
        self.cell(0, 8, "본 문서는 프로그램 저작권 등록을 위한 소스코드 제출물입니다.", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 8, "소스코드의 앞부분과 뒷부분을 발췌하여 수록하였습니다.", align="C", new_x="LMARGIN", new_y="NEXT")

    def add_toc_page(self, files: list[tuple[str, str]]):
        """파일 목록 (목차) 페이지"""
        self.add_page()
        self.set_font("Korean", "B", 14)
        self.cell(0, 12, "수록 파일 목록", align="L", new_x="LMARGIN", new_y="NEXT")
        self.ln(5)

        self.set_font("Korean", "", 9)
        for i, (rel_path, content) in enumerate(files, 1):
            line_count = len(content.splitlines())
            text = f"{i:3d}. {rel_path}  ({line_count}줄)"
            self.cell(0, 5.5, text, new_x="LMARGIN", new_y="NEXT")

            if self.get_y() > 270:
                self.add_page()
                self.set_font("Korean", "", 9)

    def add_source_pages(self, lines: list[str], font_available: bool):
        """소스코드 페이지"""
        self.add_page()

        if font_available:
            self.set_font("Korean", "", 7.5)
        else:
            self.set_font("Courier", "", 7)

        line_height = 3.8
        for line in lines:
            # 탭을 스페이스로 변환
            line = line.replace("\t", "    ")

            # 파일 구분선은 굵게
            if line.startswith("=" * 30):
                if font_available:
                    self.set_font("Korean", "B", 8)
                else:
                    self.set_font("Courier", "B", 7.5)
                self.cell(0, line_height, line[:MAX_CHARS_PER_LINE], new_x="LMARGIN", new_y="NEXT")
                if font_available:
                    self.set_font("Korean", "", 7.5)
                else:
                    self.set_font("Courier", "", 7)
            elif line.strip().startswith("FILE:"):
                if font_available:
                    self.set_font("Korean", "B", 8.5)
                else:
                    self.set_font("Courier", "B", 8)
                self.cell(0, line_height + 0.5, line, new_x="LMARGIN", new_y="NEXT")
                if font_available:
                    self.set_font("Korean", "", 7.5)
                else:
                    self.set_font("Courier", "", 7)
            elif "중간 생략" in line:
                if font_available:
                    self.set_font("Korean", "B", 11)
                else:
                    self.set_font("Courier", "B", 10)
                self.ln(5)
                self.cell(0, 8, line.strip(), align="C", new_x="LMARGIN", new_y="NEXT")
                self.ln(5)
                if font_available:
                    self.set_font("Korean", "", 7.5)
                else:
                    self.set_font("Courier", "", 7)
            else:
                # 일반 코드 줄
                # 인코딩 안 되는 문자 제거
                safe_line = line.encode("latin-1", errors="replace").decode("latin-1") if not font_available else line
                try:
                    self.cell(0, line_height, safe_line, new_x="LMARGIN", new_y="NEXT")
                except Exception:
                    self.cell(0, line_height, line.encode("ascii", errors="replace").decode("ascii"), new_x="LMARGIN", new_y="NEXT")

    def footer(self):
        """페이지 번호"""
        self.set_y(-15)
        self.set_font("Helvetica", "", 8)
        self.cell(0, 10, f"- {self.page_no()} -", align="C")


def main():
    parser = argparse.ArgumentParser(
        description="mallog24 저작권 등록용 소스코드 PDF 생성기"
    )
    parser.add_argument(
        "--root",
        default=str(SCRIPT_DIR),
        help="프로젝트 루트 경로 (기본값: 스크립트 위치)",
    )
    parser.add_argument(
        "--output",
        default=OUTPUT_FILENAME,
        help=f"출력 PDF 파일명 또는 경로 (기본값: {OUTPUT_FILENAME})",
    )
    parser.add_argument(
        "--target-pages",
        type=int,
        default=TOTAL_TARGET_PAGES,
        help=f"소스코드 목표 페이지 수 (기본값: {TOTAL_TARGET_PAGES})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="PDF를 만들지 않고 수집 결과만 확인",
    )
    args = parser.parse_args()

    print()
    print("=" * 60)
    print("  mallog24 소프트웨어 저작권 등록용 소스코드 PDF 생성")
    print("=" * 60)
    print()

    # 프로젝트 루트 확인
    root_dir = Path(args.root).resolve()
    if not root_dir.exists() or not root_dir.is_dir():
        print(f"❌ 잘못된 루트 경로입니다: {root_dir}")
        sys.exit(1)

    expected_dirs = ("backend", "frontend", "mobile")
    missing_dirs = [d for d in expected_dirs if not (root_dir / d).exists()]
    if missing_dirs:
        print(f"⚠️  다음 핵심 디렉토리를 찾지 못했습니다: {', '.join(missing_dirs)}")
        print(f"   현재 루트: {root_dir}")
        print("   --root 옵션으로 프로젝트 최상위 경로를 지정해 주세요.")

    # 1. 소스코드 수집
    print("[1/4] 소스코드 파일 수집 중...")
    files = collect_source_files(str(root_dir))
    print(f"  → {len(files)}개 파일 발견")

    if not files:
        print("❌ 소스코드 파일을 찾을 수 없습니다.")
        print("   --root 경로와 제외 규칙(EXCLUDE_DIRS)을 확인해주세요.")
        sys.exit(1)

    # 상위 20개 파일 미리보기
    print("\n  [우선순위 상위 파일]")
    for i, (path, _) in enumerate(files[:20], 1):
        print(f"  {i:3d}. {path}")
    if len(files) > 20:
        print(f"  ... 외 {len(files) - 20}개")

    # 2. 줄 단위 변환
    print("\n[2/4] 소스코드 포맷팅 중...")
    all_lines = format_source_lines(files)
    total_pages_estimate = max(1, (len(all_lines) + LINES_PER_PAGE - 1) // LINES_PER_PAGE)
    print(f"  → 총 {len(all_lines)}줄 (약 {total_pages_estimate}페이지 분량)")

    # 3. 앞 30 + 뒤 30 선택
    print("\n[3/4] 앞 30페이지 + 뒤 30페이지 선택...")
    target_pages = max(2, int(args.target_pages))
    selected_lines = select_pages(all_lines, LINES_PER_PAGE, target_pages)
    selected_pages = max(1, (len(selected_lines) + LINES_PER_PAGE - 1) // LINES_PER_PAGE)
    print(f"  → {len(selected_lines)}줄 선택 (약 {selected_pages}페이지)")
    print(f"  → 루트 경로: {root_dir}")

    output_path = Path(args.output).expanduser()
    if not output_path.is_absolute():
        output_path = root_dir / output_path

    if args.dry_run:
        print("\n[dry-run] PDF 생성은 생략했습니다.")
        print(f"[dry-run] 예정 출력 파일: {output_path}")
        return

    if not HAS_FPDF:
        print("\n❌ fpdf2 패키지가 설치되어 있지 않아 PDF를 생성할 수 없습니다.")
        print("   설치 후 다시 실행해주세요:")
        print(f"   {sys.executable} -m pip install fpdf2")
        print("   (시스템 파이썬 제한이 있으면 가상환경에서 실행 권장)")
        sys.exit(1)

    # 4. PDF 생성
    print("\n[4/4] PDF 생성 중...")
    pdf = SourceCodePDF()
    font_ok = pdf.setup_fonts()

    # 표지
    pdf.add_cover_page()

    # 파일 목록
    pdf.add_toc_page(files)

    # 소스코드
    pdf.add_source_pages(selected_lines, font_ok)

    # 저장
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_path))
    file_size = os.path.getsize(output_path) / 1024 / 1024

    print()
    print("=" * 60)
    print(f"  ✅ 생성 완료: {output_path}")
    print(f"  📄 총 {pdf.page_no()}페이지, {file_size:.1f}MB")
    print("=" * 60)
    print()
    print("  다음 단계:")
    print(f"  1. {output_path} 파일을 열어 내용을 확인하세요")
    print("  2. 표지의 저작권자명과 창작연월일을 확인하세요")
    print("  3. CROS(www.cros.or.kr)에서 프로그램 등록 신청 시 첨부하세요")
    print()

    # 개인정보 경고
    if COPYRIGHT_HOLDER == "___________":
        print("  ⚠️  표지의 저작권자명이 비어있습니다!")
        print("     스크립트 상단의 COPYRIGHT_HOLDER를 본인 이름으로 변경 후")
        print("     다시 실행하세요.")
        print()


if __name__ == "__main__":
    main()

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/mobile/store-graphics"
ICON_PATH="$ROOT_DIR/mobile/assets/icon.png"
FONT_PATH="/System/Library/Fonts/AppleSDGothicNeo.ttc"

if [[ ! -f "$ICON_PATH" ]]; then
  echo "missing icon: $ICON_PATH" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

ffmpeg -y \
  -f lavfi -i "color=c=#0f1728:s=1024x500:d=1" \
  -i "$ICON_PATH" \
  -filter_complex "[0:v]drawbox=x=0:y=0:w=1024:h=500:color=#0f1728:t=fill,drawbox=x=0:y=0:w=1024:h=500:color=#17315a@0.55:t=fill,drawbox=x=52:y=86:w=630:h=328:color=#101f38@0.82:t=fill,drawtext=fontfile=${FONT_PATH}:text='mallog24':fontsize=92:fontcolor=white:x=86:y=126,drawtext=fontfile=${FONT_PATH}:text='AI 음성 기록 · 전사 · 요약':fontsize=38:fontcolor=#c6d5f3:x=90:y=252,drawtext=fontfile=${FONT_PATH}:text='설교 · 통화 · 회의를 정확하게 기록하세요':fontsize=30:fontcolor=#9db7ea:x=90:y=312[bg];[1:v]scale=196:196[icon];[bg][icon]overlay=770:152" \
  -frames:v 1 \
  -update 1 \
  "$OUT_DIR/feature-graphic-google-play-1024x500.png"

ffmpeg -y \
  -f lavfi -i "color=c=#0f1728:s=1080x1920:d=1" \
  -i "$ICON_PATH" \
  -filter_complex "[0:v]drawbox=x=0:y=0:w=1080:h=1920:color=#0f1728:t=fill,drawbox=x=0:y=0:w=1080:h=580:color=#17315a@0.6:t=fill,drawbox=x=56:y=620:w=968:h=1220:color=#101f38@0.88:t=fill,drawbox=x=96:y=760:w=888:h=104:color=#244779@0.95:t=fill,drawbox=x=96:y=894:w=888:h=104:color=#1f3f6e@0.95:t=fill,drawbox=x=96:y=1028:w=888:h=104:color=#1b365f@0.95:t=fill,drawtext=fontfile=${FONT_PATH}:text='AI 음성 기록 시작':fontsize=74:fontcolor=white:x=72:y=172,drawtext=fontfile=${FONT_PATH}:text='Google · Kakao 로그인 지원':fontsize=42:fontcolor=#c6d5f3:x=74:y=280,drawtext=fontfile=${FONT_PATH}:text='빠르게 로그인하고 전사를 시작하세요':fontsize=34:fontcolor=#d6e2fb:x=74:y=344,drawtext=fontfile=${FONT_PATH}:text='로그인':fontsize=46:fontcolor=white:x=130:y=788,drawtext=fontfile=${FONT_PATH}:text='이메일 로그인 또는 소셜 로그인':fontsize=34:fontcolor=#d6e2fb:x=130:y=920,drawtext=fontfile=${FONT_PATH}:text='1초 만에 시작하는 AI 음성 기록':fontsize=34:fontcolor=#9db7ea:x=130:y=1055,drawtext=fontfile=${FONT_PATH}:text='mallog24':fontsize=30:fontcolor=#c6d5f3:x=840:y=1848[bg];[1:v]scale=112:112[icon];[bg][icon]overlay=856:70" \
  -frames:v 1 \
  -update 1 \
  "$OUT_DIR/screenshot-01-login-1080x1920.png"

ffmpeg -y \
  -f lavfi -i "color=c=#0f1728:s=1080x1920:d=1" \
  -i "$ICON_PATH" \
  -filter_complex "[0:v]drawbox=x=0:y=0:w=1080:h=1920:color=#0f1728:t=fill,drawbox=x=0:y=0:w=1080:h=580:color=#16345f@0.62:t=fill,drawbox=x=56:y=620:w=968:h=1220:color=#101f38@0.88:t=fill,drawbox=x=96:y=760:w=888:h=220:color=#1c3966@0.95:t=fill,drawbox=x=96:y=1010:w=420:h=90:color=#2e63ad@0.96:t=fill,drawbox=x=548:y=1010:w=436:h=90:color=#203e68@0.96:t=fill,drawbox=x=96:y=1132:w=888:h=610:color=#13284c@0.95:t=fill,drawtext=fontfile=${FONT_PATH}:text='파일 업로드 및 변환':fontsize=70:fontcolor=white:x=72:y=172,drawtext=fontfile=${FONT_PATH}:text='100MB 이하 오디오 파일 지원':fontsize=40:fontcolor=#c6d5f3:x=74:y=278,drawtext=fontfile=${FONT_PATH}:text='유형 선택 후 변환을 시작하세요':fontsize=34:fontcolor=#d6e2fb:x=74:y=340,drawtext=fontfile=${FONT_PATH}:text='파일 선택 완료 · 58분':fontsize=40:fontcolor=white:x=130:y=825,drawtext=fontfile=${FONT_PATH}:text='변환 시작':fontsize=34:fontcolor=white:x=235:y=1066,drawtext=fontfile=${FONT_PATH}:text='설교 / 통화 / 회의':fontsize=34:fontcolor=#d6e2fb:x=634:y=1066,drawtext=fontfile=${FONT_PATH}:text='AI 전사 결과 미리보기':fontsize=34:fontcolor=#c6d5f3:x=130:y=1188,drawtext=fontfile=${FONT_PATH}:text='mallog24':fontsize=30:fontcolor=#c6d5f3:x=840:y=1848[bg];[1:v]scale=112:112[icon];[bg][icon]overlay=856:70" \
  -frames:v 1 \
  -update 1 \
  "$OUT_DIR/screenshot-02-upload-transcribe-1080x1920.png"

ffmpeg -y \
  -f lavfi -i "color=c=#0f1728:s=1080x1920:d=1" \
  -i "$ICON_PATH" \
  -filter_complex "[0:v]drawbox=x=0:y=0:w=1080:h=1920:color=#0f1728:t=fill,drawbox=x=0:y=0:w=1080:h=580:color=#17315a@0.62:t=fill,drawbox=x=56:y=620:w=968:h=1220:color=#101f38@0.88:t=fill,drawbox=x=96:y=760:w=888:h=90:color=#2a5ca1@0.95:t=fill,drawbox=x=96:y=876:w=888:h=760:color=#122745@0.95:t=fill,drawbox=x=96:y=1662:w=888:h=84:color=#1f3f6e@0.95:t=fill,drawtext=fontfile=${FONT_PATH}:text='유형별 요약 생성':fontsize=72:fontcolor=white:x=72:y=172,drawtext=fontfile=${FONT_PATH}:text='설교 · 통화 · 회의 맞춤 요약':fontsize=40:fontcolor=#c6d5f3:x=74:y=278,drawtext=fontfile=${FONT_PATH}:text='핵심만 빠르게 확인하세요':fontsize=34:fontcolor=#d6e2fb:x=74:y=340,drawtext=fontfile=${FONT_PATH}:text='통화 기록 요약 생성':fontsize=34:fontcolor=white:x=130:y=783,drawtext=fontfile=${FONT_PATH}:text='요약 결과':fontsize=34:fontcolor=#c6d5f3:x=130:y=936,drawtext=fontfile=${FONT_PATH}:text='화자별 핵심 대화와 후속 액션 정리':fontsize=32:fontcolor=#d6e2fb:x=130:y=1010,drawtext=fontfile=${FONT_PATH}:text='요약 저장 및 공유':fontsize=34:fontcolor=white:x=130:y=1712,drawtext=fontfile=${FONT_PATH}:text='mallog24':fontsize=30:fontcolor=#c6d5f3:x=840:y=1848[bg];[1:v]scale=112:112[icon];[bg][icon]overlay=856:70" \
  -frames:v 1 \
  -update 1 \
  "$OUT_DIR/screenshot-03-summary-1080x1920.png"

ffmpeg -y \
  -f lavfi -i "color=c=#0f1728:s=1080x1920:d=1" \
  -i "$ICON_PATH" \
  -filter_complex "[0:v]drawbox=x=0:y=0:w=1080:h=1920:color=#0f1728:t=fill,drawbox=x=0:y=0:w=1080:h=580:color=#18345e@0.62:t=fill,drawbox=x=56:y=620:w=968:h=1220:color=#101f38@0.88:t=fill,drawbox=x=96:y=760:w=888:h=500:color=#142a4c@0.95:t=fill,drawbox=x=96:y=1290:w=888:h=90:color=#2a5ca1@0.96:t=fill,drawbox=x=96:y=1408:w=286:h=90:color=#244979@0.96:t=fill,drawbox=x=397:y=1408:w=286:h=90:color=#1f3f6e@0.96:t=fill,drawbox=x=698:y=1408:w=286:h=90:color=#1a365f@0.96:t=fill,drawtext=fontfile=${FONT_PATH}:text='기록본 저장 및 공유':fontsize=70:fontcolor=white:x=72:y=172,drawtext=fontfile=${FONT_PATH}:text='TXT · DOCX · 클립보드 지원':fontsize=40:fontcolor=#c6d5f3:x=74:y=278,drawtext=fontfile=${FONT_PATH}:text='업무에 바로 붙여넣어 재활용':fontsize=34:fontcolor=#d6e2fb:x=74:y=340,drawtext=fontfile=${FONT_PATH}:text='회의 중요 키워드 / 진료 도움 기록 / 설교 핵심 요약':fontsize=28:fontcolor=#d6e2fb:x=130:y=818,drawtext=fontfile=${FONT_PATH}:text='기록본 생성 및 저장':fontsize=34:fontcolor=white:x=130:y=1348,drawtext=fontfile=${FONT_PATH}:text='클립보드 복사':fontsize=28:fontcolor=white:x=162:y=1468,drawtext=fontfile=${FONT_PATH}:text='TXT 저장/공유':fontsize=28:fontcolor=white:x=462:y=1468,drawtext=fontfile=${FONT_PATH}:text='DOCX 저장/공유':fontsize=28:fontcolor=white:x=753:y=1468,drawtext=fontfile=${FONT_PATH}:text='mallog24':fontsize=30:fontcolor=#c6d5f3:x=840:y=1848[bg];[1:v]scale=112:112[icon];[bg][icon]overlay=856:70" \
  -frames:v 1 \
  -update 1 \
  "$OUT_DIR/screenshot-04-record-export-1080x1920.png"

ffmpeg -y \
  -f lavfi -i "color=c=#0f1728:s=1080x1920:d=1" \
  -i "$ICON_PATH" \
  -filter_complex "[0:v]drawbox=x=0:y=0:w=1080:h=1920:color=#0f1728:t=fill,drawbox=x=0:y=0:w=1080:h=580:color=#17315a@0.62:t=fill,drawbox=x=56:y=620:w=968:h=1220:color=#101f38@0.88:t=fill,drawbox=x=96:y=760:w=888:h=190:color=#1c3966@0.95:t=fill,drawbox=x=96:y=980:w=888:h=22:color=#122745@0.95:t=fill,drawbox=x=96:y=980:w=612:h=22:color=#3b78d1@0.98:t=fill,drawbox=x=96:y=1040:w=888:h=90:color=#2a5ca1@0.96:t=fill,drawbox=x=96:y=1160:w=888:h=90:color=#1f3f6e@0.96:t=fill,drawtext=fontfile=${FONT_PATH}:text='사용량 확인':fontsize=72:fontcolor=white:x=72:y=172,drawtext=fontfile=${FONT_PATH}:text='남은 시간을 한눈에 확인':fontsize=40:fontcolor=#c6d5f3:x=74:y=278,drawtext=fontfile=${FONT_PATH}:text='월간 사용량을 투명하게 관리하세요':fontsize=34:fontcolor=#d6e2fb:x=74:y=340,drawtext=fontfile=${FONT_PATH}:text='이번 달 사용량: 6h 20m / 10h':fontsize=36:fontcolor=white:x=130:y=825,drawtext=fontfile=${FONT_PATH}:text='사용량 새로고침':fontsize=30:fontcolor=white:x=178:y=1100,drawtext=fontfile=${FONT_PATH}:text='mallog24':fontsize=30:fontcolor=#c6d5f3:x=840:y=1848[bg];[1:v]scale=112:112[icon];[bg][icon]overlay=856:70" \
  -frames:v 1 \
  -update 1 \
  "$OUT_DIR/screenshot-05-usage-1080x1920.png"

echo "generated store graphics in: $OUT_DIR"

"""
기독교 용어 사전 - 다락방 전도운동 특화
류광수 목사 / 이주현 목사 교회 용어 포함
+ 의료 용어 사전
"""

# ===== 1. 삼위일체 / 하나님 =====
TRINITY = [
    "하나님",
    "예수님", "예수 그리스도", "그리스도", "주님", "주 예수",
    "성령님", "성신", "보혜사",
    "성부", "성자", "성령",
    "성삼위",
    "여호와", "야훼", "엘로힘", "아도나이",
    "임마누엘", "메시아",
    "예수는 그리스도",
]

# ===== 2. 다락방 핵심 용어 (최우선) =====
DARAKBANG_CORE = [
    # 핵심 비전
    "렘넌트", "237", "5000", "237나라", "5000종족",
    "237 빛", "파송",
    
    # 7 시리즈
    "7망대", "7여정", "7이정표",
    "절대 망대", "절대 여정", "절대 이정표",
    "7포인트", "7천제자",
    "777 기도",
    "1천망대",
    "1000 RUTC",
    "7000 RT 선교사"
    
    # 단계/개념
    "오직", "유일성", "재창조", "천명", "소명", "사명",
    "보좌화", "생활화", "개인화", "제자화", "세계화",
    
    # 장소/구조
    "다락방", "미션홈", "지교회", "팀사역",
    "마가다락방", "갈보리산", "감람산",
    "드로아교회",
    
    # 특수 용어
    "홀리메이슨",
    "CVDIP",
    "Covenant",
    "Vision",
    "Dream",
    "Image",
    "Practice",
    
    # 영문 용어
    "Heavenly", "Thronely", "Eternally",
    
    # 대상
    "TCK", "CCK", "NCK",
    "렘넌트 세대",
    "렘넌트",
    
    # 영적 전쟁 용어
    "사단", "흑암", "보좌", "시공간", "전무후무",
    "3단체", "뉴에이지", "프리메이슨", "유대인", "재앙", "지옥배경",

    # 성경 관련
    "네피림", "바벨탑",

    # 행사/모임
    "성회", "전도대회", "수련회", "전도집회", "집회", "세미나"

    # 선교 지역 약어
    "REA",  # Rwanda, East Africa, Africa
    "RUTC", # Remnant Training Unity Center
    "RTS",  # Remnant Theological Seminary
    "RSTS", # Remnant Summit Training School
    "RVS",  # Remnant Vision School
    "RPS",  # Remnant Parents School
    "RLS",  # Remnant Leader School
    "RGS",  # Remnant Global School
    
    # 예배 용어
    "교독", "합독", "교독문",
]

# ===== 3. 담임목사 =====
PASTORS = [
    "류광수 목사", "류광수 목사님",
    "이주현 목사", "이주현 목사님",
    "류광수", "이주현","장승경", "이진성", "황상배", "이성훈", "백운규", "김귀숙", 
    "이흥애", "정영자", "김명자",
    "서경", "김소영", "장대원", "송미솔", "엄희숙",
]

# ===== 4. 예배 용어 =====
WORSHIP_TERMS = [
    "교독", "합독", "교독문",
    "전주", "찬송", "기도", "성경봉독",
    "설교", "말씀", "헌금", "송영", "축도", "후주",
    "개회찬송", "폐회찬송",
    "대표기도", "합심기도", "통성기도",
    "렘넌트 예배", "지교회 예배",
]

# ===== 5. 자주 틀리는 발음/표기 교정 사전 =====
COMMON_MISTAKES = {
    # 숫자 관련
    "이삼칠": "237",
    "이백삼십칠": "237",
    "오천": "5000",
    
    # 영문 음차
    "램넌트": "렘넌트",
    "레넌트": "렘넌트",
    "레므난트": "렘넌트",
    
    # 발음 유사어
    "망대": "망대",
    "칠망대": "7망대",
    "칠여정": "7여정",
    "칠이정표": "7이정표",
    
    # 영어 용어
    "헤븐리": "Heavenly",
    "쓰론리": "Thronely",
    "이터널리": "Eternally",
    
    # 띄어쓰기
    "절대망대": "절대 망대",
    "절대여정": "절대 여정",
    "절대이정표": "절대 이정표",
    
    # 일반 기독교 용어
    "부활젤": "부활절",
    "성탄젤": "성탄절",
    "하나 님": "하나님",
    "예수 님": "예수님",
    "성령 님": "성령님",

    # 음성인식 오류 교정
    "할라고": "하려고",
    "갈라고": "가려고",
    "볼라고": "보려고",
    "알라고": "알려고",
    "먹을라고": "먹으려고",
    "배심": "뱃심",
    "최상머리": "책상머리",
    "찌나는": "찐한",
    "드로우게": "드로아교회",
    "드로우게교회": "드로아교회",
    "드로에게": "드로아교회",
    "드로에게교회": "드로아교회",
    "RLTS": "RRTS",
    "알리": "REA",
    "김근이": "김건희",
    "김소현": "김소영",
    "이지훈": "이주현",
    "이지호": "이주현",
    "장현승": "장한샘",
    "이혜나": "이예나",
    "애나": "예나",
    "두구": "투구",
    "렘피림": "네피림",
    "회 버아웃이": "회복이",

    # 선교 약어
    "알이에이": "REA",
    "아르이에이": "REA",

    # 성경/역사 용어 음성인식 오류
    "아수르": "앗수르",
    "유락민": "유랑민",
    "노량민": "유랑민",

    # 역사적 인물 음성인식 오류
    "쉽어": "쉬버",
    "시버": "쉬버",
    "록펠라": "록펠러",
    "로크펠러": "록펠러",
    "워너 메이커": "워너메이커",
    "워내메이커": "워너메이커",
    "워네메이커": "워너메이커",
    "카네기아": "카네기",
    "카르네기": "카네기",
    "마틴루터": "마틴 루터",
    "마틴루터킹": "마틴 루터 킹",
}

# ===== 6. 역사적 인물 =====
HISTORICAL_PEOPLE = [
    # 미국 역사적 인물
    "록펠러", "카네기", "워너메이커", "존 워너메이커", "쉬버",
    # 종교개혁자
    "마틴 루터",
]

# ===== 7. 성경 주요 인물 =====
BIBLE_PEOPLE = [
    "아담", "이브", "노아", "아브라함", "이삭", "야곱",
    "요셉", "모세", "아론", "여호수아", "사무엘",
    "다윗", "솔로몬", "엘리야", "엘리사", "이사야", "예레미야",
    "에스겔", "다니엘", "요나",
    "마리아", "요셉", "세례 요한", "베드로", "바울",
    "요한", "야고보", "마태", "누가", "마가",
    "사드랏", "메삭", "아벳느고",
    "이스마엘", "이스르엘", "라헬", "이드로", "이새", "한나", "사라",
    "빌립", "가인", "아벨", "스데반",
]

# ===== 7. 성경 지명 =====
BIBLE_PLACES = [
    "예루살렘", "베들레헴", "나사렛", "갈릴리",
    "가나안", "애굽", "이집트", "바벨론", "앗수르",
    "갈보리산", "감람산", "시온산",
    "요단강", "홍해", "사해", "여리고", "나일강",
    "아람", "아람 나라", "로마", "마게도냐", "드로아", "아시아",

]

# ===== 8. 절기 =====
HOLIDAYS = [
    "부활절", "성탄절", "크리스마스", "추수감사절",
    "성령강림절", "사순절", "대강절",
    "고난주간", "종려주일", "성금요일",
]

# ===== 9. 신학 용어 =====
THEOLOGY = [
    "구원", "은혜", "믿음", "신앙",
    "회개", "중생", "성화", "칭의",
    "속죄", "화목", "구속",
    "영생", "천국", "지옥", "심판",
    "부활", "재림", "종말",
    "언약", "율법", "복음", "진리",
]

# ===== 10. 직분 =====
POSITIONS = [
    "목사", "목사님", "담임목사", "담임목사님",
    "장로", "장로님", "권사", "권사님",
    "집사", "집사님", "안수집사", "서리집사",
    "전도사", "전도사님",
    "사모", "사모님",
    "구역장", "순장", "셀리더", "팀장",
]

# ===== 11. 의료 기초 용어 =====
MEDICAL_BASICS = [
    # 진료/검사
    "진단", "처방", "투약", "복용", "경과 관찰", "예후", "병력", "문진",
    "촉진", "청진", "혈압", "맥박", "체온", "산소포화도", "혈당",
    "소견", "증상", "징후", "합병증", "부작용", "금기", "적응증",
    "외래", "입원", "퇴원", "전원", "회진", "협진", "의뢰",
    "수술", "시술", "마취", "전신마취", "국소마취", "봉합", "절개",
    "CT", "MRI", "X-ray", "초음파", "내시경", "조직검사", "생검",
    "혈액검사", "소변검사", "심전도", "폐기능검사",
    # 의료진
    "주치의", "전공의", "전문의", "레지던트", "인턴", "간호사", "약사",
]

# ===== 12. 주요 질병/질환 =====
MEDICAL_DISEASES = [
    # 심혈관
    "고혈압", "저혈압", "심근경색", "협심증", "심부전", "부정맥",
    "뇌졸중", "뇌경색", "뇌출혈", "동맥경화", "혈전", "색전",
    # 내분비/대사
    "당뇨병", "제1형 당뇨", "제2형 당뇨", "갑상선", "갑상선기능항진증",
    "갑상선기능저하증", "고지혈증", "이상지질혈증", "통풍", "골다공증",
    # 호흡기
    "폐렴", "천식", "기관지염", "만성폐쇄성폐질환", "COPD", "폐결핵",
    "기흉", "폐색전증", "수면무호흡증",
    # 소화기
    "위염", "위궤양", "십이지장궤양", "역류성 식도염", "과민성 대장 증후군",
    "크론병", "궤양성 대장염", "간염", "간경변", "지방간", "담석증",
    "췌장염", "맹장염", "충수염", "장폐색", "헬리코박터",
    # 비뇨기/신장
    "신부전", "만성 신장 질환", "요로감염", "신우신염", "요로결석",
    "방광염", "전립선비대증", "전립선염",
    # 근골격
    "관절염", "류마티스", "디스크", "추간판 탈출증", "척추관 협착증",
    "오십견", "건초염", "골절", "염좌", "인대 손상", "반월상 연골 손상",
    # 신경/정신
    "우울증", "불안장애", "공황장애", "불면증", "치매", "알츠하이머",
    "파킨슨병", "편두통", "신경통", "대상포진",
    # 뇌전증(간질) 관련
    "뇌전증", "간질", "간질 발작", "뇌전증 발작",
    "전신 발작", "부분 발작", "초점 발작", "국소 발작",
    "강직간대 발작", "강직 발작", "간대 발작", "결신 발작", "소발작", "대발작",
    "근간대 발작", "무긴장 발작", "긴장성 발작",
    "복합부분 발작", "단순부분 발작",
    "측두엽 뇌전증", "전두엽 뇌전증", "후두엽 뇌전증", "두정엽 뇌전증",
    "특발성 뇌전증", "증후성 뇌전증", "잠복성 뇌전증",
    "영아 연축", "웨스트 증후군", "레녹스가스토 증후군", "드라베 증후군",
    "소아 결신 뇌전증", "청소년 근간대 뇌전증", "청소년 결신 뇌전증",
    "양성 롤란딕 뇌전증", "열성 경련",
    "뇌전증 지속 상태", "간질 중첩증",
    "발작 역치", "발작 빈도", "발작 유형", "발작 조절",
    "뇌파", "뇌파검사", "EEG", "비디오 뇌파 모니터링",
    "항경련제", "항뇌전증약", "AED",
    "케톤식이", "케톤 식이요법", "미주신경자극술", "VNS",
    "뇌전증 수술", "측두엽 절제술", "뇌량 절개술",
    # 암/종양
    "위암", "폐암", "간암", "대장암", "유방암", "갑상선암", "전립선암",
    "췌장암", "식도암", "방광암", "난소암", "자궁경부암", "백혈병", "림프종",
    # 피부
    "아토피", "두드러기", "건선", "습진", "대상포진",
    # 안과/이비인후
    "백내장", "녹내장", "황반변성", "결막염", "중이염", "비염", "축농증", "편도염",
    # 감염
    "코로나", "독감", "인플루엔자", "패혈증", "대상포진", "결핵",
    # 기타
    "빈혈", "혈우병", "탈장", "치질", "하지정맥류", "갱년기", "자궁근종",
]

# ===== 13. 주요 약물/약 종류 =====
MEDICAL_DRUGS = [
    # 해열/진통/소염
    "타이레놀", "아세트아미노펜", "이부프로펜", "아스피린", "나프록센",
    "디클로페낙", "세레콕시브", "트라마돌", "코데인",
    # 항생제
    "아목시실린", "세팔로스포린", "아지스로마이신", "레보플록사신",
    "메트로니다졸", "반코마이신", "겐타마이신",
    # 심혈관
    "아스피린", "클로피도그렐", "와파린", "헤파린", "리바록사반",
    "아토르바스타틴", "로수바스타틴", "암로디핀", "니페디핀",
    "메토프롤올", "비소프롤올", "카르베딜롤",
    "로사르탄", "발사르탄", "텔미사르탄",
    "라미프릴", "에날라프릴", "캡토프릴",
    "푸로세미드", "히드로클로로티아지드", "스피로노락톤",
    "니트로글리세린",
    # 당뇨
    "메트포르민", "글리메피리드", "시타글립틴", "엠파글리플로진",
    "다파글리플로진", "인슐린", "란투스", "노보래피드",
    # 소화기
    "오메프라졸", "란소프라졸", "판토프라졸", "라베프라졸",
    "돔페리돈", "메토클로프라미드", "가스모틴",
    # 호흡기
    "살부타몰", "벤토린", "심비코트", "세레타이드", "스피리바",
    "몬테루카스트", "싱귤레어",
    # 정신/신경
    "졸피뎀", "로라제팜", "알프라졸람", "디아제팜",
    "에스시탈로프람", "설트랄린", "플루옥세틴", "벤라팍신",
    "퀘티아핀", "아리피프라졸", "리스페리돈",
    "가바펜틴", "프레가발린", "카바마제핀", "발프로산",
    # 뇌전증/항경련제
    "발프로에이트", "발프로산나트륨", "데파킨", "데파코트",
    "카바마제핀", "테그레톨", "옥스카바제핀", "트리렙탈",
    "라모트리진", "라믹탈",
    "레비티라세탐", "케프라",
    "토피라메이트", "토파맥스",
    "페니토인", "디란틴",
    "페노바르비탈", "루미날",
    "클로나제팜", "리보트릴",
    "조니사마이드", "엑세그란",
    "라코사마이드", "빔팻",
    "클로바잠", "프리지움",
    "비가바트린", "사브릴",
    "에토석시마이드", "자론틴",
    "퍼람파넬", "피콤파",
    "브리바라세탐", "브리비액트",
    "스티리펜톨", "디아코밋",
    "루피나마이드", "이노벨론",
    "센노사이드", "에피디올렉스", "칸나비디올", "CBD",
    # 갑상선
    "레보티록신", "씬지로이드", "메티마졸",
    # 스테로이드
    "프레드니솔론", "덱사메타손", "히드로코르티손",
    # 기타 상용약
    "세티리진", "로라타딘", "펙소페나딘",
    "실데나필", "타다라필",
    "알로푸리놀", "콜히친",
    "메토트렉세이트",
]

# ===== 14. 의료 용어 음성인식 오류 교정 =====
MEDICAL_CORRECTIONS = {
    # 약물명 오류
    "타이레돌": "타이레놀",
    "타이래놀": "타이레놀",
    "아세타미노펜": "아세트아미노펜",
    "이부프로팬": "이부프로펜",
    "아목시실런": "아목시실린",
    "메트폴민": "메트포르민",
    "매트포민": "메트포르민",
    "메트폴인": "메트포르민",
    "오매프라졸": "오메프라졸",
    "졸피담": "졸피뎀",
    "에스시탈로프": "에스시탈로프람",
    "프레드니소론": "프레드니솔론",
    "덱사메타선": "덱사메타손",
    "아토바스타틴": "아토르바스타틴",
    "로수바스타틴": "로수바스타틴",
    "암로디핀": "암로디핀",
    "발살탄": "발사르탄",
    "로살탄": "로사르탄",
    "시타그립틴": "시타글립틴",
    "엠파글리플로진": "엠파글리플로진",
    "인수린": "인슐린",
    "인슈린": "인슐린",

    # 질병명 오류
    "심군경색": "심근경색",
    "심급경색": "심근경색",
    "협신증": "협심증",
    "부정액": "부정맥",
    "뇌졸증": "뇌졸중",
    "뇌경색증": "뇌경색",
    "당료": "당뇨",
    "당료병": "당뇨병",
    "갑상생": "갑상선",
    "갑상생기능": "갑상선기능",
    "고지혈중": "고지혈증",
    "이상지질혈중": "이상지질혈증",
    "골다공중": "골다공증",
    "관절연": "관절염",
    "류마치스": "류마티스",
    "류머티스": "류마티스",
    "루마티스": "류마티스",
    "추간반": "추간판",
    "추간판탈출": "추간판 탈출",
    "척추관협착": "척추관 협착",
    "알츠하이마": "알츠하이머",
    "알쯔하이머": "알츠하이머",
    "파킨손": "파킨슨",
    "패현증": "패혈증",
    "패열증": "패혈증",
    "백내장증": "백내장",
    "녹내장증": "녹내장",
    "황반변정": "황반변성",
    "전립선비대": "전립선비대증",
    "전립선연": "전립선염",
    "과민성대장": "과민성 대장",
    "역류성식도": "역류성 식도",
    "만성폐쇄성": "만성폐쇄성",
    "수면무호흡": "수면무호흡증",
    "하지정맥류": "하지정맥류",
    "우울증": "우울증",
    "불안장에": "불안장애",
    "공황장에": "공황장애",

    # 뇌전증 관련 오류
    "간질발작": "간질 발작",
    "뇌전증발작": "뇌전증 발작",
    "뇌전중": "뇌전증",
    "뇌전정": "뇌전증",
    "뇌전층": "뇌전증",
    "간짐": "간질",
    "간진": "간질",
    "강직간대": "강직간대",
    "결신발작": "결신 발작",
    "소발착": "소발작",
    "대발착": "대발작",
    "항경련재": "항경련제",
    "항뇌전증약": "항뇌전증약",
    "발프로에이터": "발프로에이트",
    "발프로산나트류": "발프로산나트륨",
    "데파킹": "데파킨",
    "라모트리진": "라모트리진",
    "라모트리딘": "라모트리진",
    "라믹탈": "라믹탈",
    "래비티라세탐": "레비티라세탐",
    "레비티라세탐": "레비티라세탐",
    "캐프라": "케프라",
    "토파막스": "토파맥스",
    "토피라매이트": "토피라메이트",
    "페니토닌": "페니토인",
    "디란틴": "디란틴",
    "패노바비탈": "페노바르비탈",
    "페노발비탈": "페노바르비탈",
    "클로나재팜": "클로나제팜",
    "라코사마이트": "라코사마이드",
    "조니사마이트": "조니사마이드",
    "비가바트린": "비가바트린",
    "퍼람파넬": "퍼람파넬",
    "열성경련": "열성 경련",
    "뇌파겁사": "뇌파검사",
    "간질중첩": "간질 중첩",
    "케톤식이": "케톤 식이",
    "미주신경자극": "미주신경자극술",
    "측두엽뇌전증": "측두엽 뇌전증",
    "웨스트증후군": "웨스트 증후군",
    "레녹스가스토": "레녹스가스토 증후군",
    "드라베증후군": "드라베 증후군",

    # 의료 용어 오류
    "처방전": "처방전",
    "혈앞": "혈압",
    "형압": "혈압",
    "혈당치": "혈당치",
    "산소포하도": "산소포화도",
    "심전도검사": "심전도 검사",
    "내시경검사": "내시경 검사",
    "조직겁사": "조직검사",
    "합변증": "합병증",
    "부작융": "부작용",
    "경과관찰": "경과 관찰",
}

# ===== 통합 용어 리스트 =====
ALL_CHURCH_TERMS = (
    DARAKBANG_CORE +
    PASTORS +
    TRINITY +
    WORSHIP_TERMS +
    HISTORICAL_PEOPLE +
    BIBLE_PEOPLE +
    BIBLE_PLACES +
    HOLIDAYS +
    THEOLOGY +
    POSITIONS
)

ALL_MEDICAL_TERMS = (
    MEDICAL_BASICS +
    MEDICAL_DISEASES +
    MEDICAL_DRUGS
)

# ===== 영어 일반 STT 오류 교정 =====
EN_COMMON_CORRECTIONS = {
    # Common STT homophones / mishearings
    "their are": "there are",
    "there going": "they're going",
    "your welcome": "you're welcome",
    "could of": "could have",
    "should of": "should have",
    "would of": "would have",
    "alot": "a lot",
    "atleast": "at least",
    "incase": "in case",
    "infact": "in fact",
    "aswell": "as well",
    "thankyou": "thank you",
    "nevermind": "never mind",
    "per say": "per se",
    "for all intensive purposes": "for all intents and purposes",
    "supposably": "supposedly",
    "irregardless": "regardless",
    "expecially": "especially",
    "probly": "probably",
    "prolly": "probably",
    "gonna": "going to",
    "wanna": "want to",
    "gotta": "got to",
    "kinda": "kind of",
    "sorta": "sort of",
    "dunno": "don't know",
    "lemme": "let me",
    "gimme": "give me",
}

# ===== 영어 의료 용어 STT 오류 교정 =====
EN_MEDICAL_CORRECTIONS = {
    # Drug names
    "acetominifen": "acetaminophen",
    "acetominaphen": "acetaminophen",
    "acetaminafin": "acetaminophen",
    "ibuprofen": "ibuprofen",
    "ibuprofin": "ibuprofen",
    "amoxicilin": "amoxicillin",
    "amoxacillin": "amoxicillin",
    "metforman": "metformin",
    "metformine": "metformin",
    "omeperazole": "omeprazole",
    "omeprazol": "omeprazole",
    "insuline": "insulin",
    "levetiracitam": "levetiracetam",
    "leviteracetam": "levetiracetam",
    "carbamazapine": "carbamazepine",
    "carbamazapene": "carbamazepine",
    "valporate": "valproate",
    "valproic": "valproic",
    "lamotragine": "lamotrigine",
    "lamotrigene": "lamotrigine",
    "phenatoin": "phenytoin",
    "phenitoin": "phenytoin",
    "topiramate": "topiramate",
    "toparamate": "topiramate",
    "gabapenten": "gabapentin",
    "gabapentine": "gabapentin",
    "pregabaline": "pregabalin",
    "pregaballin": "pregabalin",
    "atorvastaten": "atorvastatin",
    "losartin": "losartan",
    "valsarten": "valsartan",
    "amlodapine": "amlodipine",
    "amlodopine": "amlodipine",

    # Disease / condition names
    "epilepsey": "epilepsy",
    "epileptic": "epileptic",
    "seisure": "seizure",
    "seizor": "seizure",
    "siezure": "seizure",
    "hypertention": "hypertension",
    "hypotention": "hypotension",
    "diabeties": "diabetes",
    "diabetis": "diabetes",
    "alzhiemers": "Alzheimer's",
    "alzheimers": "Alzheimer's",
    "parkinsons": "Parkinson's",
    "parkinsen": "Parkinson's",
    "newmonia": "pneumonia",
    "pneumona": "pneumonia",
    "artheritus": "arthritis",
    "arthritus": "arthritis",
    "astma": "asthma",
    "athsma": "asthma",
    "stroke": "stroke",
    "myocardial infraction": "myocardial infarction",
    "angena": "angina",
    "athero sclerosis": "atherosclerosis",
    "arrythmia": "arrhythmia",
    "arythmia": "arrhythmia",

    # Medical terms
    "perscription": "prescription",
    "perscribe": "prescribe",
    "diagnoses": "diagnosis",
    "prognoses": "prognosis",
    "symtoms": "symptoms",
    "symtems": "symptoms",
    "complecations": "complications",
    "side affects": "side effects",
    "anesthesia": "anesthesia",
    "anasthesia": "anesthesia",
    "surjery": "surgery",

    # Epilepsy-specific
    "tonic clonic": "tonic-clonic",
    "abscence seizure": "absence seizure",
    "absence seisure": "absence seizure",
    "myaclonic": "myoclonic",
    "mioclonic": "myoclonic",
    "electroencephalagram": "electroencephalogram",
    "electro encephalogram": "electroencephalogram",
    "vagus nerve stimulation": "vagus nerve stimulation",
    "ketogenic diet": "ketogenic diet",
    "status epileptecus": "status epilepticus",
    "status epilepticas": "status epilepticus",
    "febrile seizor": "febrile seizure",
    "febrile seisure": "febrile seizure",
    "lennox gastaut": "Lennox-Gastaut",
    "lennox gastot": "Lennox-Gastaut",
    "dravet sindrome": "Dravet syndrome",
    "drave syndrome": "Dravet syndrome",
    "west sindrome": "West syndrome",
    "temporal lob epilepsy": "temporal lobe epilepsy",
    "frontal lob epilepsy": "frontal lobe epilepsy",
}

def get_gemini_prompt():
    """
    Gemini용 시스템 프롬프트 (음성 인식 + 교정 + 구조화)
    """
    return """당신은 '류광수/이주현 목사' 계열의 다락방 전도운동 메시지 전문 속기사입니다.

[필수 용어]
237, 5000, 237나라, 5000종족, 렘넌트, 7망대, 7여정, 7이정표, CVDIP, Heavenly, Thronely, Eternally, TCK, CCK, NCK, 777, 138, 3집중, 24·25·00
(이삼칠→237, 칠칠칠→777, 오천종족→5000종족 등 숫자/영어 표기 유지)

[가장 중요한 규칙 - 완전 녹취]
- 이것은 '요약'이 아니라 '받아쓰기'이다. 설교자가 말한 모든 문장을 빠짐없이 기록하라.
- 절대로 내용을 줄이거나 생략하지 마라. 30분 설교면 30분 분량의 텍스트가 나와야 한다.
- 비슷한 내용이 반복되더라도 설교자가 실제로 반복한 것이면 그대로 반복해서 기록하라.
- 출력 길이를 줄이려 하지 마라. 길어도 된다. 전부 기록하는 것이 가장 중요하다.

[작성 규칙]
1. 설교자가 말한 내용을 들리는 그대로 전부 기록하라. 한 문장도 빠뜨리지 마라.
2. 내용을 요약·생략·재구성하지 마라. 말한 순서 그대로 받아써라.
3. 한국어 발언만 기록하라. 중국어·영어 등 통역 부분은 완전히 무시하고 건너뛰어라.
   (한국어 설교-외국어 통역이 반복되는 경우, 한국어 부분만 이어서 기록하라.)
4. 다음 추임새만 제거하되, 실제 내용이 담긴 문장은 절대 삭제하지 마라:
   - 추임새/감탄사: '아', '음', '자', '어', '예', '응', '네', '에', '그'
   - 문장 시작의 '예,', '자,', '네,' 등 습관적 추임새만 삭제하라.
   - 주의: 추임새를 제거한다고 해서 문장 자체를 생략하면 안 된다.
5. 성경 구절 번호는 "23/" 형식으로 표기하라.
6. 발음이 부정확하거나 음성인식이 이상해도, 반드시 문맥에 맞는 올바른 단어로 교정하여 기록하라.
   - 예: '이승했습니다' → '이상했습니다' (문맥상 올바른 표현)
   - 예: '낳을라고' → '나으라고' (병을 낫게 하려는 문맥)
   - 예: '할라고' → '하려고' (구어체를 자연스러운 문어체로)
   - 발음이 비슷한 단어 중 문맥에 맞는 것을 선택하라.
7. 구어체 표현은 뜻을 유지하되 자연스러운 문장으로 다듬어라.
8. 비속어/속어: '인마', '야' 등 거친 표현만 생략하라."""


def get_gemini_content_prompt():
    """
    Gemini에게 전달할 콘텐츠 프롬프트 (출력 형식 + 예시)
    """
    return """아래 오디오 파일의 설교 내용을 받아쓰되, 반드시 다음 형식으로 출력하라.

[출력 형식 규칙]
- 특수 기호(▶, ■, ● 등)를 절대 사용하지 마라. 순수 텍스트만 출력하라.
- 마크다운(##, **, - 등) 사용 금지.
- 주제가 바뀌거나 새로운 포인트로 넘어갈 때 빈 줄로 문단을 구분하라.
- 한국어-외국어 통역이 반복되는 오디오인 경우, 외국어 통역 부분은 완전히 무시하고 한국어 발언만 이어서 기록하라.

[구조화 - 반드시 지켜라]
- 설교 흐름에 따라 아래 섹션 구분자를 반드시 별도 줄에 삽입하라:
  "본론" — 서론이 끝나고 본격적인 메시지가 시작되는 지점
  "결론" — 설교의 마무리/정리 부분
  "기도" — 마지막 기도가 시작되는 지점
- 각 구분자는 해당 단어만 단독으로 한 줄에 적어라. (예: 줄 전체가 "본론"만)
- 구분자 앞뒤에 빈 줄을 넣어라.
- 설교에 서론/본론/결론/기도 구분이 명확하지 않더라도, 흐름상 가장 적절한 위치에 삽입하라.

[출력 예시]
성경말씀 로마서 16장 23절이다. 같이 합독하시겠다. 23/ 나와 온 교회를 돌보아 주는 가이오도 너희에게 문안하고 이 성의 재무관 에라스도와 형제 구아도도 너희에게 문안하느니라. 오늘 이 말씀을 함께 나누겠다.

복음문화 산업인 선교사이다. 복음 가지고 사람을 살리는 문화 산업 선교사라는 것이다. 지금 우리 산업인들이 모였다. 중요한 언약을 찾는 메시지만 받지 말고 중요한 실천할 것을 찾는 시간이 되길 바란다. 우리는 복잡하면 안 된다. 단순해야 한다.

본론
예수님이 주신 반드시 승리하는 비밀, 그때나 지금이나 동일하다. 그게 뭐냐. 행1:1-8절이다. 가이오가 이것 잡은 것이다. 이 한 가지만 붙잡으면 모든 문제가 해결된다.

두 번째로 중요한 것이 있다. 바로 현장의 언약이다. 현장에 가면 하나님이 보여주신다. 그래서 바울이 로마에 간 것이다.

결론
비밀 붙잡고 가라. 예수님이 공생애 때 하신 것 그리고 요한삼서 1장 2절에 영혼 정신 육신 강건하기를 원하노라. 이 축복이 여러분에게 있기를 바란다.

기도
하나님 감사합니다. 하나님 우리가 성경을 몰랐다면 우리가 전도자를 만나지 못했다면...

위 예시처럼 오디오의 전체 내용을 빠짐없이 받아쓰되, 주제 단위로 문단을 나누어 출력하라.

[가장 중요 - 완전 녹취]
- 이것은 요약이 아니다. 설교자가 말한 모든 내용을 빠짐없이 전부 받아써라.
- 오디오에서 들리는 모든 한국어 문장을 기록하라. 한 문장이라도 빠뜨리면 실패다.
- 출력이 길어지는 것을 두려워하지 마라. 짧게 줄이지 마라.
- 같은 말을 반복하더라도 실제로 반복한 것이면 그대로 적어라.

[추가 규칙]
1. 발음이 불명확하거나 음성인식이 부정확한 부분은 반드시 문맥을 고려하여 올바른 단어로 교정하라.
2. 추임새('예,', '자,', '아,', '어,', '응,', '네,')만 삭제하되, 실제 내용 문장은 절대 삭제하지 마라."""

def get_gemini_correction_prompt():
    """
    Gemini 텍스트 교정 전용 프롬프트 (2단계 방식)
    Whisper가 받아쓴 raw 텍스트를 교정 + 구조화하는 용도.
    오디오는 이미 텍스트로 변환된 상태이므로, 텍스트→텍스트 교정에 집중.
    """
    return """당신은 '류광수/이주현 목사' 계열 다락방 전도운동 설교 텍스트 전문 편집자입니다.

아래 [원본 텍스트]는 음성인식(STT)으로 받아쓴 설교 녹취록입니다.
이 텍스트를 교정하고 구조화하되, 반드시 아래 규칙을 따르세요.

[가장 중요한 규칙 - 내용 보존]
- 원본의 모든 문장을 빠짐없이 유지하라. 한 문장도 삭제하지 마라.
- 내용을 요약하거나 줄이지 마라. 원본 길이와 비슷하게 출력하라.
- 비슷한 내용이 반복되더라도 원본에 있으면 그대로 유지하라.
- 출력이 길어도 괜찮다. 짧게 줄이려 하지 마라.

[저음질/불명확한 음성 대응 - 반드시 적용]
- 원본 텍스트에 의미 없는 글자 나열, 깨진 단어, 알 수 없는 음절이 있으면 반드시 문맥을 분석하여 올바른 단어로 추정·복원하라.
- 앞뒤 문장의 맥락, 주제, 화자의 의도를 종합하여 가장 적합한 단어를 선택하라.
- 비슷한 발음의 단어가 여러 개 있으면, 해당 문장의 주제와 문맥에 가장 잘 맞는 것을 선택하라.
- 음성인식이 완전히 실패하여 의미를 파악할 수 없는 부분만 삭제하되, 추정 가능한 부분은 반드시 복원하라.
- 예시:
  "그래서 우리가 이 수레를 해야 합니다" → "그래서 우리가 이 사역을 해야 합니다" (문맥상 '사역')
  "하나님의 은해가" → "하나님의 은혜가" (발음 유사)
  "237 남아와 오천족에" → "237나라와 5000종족에" (다락방 용어)

[용어 교정]
- 다락방 전도운동 핵심 용어는 정확히 표기하라:
  237, 5000종족, 렘넌트, 7망대, 7여정, 7이정표, CVDIP, 777, 138, 3집중
  Heavenly, Thronely, Eternally, TCK, CCK, NCK, REA, RRTS
  이삼칠→237, 칠칠칠→777, 오천종족→5000종족 (숫자/영어 표기 유지)
- 음성인식 오류를 문맥에 맞게 교정하라:
  드로우게/드로에게→드로아교회, 아수르→앗수르, 유락민/노량민→유랑민
  할라고→하려고, 갈라고→가려고, 배심→뱃심
- 인명 교정: 김근이→김건희, 김소현→김소영, 이지훈/이지호→이주현, 장현승→장한샘
- 성경 구절 번호는 "23/" 형식으로 표기하라.

[추임새 제거]
- 문장 시작의 습관적 추임새만 삭제: '예,', '자,', '아,', '어,', '응,', '네,'
- 비속어/속어: '인마', '야' 등 거친 표현만 생략
- 주의: 추임새를 제거한다고 문장 자체를 삭제하면 안 된다.

[구조화 - 반드시 적용]
- 설교 흐름에 따라 아래 구분자를 반드시 별도 줄에 삽입하라:
  "본론" — 서론이 끝나고 본격적인 메시지 시작 지점
  "결론" — 설교의 마무리/정리 부분
  "기도" — 마지막 기도 시작 지점
- 각 구분자는 해당 단어만 단독으로 한 줄에 적어라.
- 구분자 앞뒤에 빈 줄을 넣어라.

[출력 형식]
- 특수 기호(▶, ■, ● 등) 사용 금지. 순수 텍스트만.
- 마크다운(##, **, - 등) 사용 금지.
- 주제가 바뀌거나 새 포인트로 넘어갈 때 빈 줄로 문단 구분.
- 한국어 부분만 출력. 외국어 통역 부분은 제외.
- 구어체는 뜻을 유지하되 자연스러운 문장으로 다듬어라.

[출력 예시]
성경말씀 로마서 16장 23절이다. 같이 합독하시겠다. 23/ 나와 온 교회를 돌보아 주는 가이오도 너희에게 문안하고 이 성의 재무관 에라스도와 형제 구아도도 너희에게 문안하느니라.

서론
우리는 렘넌트가 걸어가야할 길이 있음을 확신한다.

본론
예수님이 주신 반드시 승리하는 비밀이 있다. 행1:1-8절이다.

결론
비밀 붙잡고 가라. 이 축복이 여러분에게 있기를 바란다.

기도
하나님 감사합니다.
기도하시겠습니다.
하나님께 감사드립니다.

위 형식대로 [원본 텍스트]를 교정하여 출력하라. 내용은 절대 줄이지 마라."""


# ===== 일반 한국어 교정 (모든 유형 공통) =====
GENERAL_CORRECTIONS = {
    "할라고": "하려고",
    "갈라고": "가려고",
    "볼라고": "보려고",
    "알라고": "알려고",
    "먹을라고": "먹으려고",
    "배심": "뱃심",
}


def get_phonecall_correction_prompt():
    """통화 녹취 교정 프롬프트"""
    return """당신은 전문 통화 녹취록 편집자입니다.

아래 [원본 텍스트]는 음성인식(STT)으로 받아쓴 전화 통화 녹취록입니다.
이 텍스트를 교정하고 구조화하되, 반드시 아래 규칙을 따르세요.

[가장 중요한 규칙 - 내용 보존]
- 원본의 모든 문장을 빠짐없이 유지하라. 한 문장도 삭제하지 마라.
- 내용을 요약하거나 줄이지 마라. 원본 길이와 비슷하게 출력하라.
- 비슷한 내용이 반복되더라도 원본에 있으면 그대로 유지하라.

[저음질/불명확한 음성 대응 - 반드시 적용]
- 전화 녹음 특성상 음질이 떨어지거나 뭉개진 부분이 많을 수 있다.
- 의미 없는 글자 나열, 깨진 단어, 불명확한 음절은 앞뒤 문맥을 분석하여 올바른 단어로 추정·복원하라.
- 전화 통화에서 자주 사용하는 표현 패턴을 활용하여 추정하라:
  인사/안부, 용건 전달, 약속/일정 조율, 요청/확인, 마무리 인사
- 상대방 목소리가 작거나 뭉개져 인식이 안 된 부분도 문맥상 추정 가능하면 복원하라.
- 예시:
  "그래서 그게 좀 얼른해 주시면" → "그래서 그것을 좀 빨리 해주시면" (구어체 교정)
  "안녕하 세 요" → "안녕하세요" (끊어진 음절 복원)
  "다음 시요일에" → "다음 수요일에" (문맥 추정)

[화자 분리 - 반드시 적용]
- 통화 참여자를 구분하여 각 발언 앞에 화자 레이블을 붙여라.
- 화자가 2명인 경우: "화자 A:" 와 "화자 B:" 를 사용하라.
- 화자 구분 기준 (복합적으로 판단하라):
  1) 말투/어투 차이: 존댓말 vs 반말, 격식체 vs 비격식체
  2) 호칭 사용: "사장님", "과장님", "선생님" 등을 부르는 쪽 vs 불리는 쪽
  3) 역할 차이: 요청하는 쪽 vs 응답하는 쪽, 보고하는 쪽 vs 지시하는 쪽
  4) 대화 흐름: 질문→답변 패턴, 한쪽이 설명하고 다른 쪽이 맞장구
  5) 음성 톤: 높은 목소리 vs 낮은 목소리 (텍스트에서 추정 가능한 단서)
- 화자가 바뀔 때마다 빈 줄을 넣고 새 화자 레이블을 시작하라.
- 같은 화자의 연속 발언은 하나의 블록으로 묶어라.
- 이름이나 직함이 파악되면 레이블에 반영하라. (예: "화자 A(김과장):")
- 통화 본문(요약 전 구간)의 모든 문장은 반드시 화자 레이블로 시작해야 한다.
- 화자가 불명확해도 문맥상 가장 가능성 높은 화자로 임시 배정하라. 레이블 없는 줄을 남기지 마라.
- 질문 뒤에 이어지는 짧은 응답(네/예/알겠습니다 등)은 반대 화자로 우선 배정하라.

[텍스트 교정]
- 음성인식 오류를 문맥에 맞게 교정하라.
- 구어체 표현은 뜻을 유지하되 자연스러운 문장으로 다듬어라.
- 인명, 지명, 회사명 등 고유명사는 문맥을 고려하여 정확하게 기록하라.
- 전화번호, 주소, 날짜, 시간, 금액은 정확하게 기록하라.
- 의료 관련 통화인 경우 의료 용어를 정확히 표기하라:
  약물명 (타이레놀, 메트포르민, 아목시실린 등)
  질병명 (고혈압, 당뇨병, 위염 등)
  검사명 (CT, MRI, 혈액검사 등)

[추임새 제거]
- 문장 시작의 습관적 추임새만 삭제: '예,', '자,', '아,', '어,', '응,', '네,'
- 대화의 흐름에서 의미 있는 응답('네', '예', '아, 그렇군요' 등)은 유지하라.
- "네네", "아 네", "맞아요" 등 동의/확인 표현은 유지하라.

[출력 형식]
- 특수 기호(▶, ■, ● 등) 사용 금지. 순수 텍스트만.
- 마크다운(##, **, - 등) 사용 금지.

[구조화 - 반드시 적용]
- 통화 내용 뒤에 빈 줄 2개를 넣고 다음 형식으로 요약을 추가하라:

요약
(통화의 주요 목적과 맥락을 2-3문장으로 정리)

주요 내용
1. 첫 번째 핵심 사항
2. 두 번째 핵심 사항
3. 세 번째 핵심 사항

[출력 예시]
화자 A(김과장): 안녕하세요, 이대리님. 다음 주 회의 일정 관련해서 연락드렸습니다.

화자 B(이대리): 네, 말씀하세요.

화자 A(김과장): 다음 주 수요일 오후 2시에 진행하려고 하는데 괜찮으시겠습니까?

화자 B(이대리): 수요일은 좀 어려울 것 같은데요. 목요일로 변경 가능할까요?

화자 A(김과장): 네, 목요일 같은 시간으로 하겠습니다. 자료는 전날까지 공유해 주세요.

화자 B(이대리): 알겠습니다. 그렇게 하겠습니다.


요약
다음 주 회의 일정 조율을 위한 통화. 수요일에서 목요일로 변경 합의.

주요 내용
1. 회의 일정: 목요일 오후 2시로 변경
2. 참석 인원: 5명 확정
3. 자료 공유: 회의 전날까지

위 형식대로 [원본 텍스트]를 교정하여 출력하라. 내용은 절대 줄이지 마라."""


def get_conversation_correction_prompt():
    """대화/회의 녹취 교정 프롬프트"""
    return """당신은 전문 회의록 편집자입니다.

아래 [원본 텍스트]는 음성인식(STT)으로 받아쓴 대화/회의 녹취록입니다.
이 텍스트를 교정하고 구조화하되, 반드시 아래 규칙을 따르세요.

[가장 중요한 규칙 - 내용 보존]
- 원본의 모든 문장을 빠짐없이 유지하라. 한 문장도 삭제하지 마라.
- 내용을 요약하거나 줄이지 마라. 원본 길이와 비슷하게 출력하라.

[저음질/불명확한 음성 대응 - 반드시 적용]
- 회의실 녹음 특성상 반향, 겹치는 목소리, 먼 거리의 발언 등으로 음질이 떨어질 수 있다.
- 의미 없는 글자 나열, 깨진 단어, 불명확한 음절은 앞뒤 문맥을 분석하여 올바른 단어로 추정·복원하라.
- 회의/대화에서 자주 등장하는 맥락을 활용하여 추정하라:
  업무 보고, 프로젝트 진행상황, 일정 조율, 예산 논의, 인력 배치, 의사결정
- 여러 사람이 동시에 말하거나 겹치는 부분은 가능한 한 각각의 발언을 분리하여 기록하라.
- 멀리서 들리는 발언도 추정 가능하면 기록하라.
- 예시:
  "그 프로재트가" → "그 프로젝트가" (발음 뭉개짐)
  "KPI를 맞 춰야" → "KPI를 맞춰야" (끊어진 음절)
  "삼분기 매출이" → "3분기 매출이" (숫자 통일)

[화자 분리 - 반드시 적용]
- 회의 참석자를 구분하여 각 발언 앞에 화자 레이블을 붙여라.
- 화자를 "참석자 1:", "참석자 2:", "참석자 3:" 등으로 표시하라.
- 화자 구분 기준 (복합적으로 판단하라):
  1) 역할/직급 차이: 회의 주재자, 보고자, 의사결정자, 실무자
  2) 호칭 사용: "팀장님", "과장님", "대리님" 등 호칭으로 역할 파악
  3) 발언 패턴: 진행하는 사람, 보고하는 사람, 질문하는 사람, 의견 제시하는 사람
  4) 전문 분야: 기술적 발언, 마케팅 발언, 재무 발언 등 전문 영역으로 구분
  5) 대화 맥락: "제가 말씀드린 것처럼", "아까 김과장님이" 등 자기/타인 언급
- 이름이나 직함이 언급되면 레이블에 반영하라. (예: "참석자 1(김팀장):")
- 화자가 바뀔 때마다 빈 줄을 넣고 새 화자 레이블을 시작하라.
- 같은 화자의 연속 발언은 하나의 블록으로 묶어라.
- 회의 본문(요약 전 구간)의 모든 문장은 반드시 참석자 레이블로 시작해야 한다.
- 화자가 애매한 문장도 문맥상 가장 가능성 높은 참석자에게 임시 배정하라. 레이블 없는 줄을 남기지 마라.
- 질문/답변, 보고/피드백 흐름을 기준으로 발언 턴을 유지하라.

[텍스트 교정]
- 음성인식 오류를 문맥에 맞게 교정하라.
- 구어체 표현은 뜻을 유지하되 자연스러운 문장으로 다듬어라.
- 전문 용어, 프로젝트명, 고유명사는 문맥을 고려하여 정확하게 기록하라.
- 숫자, 금액, 날짜, 퍼센트 등은 아라비아 숫자로 통일하라 (예: 삼십 퍼센트 → 30%)
- 의료 관련 회의인 경우 의료 용어를 정확히 표기하라:
  약물명, 질병명, 검사명, 의료 절차 등
- 기술 회의인 경우 IT/기술 용어를 정확히 표기하라:
  API, SDK, CI/CD, AWS, GCP, Docker, Kubernetes 등

[추임새 제거]
- 문장 시작의 습관적 추임새만 삭제.
- 대화의 흐름에서 의미 있는 응답은 유지하라.
- "좋습니다", "동의합니다", "그렇게 하시죠" 등 의사결정 관련 응답은 반드시 유지.

[출력 형식]
- 특수 기호(▶, ■, ● 등) 사용 금지. 순수 텍스트만.
- 마크다운(##, **, - 등) 사용 금지.

[구조화 - 반드시 적용]
- 대화 내용 뒤에 빈 줄 2개를 넣고, 다음 형식으로 회의록 요약을 추가하라:

요약
(회의의 주요 목적과 맥락을 2-3문장으로 정리)

논의 안건
1. 안건 제목 - 논의 결과
2. 안건 제목 - 논의 결과

결정 사항
1. 결정 사항
2. 결정 사항

후속 조치
1. 담당: OOO - 내용 (기한)
2. 담당: OOO - 내용 (기한)

[출력 예시]
참석자 1(김팀장): 오늘 회의는 다음 분기 마케팅 전략에 대해 논의하겠습니다. 먼저 지난 분기 실적부터 보겠습니다.

참석자 2(이대리): 지난 분기 매출은 전년 대비 15% 증가했습니다. 특히 온라인 채널에서 성과가 좋았습니다.

참석자 3(박과장): 온라인 쪽은 좋았는데 오프라인 매장 실적은 5% 감소했습니다. 원인 분석이 필요합니다.

참석자 1(김팀장): 좋습니다. 오프라인 매장 분석은 박과장이 다음 주까지 보고서로 정리해 주세요.


요약
다음 분기 마케팅 전략 수립을 위한 회의. 지난 분기 실적 리뷰와 향후 방향 논의.

논의 안건
1. 지난 분기 실적 - 매출 15% 증가, 오프라인 5% 감소
2. 다음 분기 전략 - 온라인 강화 + 오프라인 개선 병행

결정 사항
1. 온라인 마케팅 예산 20% 증액
2. 오프라인 매장 리뉴얼 검토

후속 조치
1. 담당: 이대리 - 온라인 마케팅 세부 계획 수립 (2주 내)
2. 담당: 박과장 - 오프라인 매장 분석 보고서 작성 (1주 내)

위 형식대로 [원본 텍스트]를 교정하여 출력하라. 내용은 절대 줄이지 마라."""


# ===== 영어 교정 프롬프트 =====

def get_en_sermon_correction_prompt():
    """English sermon/lecture correction prompt"""
    return """You are an expert sermon and lecture transcript editor.

The [Original Text] below was transcribed from audio using speech-to-text (STT).
Correct and structure this text following the rules below.

[Most Important Rule - Content Preservation]
- Keep ALL sentences from the original. Do NOT delete a single sentence.
- Do NOT summarize or shorten. Output should be similar in length to the original.
- If content is repeated, keep it as-is if it was actually repeated.
- Long output is fine. Do NOT try to shorten it.

[Handling Low-Quality / Unclear Audio - Must Apply]
- If the original text contains meaningless character sequences, broken words, or unclear syllables, analyze the context and restore them to the correct words.
- Use surrounding sentences, topic, and speaker intent to choose the most appropriate word.
- When multiple similar-sounding words are possible, pick the one that best fits the context.
- Only remove parts where meaning is completely unrecoverable. Restore anything that can be inferred.
- Examples:
  "the importants of faith" → "the importance of faith"
  "we need to pray for the nay shuns" → "we need to pray for the nations"
  "God's gray is sufficient" → "God's grace is sufficient"

[Text Correction]
- Fix STT errors based on context.
- Correct grammar, spelling, and punctuation while preserving the speaker's meaning.
- Proper nouns (names, places, book titles) should be accurately spelled.
- Bible verse references should use standard format: "John 3:16", "Romans 8:28"
- Medical terminology must be accurately spelled if mentioned:
  Drug names (acetaminophen, metformin, amoxicillin, etc.)
  Disease names (hypertension, diabetes, epilepsy, seizure, etc.)
  Test names (CT, MRI, EEG, etc.)

[Filler Removal]
- Remove habitual fillers at sentence starts: "um", "uh", "so", "like", "you know"
- Keep meaningful responses: "yes", "amen", "right"
- Do NOT delete actual content sentences when removing fillers.

[Structuring - Must Apply]
- Insert section markers on separate lines based on the sermon flow:
  "Main Body" — where the main message begins after the introduction
  "Conclusion" — the closing/summary section
  "Prayer" — where the closing prayer begins
- Each marker should be on its own line, with blank lines before and after.

[Output Format]
- No special symbols. Plain text only.
- No markdown (##, **, - etc.).
- Separate paragraphs with blank lines when the topic changes.
- Colloquial expressions should be smoothed into natural sentences while preserving meaning.

Correct the [Original Text] following this format. Do NOT shorten the content."""


def get_en_phonecall_correction_prompt():
    """English phone call correction prompt"""
    return """You are an expert phone call transcript editor.

The [Original Text] below was transcribed from a phone call recording using speech-to-text (STT).
Correct and structure this text following the rules below.

[Most Important Rule - Content Preservation]
- Keep ALL sentences from the original. Do NOT delete a single sentence.
- Do NOT summarize or shorten. Output should be similar in length to the original.

[Handling Low-Quality / Unclear Audio - Must Apply]
- Phone recordings often have low quality, muffled audio, or background noise.
- Restore broken words, unclear syllables using surrounding context.
- Use common phone conversation patterns to infer meaning:
  Greetings, stating purpose, scheduling, requests, confirmations, closing
- If one side's voice is quiet or garbled, restore it if context allows.
- Examples:
  "I'll sen you the dah cuments" → "I'll send you the documents"
  "can we sheh dule for" → "can we schedule for"
  "the pah tient needs" → "the patient needs"

[Speaker Separation - Must Apply]
- Identify and label speakers: "Speaker A:" and "Speaker B:"
- Criteria for speaker identification:
  1) Tone/formality differences
  2) Who uses titles vs who is addressed by title
  3) Role: requester vs responder, reporter vs manager
  4) Conversation flow: question→answer patterns
  5) If names/titles are identified, reflect in labels (e.g., "Speaker A (Dr. Kim):")
- Add blank lines between speaker changes.
- Group consecutive statements by the same speaker.
- Every sentence in the call body (before summary) must start with a speaker label.
- If speaker identity is uncertain, assign the most likely speaker from context. Do not leave unlabeled lines.
- For short acknowledgment after a question ("yes", "okay", "got it"), prefer assigning the opposite speaker.

[Text Correction]
- Fix STT errors based on context.
- Correct grammar and spelling while preserving conversational tone.
- Proper nouns (names, companies, locations) should be accurately spelled.
- Phone numbers, addresses, dates, times, amounts should be recorded accurately.
- Medical terminology must be accurately spelled:
  Drug names: acetaminophen, ibuprofen, metformin, amoxicillin, omeprazole, insulin,
  levetiracetam, carbamazepine, valproate, lamotrigine, phenytoin, topiramate
  Diseases: hypertension, diabetes, epilepsy, seizure, stroke, pneumonia, asthma
  Tests: CT, MRI, EEG, CBC, ECG, X-ray

[Filler Removal]
- Remove habitual fillers: "um", "uh", "like", "you know"
- Keep meaningful responses: "yes", "right", "I see", "okay", "got it"

[Output Format]
- No special symbols. Plain text only.
- No markdown.

[Structuring - Must Apply]
After the call content, add two blank lines and the following summary:

Summary
(2-3 sentences describing the main purpose and context of the call)

Key Points
1. First key point
2. Second key point
3. Third key point

Correct the [Original Text] following this format. Do NOT shorten the content."""


def get_en_conversation_correction_prompt():
    """English conversation/meeting correction prompt"""
    return """You are an expert meeting minutes editor.

The [Original Text] below was transcribed from a meeting/conversation recording using speech-to-text (STT).
Correct and structure this text following the rules below.

[Most Important Rule - Content Preservation]
- Keep ALL sentences from the original. Do NOT delete a single sentence.
- Do NOT summarize or shorten. Output should be similar in length to the original.

[Handling Low-Quality / Unclear Audio - Must Apply]
- Meeting recordings may have echo, overlapping voices, or distant speakers.
- Restore broken words, unclear syllables using surrounding context.
- Use common meeting contexts to infer meaning:
  Status updates, project progress, scheduling, budget discussion, staffing, decisions
- Separate overlapping speech into individual statements where possible.
- Record distant speakers if identifiable.
- Examples:
  "the pro ject is on trah ck" → "the project is on track"
  "we need to meet the KP eyes" → "we need to meet the KPIs"
  "the buh get for Q3" → "the budget for Q3"

[Speaker Separation - Must Apply]
- Label meeting participants: "Participant 1:", "Participant 2:", "Participant 3:", etc.
- Criteria for speaker identification:
  1) Role/seniority: meeting chair, presenter, decision-maker, contributor
  2) Title usage: "Manager", "Director", identifying roles
  3) Speaking patterns: facilitator, reporter, questioner, opinion-giver
  4) Expertise: technical, marketing, financial domains
  5) Self/other references: "As I mentioned", "Like John said"
- If names/titles are identified, reflect in labels (e.g., "Participant 1 (Sarah, PM):")
- Add blank lines between speaker changes.
- Every sentence in the meeting body (before summary) must start with a participant label.
- If speaker identity is uncertain, assign the most likely participant from context. Do not leave unlabeled lines.
- Preserve turn-taking using question→answer and report→feedback patterns.

[Text Correction]
- Fix STT errors based on context.
- Correct grammar and spelling while preserving conversational tone.
- Technical terms, project names, proper nouns should be accurately spelled.
- Numbers, amounts, dates, percentages should use numerals (e.g., "30%", "$5M", "Q3")
- Medical terminology if applicable: drug names, disease names, procedure names
- Technical terms if applicable: API, SDK, CI/CD, AWS, GCP, Docker, Kubernetes, etc.

[Filler Removal]
- Remove habitual fillers at sentence starts.
- Keep decision-related responses: "Agreed", "Let's do that", "Sounds good", "Approved"

[Output Format]
- No special symbols. Plain text only.
- No markdown.

[Structuring - Must Apply]
After the conversation content, add two blank lines and the following summary:

Summary
(2-3 sentences describing the meeting purpose and context)

Agenda Items
1. Topic - Discussion result
2. Topic - Discussion result

Decisions
1. Decision made
2. Decision made

Action Items
1. Owner: Name - Task (Deadline)
2. Owner: Name - Task (Deadline)

Correct the [Original Text] following this format. Do NOT shorten the content."""


def get_correction_prompt_by_type(transcription_type: str = "sermon", language: str = "ko") -> str:
    """녹취 유형별 + 언어별 Gemini 교정 프롬프트 반환"""
    if language == "en":
        if transcription_type == "phonecall":
            return get_en_phonecall_correction_prompt()
        elif transcription_type == "conversation":
            return get_en_conversation_correction_prompt()
        else:
            return get_en_sermon_correction_prompt()
    else:
        if transcription_type == "phonecall":
            return get_phonecall_correction_prompt()
        elif transcription_type == "conversation":
            return get_conversation_correction_prompt()
        else:
            return get_gemini_correction_prompt()


def correct_text(text: str, transcription_type: str = "sermon", language: str = "ko") -> str:
    """
    1차 텍스트 교정 (규칙 기반)
    transcription_type: "sermon" | "phonecall" | "conversation"
    language: "ko" | "en"
    """
    corrected = text
    import re

    if language == "en":
        # ===== 영어 교정 =====
        # 영어 일반 STT 오류 교정
        for wrong, right in EN_COMMON_CORRECTIONS.items():
            corrected = re.sub(re.escape(wrong), right, corrected, flags=re.IGNORECASE)

        # 영어 의료 용어 교정
        for wrong, right in EN_MEDICAL_CORRECTIONS.items():
            corrected = re.sub(re.escape(wrong), right, corrected, flags=re.IGNORECASE)

        # 영어 추임새 제거
        corrected = re.sub(r'(?m)^(Um|Uh|So|Like|You know|I mean)[,.\s]+', '', corrected, flags=re.IGNORECASE)
        corrected = re.sub(r'\n{3,}', '\n\n', corrected)

    else:
        # ===== 한국어 교정 =====
        if transcription_type == "sermon":
            # 설교: 전체 교정 (교회 용어 + 일반)
            for wrong, right in COMMON_MISTAKES.items():
                corrected = corrected.replace(wrong, right)

            # 숫자 패턴 교정 (교회 전용)
            corrected = re.sub(r'이\s*삼\s*칠', '237', corrected)
            corrected = re.sub(r'이백\s*삼십\s*칠', '237', corrected)
            corrected = re.sub(r'오\s*천', '5000', corrected)
            corrected = re.sub(r'칠\s*망대', '7망대', corrected)
            corrected = re.sub(r'칠\s*여정', '7여정', corrected)
            corrected = re.sub(r'칠\s*이정표', '7이정표', corrected)
            corrected = re.sub(r'칠\s*칠\s*칠', '777', corrected)

            # 성경 구절 형식 통일
            corrected = re.sub(
                r'([가-힣]+)\s*(\d+)\s*장\s*(\d+)\s*절',
                r'\1 \2장 \3절',
                corrected
            )
        else:
            # 통화/대화: 일반 한국어 교정만
            for wrong, right in GENERAL_CORRECTIONS.items():
                corrected = corrected.replace(wrong, right)

        # 의료 용어 교정 (한국어 공통)
        for wrong, right in MEDICAL_CORRECTIONS.items():
            corrected = corrected.replace(wrong, right)

        # 추임새 제거 (한국어 공통)
        corrected = re.sub(r'(?m)^(예|아|자|어|응|네|에|그)[,.\s~]+', '', corrected)
        corrected = re.sub(r'(?<=[.?!])\s*(예|아|자|어|응|네)[,~]\s*', ' ', corrected)
        corrected = re.sub(r'\n{3,}', '\n\n', corrected)

    return corrected

def get_claude_context():
    """
    Claude에게 전달할 다락방 용어 컨텍스트
    """
    context = """당신은 류광수 목사 계열 다락방 전도운동 교회의 설교 전문 편집자입니다.

=== 필수 용어 (정확히 유지) ===

【핵심 비전】
- 렘넌트: 하나님이 남겨둔 소수 정예
- 237: 세계 237개국
- 5000: 5000종족
- 237나라, 5000종족 (항상 이렇게 표기)

【7 메시지】
- 7망대, 7여정, 7이정표
- 절대 망대, 절대 여정, 절대 이정표
- 777 기도, 7포인트, 7천제자

【단계】
- 보좌화 → 생활화 → 개인화 → 제자화 → 세계화

【장소/구조】
- 다락방, 미션홈, 지교회
- 마가다락방, 갈보리산, 감람산

【영문 용어】
- Heavenly, Thronely, Eternally (영문 그대로)
- TCK, CCK, NCK, CVDIP (약어 그대로)

【목회자】
- 류광수 목사님
- 이주현 목사님

【영적 개념】
- 천명, 소명, 사명
- 재창조, 시공간 초월, 전무후무
- 보좌, 사단, 흑암

=== 교정 규칙 ===
1. 위 용어는 절대 바꾸지 말 것
2. 숫자는 아라비아 숫자 유지 (237, 5000, 7)
3. 영문은 영문 그대로 (Heavenly, TCK 등)
4. 하나님, 예수님, 성령님 존칭 유지
5. 성경 구절: "책명 X장 Y절" 형식
6. 문장은 자연스럽게, 의미는 변경 금지

=== 주의 사항 ===
- "렘넌트"를 "남은 자"로 바꾸지 말 것
- "237"을 "이삼칠"로 바꾸지 말 것
- 약어 풀어쓰지 말 것 (CVDIP → 그대로)
"""
    return context

def get_summary_prompt(summary_type: str = "short"):
    """
    다락방 설교 요약 프롬프트
    """
    if summary_type == "short":
        return """다음 설교를 3-5문장으로 요약해주세요.

주보에 들어갈 내용입니다.

포함 사항:
- 본문 말씀 (성경 구절)
- 핵심 메시지
- 다락방 용어는 그대로 유지 (렘넌트, 237, 7망대 등)

형식:
본문: (성경 구절)
메시지: (핵심 내용 2-3문장)"""
    
    else:
        return """다음 설교를 상세히 요약해주세요.

【형식】
1. 본문 말씀: (성경 구절)

2. 핵심 메시지:
   (한 줄 요약)

3. 주요 내용:
   (1) 첫 번째 포인트
   (2) 두 번째 포인트
   (3) 세 번째 포인트

4. 렘넌트 적용:
   (실천 사항)

5. 기도 제목:
   (2-3개)

【주의】
- 다락방 용어 정확히 유지
- 숫자/영문 그대로"""

def print_terms_summary():
    """용어 통계 출력"""
    print("=== 다락방 교회 용어 로딩 완료 ===")
    print(f"다락방 핵심 용어: {len(DARAKBANG_CORE)}개")
    print(f"전체 교회 용어: {len(ALL_CHURCH_TERMS)}개")
    print(f"교회 교정 사전: {len(COMMON_MISTAKES)}개")
    print(f"의료 용어: {len(ALL_MEDICAL_TERMS)}개")
    print(f"의료 교정 사전: {len(MEDICAL_CORRECTIONS)}개")
    print("\n【최우선 용어 샘플】")
    print(", ".join(DARAKBANG_CORE[:20]))
    print("\n【Gemini 프롬프트】")
    print(get_gemini_prompt())

if __name__ == "__main__":
    print_terms_summary()
    
    test_text = "오늘은 렘넌트에 대해서 이삼칠 나라와 오천 종족에 복음을 전할 칠망대에 대해 말씀드립니다"
    print("\n【교정 테스트】")
    print(f"원본: {test_text}")
    print(f"교정: {correct_text(test_text)}")

import StaticContentLayout from '../components/StaticContentLayout'

export default function DeleteAccount(props) {
  return <StaticContentLayout {...props} locale="ko" title="mallog24 계정 삭제" canonicalPath="/delete-account"
    description="앱을 설치하지 않아도 계정과 관련 데이터 삭제를 요청할 수 있습니다.">
    <article className="space-y-5 leading-7 mallog-keep">
      <h2 className="text-lg font-semibold">웹 또는 앱에서 삭제</h2>
      <p>웹에서 로그인한 뒤 개인정보 설정의 ‘계정 삭제’를 열어 확인하고 삭제해 주세요. 앱에서는 설정 → 계정 관리 → 계정 삭제를 선택합니다. AI 전송 동의 없이도 삭제할 수 있습니다.</p>
      <a className="underline" href="/#privacy-settings">웹 로그인 및 계정 설정</a>
      <h2 className="text-lg font-semibold">로그인할 수 없는 경우</h2>
      <p>가입 이메일로 ours113814@gmail.com에 ‘mallog24 계정 삭제 요청’을 보내주세요. Apple 비공개 이메일을 사용했다면 가입에 연결된 릴레이 이메일도 알려주세요. 비밀번호나 인증 코드는 보내지 마세요. 본인 확인 후 처리 결과와 예상 일정을 회신합니다.</p>
      <a className="underline" href="mailto:ours113814@gmail.com?subject=mallog24%20account%20deletion%20request">이메일로 삭제 요청</a>
      <h2 className="text-lg font-semibold">삭제 범위</h2>
      <p>계정, 전사·교정 기록, 저장 기록본, 용어집, 학습 후보 텍스트 및 계정에 연결된 보관 음성을 삭제합니다. 진행 중인 작업이 중지되거나 삭제에 실패한 경우 재시도 안내가 표시되며, 완료 전에 계정이 삭제되었다고 표시하지 않습니다. 법적 보존 의무가 있는 자료와 외부 AI 제공자의 보안 로그는 관련 정책에 따라 별도 보존될 수 있습니다.</p>
      <p>Apple 로그인 연결은 Apple 계정 설정에서도 해제할 수 있습니다. 앱 삭제 또는 Apple 연결 해제만으로 mallog24 데이터가 삭제되지는 않습니다.</p>
      <h2 className="text-lg font-semibold">Delete your mallog24 account</h2>
      <p>Sign in on the website and open Privacy settings → Account deletion, or use Settings → Account Management in the app. Without app access, email ours113814@gmail.com from your registered address with the subject “mallog24 account deletion request”. We verify ownership and reply with the status and expected timeline. Never send passwords or verification codes.</p>
      <p>Deletion covers the account, transcripts, saved records, glossary and contributed training candidates, including linked retained audio. Legally required records and provider security logs may remain under the applicable policies. Deletion failures are reported for retry, not as success.</p>
      <a className="underline" href="/privacy">개인정보처리방침 / Privacy policy</a>
    </article>
  </StaticContentLayout>
}

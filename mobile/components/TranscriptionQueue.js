import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Feather from "@expo/vector-icons/Feather";

export default function TranscriptionQueue({ queue, state, locale, theme, busy, onRetry, onResult }) {
  if (!state.items.length) return null;
  const en = locale === "en";
  const labels = en
    ? { waiting: "Waiting", uploading: "Uploading", processing: "Converting", completed: "Completed", failed: "Failed", uncertain: "Status unknown" }
    : { waiting: "대기", uploading: "업로드 중", processing: "변환 중", completed: "완료", failed: "실패", uncertain: "상태 확인 필요" };
  const icons = { waiting: "clock", uploading: "upload", processing: "loader", completed: "check", failed: "alert-circle", uncertain: "alert-circle" };
  const completed = state.items.filter(item => item.status === "completed").length;
  const action = (icon, label, onPress, disabled = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.icon, disabled && { opacity: 0.3 }]}>
      <Feather name={icon} size={18} color={theme.accent} />
    </Pressable>
  );
  return <View style={[styles.section, { borderColor: theme.inputBorder }]}>
    <View style={styles.header}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>{en ? "Conversion queue" : "변환 대기 목록"} {completed}/{state.items.length}</Text>
      {state.running && action("pause", en ? "Pause after current file" : "현재 파일 완료 후 일시정지", () => queue.pause())}
      {completed > 0 && action("check-circle", en ? "Clear completed" : "완료 항목 정리", () => queue.clearCompleted())}
    </View>
    <Text accessibilityLiveRegion="polite" style={[styles.meta, { color: theme.textSecondary }]}>
      {completed === state.items.length ? (en ? "All files completed" : "모든 파일 변환 완료") : state.running ? (en ? "Converting in order" : "순차 변환 중") : state.activeId ? (en ? "Pausing after current file" : "현재 파일 완료 후 일시정지") : (en ? "Queue stopped" : "대기열 정지")}
    </Text>
    {state.items.map((item, index) => <View key={item.id} style={[styles.row, { borderColor: theme.inputBorder }]}>
      <View style={styles.fileRow}>
        <Feather name={icons[item.status]} size={18} color={theme.accent} />
        <View style={styles.file}>
          <Text style={[styles.name, { color: theme.textPrimary }]}>{item.name}</Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>{labels[item.status]} · {(item.size / 1024 / 1024).toFixed(1)} MB</Text>
          {Boolean(item.error) && <Text style={[styles.meta, { color: theme.textSecondary }]}>{item.error}</Text>}
        </View>
      </View>
      <View style={styles.actions}>
        {item.status === "waiting" && <>
          {action("arrow-up", en ? "Move up" : "위로 이동", () => queue.move(item.id, -1), state.items[index - 1]?.status !== "waiting")}
          {action("arrow-down", en ? "Move down" : "아래로 이동", () => queue.move(item.id, 1), state.items[index + 1]?.status !== "waiting")}
        </>}
        {["failed", "uncertain"].includes(item.status) && action("rotate-cw", en ? "Retry / check status" : "재시도 / 상태 확인", () => onRetry(item.id), busy)}
        {item.status === "completed" && action("file-text", en ? "View result" : "결과 보기", () => onResult(item.id), busy || state.running)}
        {["waiting", "failed", "completed"].includes(item.status) && action("x", en ? "Remove from queue" : "목록에서 제거", () => queue.remove(item.id))}
      </View>
    </View>)}
    <Text style={[styles.meta, { color: theme.textSecondary }]}>{en ? "Closing the app or signing out clears pending files. Completed results remain in History." : "앱 종료·로그아웃 시 대기 파일은 사라집니다. 완료 결과는 변환 기록에 남습니다."}</Text>
  </View>;
}

const styles = StyleSheet.create({
  section: { borderTopWidth: 1, marginTop: 18, paddingTop: 12, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  title: { flex: 1, minWidth: 140, fontSize: 15, fontWeight: "700" },
  row: { borderBottomWidth: 1, paddingVertical: 10, gap: 4 },
  fileRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  file: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontSize: 14, lineHeight: 21, flexShrink: 1 },
  meta: { fontSize: 12, lineHeight: 19, flexShrink: 1 },
  actions: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap" },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});

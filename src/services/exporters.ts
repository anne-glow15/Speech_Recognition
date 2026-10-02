import type { TranscriptSegment } from "@/types";
import { formatShort, formatSrtTime } from "@/utils/format";

function download(name: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toTxt(segments: TranscriptSegment[]): string {
  return segments.map((s) => `[${formatShort(s.start)}] ${s.text}`).join("\n");
}

export function toSrt(segments: TranscriptSegment[]): string {
  return segments
    .map((s, i) => `${i + 1}\n${formatSrtTime(s.start)} --> ${formatSrtTime(Math.max(s.end, s.start + 0.5))}\n${s.text}\n`)
    .join("\n");
}

export function exportTxt(segments: TranscriptSegment[], name = "transcript") {
  download(`${name}.txt`, new Blob([toTxt(segments)], { type: "text/plain" }));
}

export function exportSrt(segments: TranscriptSegment[], name = "transcript") {
  download(`${name}.srt`, new Blob([toSrt(segments)], { type: "application/x-subrip" }));
}

export async function exportPdf(segments: TranscriptSegment[], name = "transcript") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const height = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("VoxNova Transcript", margin, margin);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(new Date().toLocaleString(), margin, margin + 18);
  let y = margin + 48;
  doc.setFontSize(11);
  for (const s of segments) {
    const lines = doc.splitTextToSize(`[${formatShort(s.start)}]  ${s.text}`, width) as string[];
    if (y + lines.length * 15 > height - margin) { doc.addPage(); y = margin; }
    doc.text(lines, margin, y);
    y += lines.length * 15 + 6;
  }
  doc.save(`${name}.pdf`);
}

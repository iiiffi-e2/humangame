import type { Pillar } from '@/features/game-engine/types';

/**
 * The share card, as data.
 *
 * One description of what goes on a card, used by the story PNG the browser
 * draws, the 1200x630 OG image the server renders, and the text the clipboard
 * fallback copies. Nothing here reveals a day's configs or answers — a share
 * card carries scores and percentiles only.
 */

export interface ShareCardData {
  dayNumber: number;
  totalScore: number;
  topPercent: number;
  percentile: number;
  streak: number;
  pillars: Array<{ pillar: Pillar; value: number }>;
  /** `eric 14–11 tara`, or null when there is no rivalry to show. */
  rivalryLine: string | null;
  /** Short link the recipient opens. */
  url: string;
  showPillars: boolean;
}

export const CARD_SIZES = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  og: { width: 1200, height: 630 },
} as const;

export type CardFormat = keyof typeof CARD_SIZES;

/** The default share copy. Kept in one place so every surface says the same thing. */
export function shareText(data: ShareCardData): string {
  const lines = [
    `HUMAN #${data.dayNumber}`,
    `${data.totalScore.toLocaleString()} · TOP ${data.topPercent}%`,
  ];
  if (data.streak > 0) lines.push(`🔥 ${data.streak} DAYS`);
  lines.push(`I beat ${Math.round(data.percentile)}% of humans today. Can you beat me?`);
  lines.push(data.url);
  return lines.join('\n');
}

export const CARD_COLORS = {
  ink: '#111111',
  bone: '#F4F0E8',
  chartreuse: '#D8FF3E',
  cobalt: '#8F9AFF',
  track: 'rgba(244,240,232,0.15)',
} as const;

/**
 * Draw the card onto a 2D canvas at the given size.
 *
 * Pure layout arithmetic against the passed dimensions, so the same function
 * produces the story and square crops without a second design.
 */
export function drawCard(
  context: CanvasRenderingContext2D,
  data: ShareCardData,
  width: number,
  height: number,
): void {
  const unit = width / 1080;
  const pad = 96 * unit;

  context.fillStyle = CARD_COLORS.ink;
  context.fillRect(0, 0, width, height);

  context.fillStyle = CARD_COLORS.bone;
  context.textBaseline = 'alphabetic';
  context.font = `800 ${64 * unit}px Archivo, system-ui, sans-serif`;
  context.fillText('HUMAN', pad, pad + 56 * unit);

  context.font = `500 ${32 * unit}px "JetBrains Mono", monospace`;
  context.textAlign = 'right';
  context.fillText(`#${data.dayNumber}`, width - pad, pad + 56 * unit);
  context.textAlign = 'left';

  const scoreTop = height * (height > width ? 0.3 : 0.34);
  context.fillStyle = CARD_COLORS.chartreuse;
  context.font = `900 ${260 * unit}px Archivo, system-ui, sans-serif`;
  context.fillText(data.totalScore.toLocaleString(), pad, scoreTop);

  context.fillStyle = CARD_COLORS.bone;
  context.font = `500 ${34 * unit}px "JetBrains Mono", monospace`;
  context.fillText(`TOP ${data.topPercent}% TODAY`, pad, scoreTop + 60 * unit);

  let cursor = scoreTop + 150 * unit;

  if (data.showPillars) {
    const rowHeight = 54 * unit;
    const barLeft = pad + 210 * unit;
    const barWidth = width - barLeft - pad - 90 * unit;
    for (const row of data.pillars) {
      context.fillStyle = CARD_COLORS.bone;
      context.font = `500 ${26 * unit}px "JetBrains Mono", monospace`;
      context.fillText(row.pillar.toUpperCase(), pad, cursor + 22 * unit);

      context.fillStyle = CARD_COLORS.track;
      context.fillRect(barLeft, cursor + 6 * unit, barWidth, 18 * unit);
      context.fillStyle = CARD_COLORS.bone;
      context.fillRect(barLeft, cursor + 6 * unit, (barWidth * row.value) / 100, 18 * unit);

      context.textAlign = 'right';
      context.fillText(String(row.value), width - pad, cursor + 22 * unit);
      context.textAlign = 'left';
      cursor += rowHeight;
    }
    cursor += 30 * unit;
  }

  context.font = `500 ${28 * unit}px "JetBrains Mono", monospace`;
  context.fillStyle = CARD_COLORS.bone;
  if (data.streak > 0) context.fillText(`${data.streak} DAY STREAK`, pad, cursor);
  if (data.rivalryLine) {
    context.fillStyle = CARD_COLORS.cobalt;
    context.textAlign = 'right';
    context.fillText(data.rivalryLine.toUpperCase(), width - pad, cursor);
    context.textAlign = 'left';
  }

  const footerTop = height - pad - 90 * unit;
  context.fillStyle = CARD_COLORS.bone;
  context.font = `700 ${46 * unit}px Archivo, system-ui, sans-serif`;
  context.fillText(`I beat ${Math.round(data.percentile)}% of humans today.`, pad, footerTop);
  context.fillStyle = CARD_COLORS.chartreuse;
  context.fillText('Can you beat me?', pad, footerTop + 56 * unit);

  context.fillStyle = CARD_COLORS.bone;
  context.globalAlpha = 0.5;
  context.font = `400 ${26 * unit}px "JetBrains Mono", monospace`;
  context.fillText(data.url.replace(/^https?:\/\//, ''), pad, height - pad + 20 * unit);
  context.globalAlpha = 1;
}

'use client';

import React, { useMemo } from 'react';
import { Flame, Clock, CheckCircle2 } from 'lucide-react';
import { ReviewLog, StudySession } from '@/domains/knowledge/types';

interface StudyHeatmapProps {
  reviewLogs: ReviewLog[];
  studySessions: StudySession[];
}

function toDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function StudyHeatmap({ reviewLogs, studySessions }: StudyHeatmapProps) {
  const { weeks, todayMinutes, todayReviews, streakDays } = useMemo(() => {
    const dayStats: Record<string, { minutes: number; reviews: number }> = {};

    for (const log of reviewLogs) {
      const k = toDayKey(log.reviewedAt);
      dayStats[k] = dayStats[k] ?? { minutes: 0, reviews: 0 };
      dayStats[k].reviews += 1;
    }

    for (const sess of studySessions) {
      const k = toDayKey(sess.startedAt);
      dayStats[k] = dayStats[k] ?? { minutes: 0, reviews: 0 };
      dayStats[k].minutes += Math.max(1, Math.round(sess.durationSeconds / 60));
    }

    const totalDays = 16 * 7; // Últimas 16 semanas
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: Array<{ key: string; dateLabel: string; score: number; minutes: number; reviews: number }> = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const key = toDayKey(d.getTime());
      const st = dayStats[key] ?? { minutes: 0, reviews: 0 };
      const score = st.reviews + Math.ceil(st.minutes / 15);
      days.push({
        key,
        dateLabel: d.toLocaleDateString('pt-BR'),
        score,
        minutes: st.minutes,
        reviews: st.reviews,
      });
    }

    const groupedWeeks: Array<typeof days> = [];
    for (let w = 0; w < 16; w++) {
      groupedWeeks.push(days.slice(w * 7, w * 7 + 7));
    }

    // Sequência atual (streak)
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].score > 0) streak += 1;
      else if (i < days.length - 1) break;
    }

    const todayKey = toDayKey(today.getTime());
    const todayData = dayStats[todayKey] ?? { minutes: 0, reviews: 0 };

    return {
      weeks: groupedWeeks,
      todayMinutes: todayData.minutes,
      todayReviews: todayData.reviews,
      streakDays: streak,
    };
  }, [reviewLogs, studySessions]);

  const cellColor = (score: number) => {
    if (score === 0) return 'bg-zinc-800/70';
    if (score <= 2) return 'bg-emerald-900/90';
    if (score <= 5) return 'bg-emerald-700';
    if (score <= 9) return 'bg-emerald-500';
    return 'bg-emerald-400';
  };

  return (
    <div className="mb-6 rounded-2xl border border-zinc-800 bg-[#161920] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Mapa de Constância (16 semanas)
          </h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Combina sessões do Relógio de Foco e revisões concluídas
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-amber-300">
            <Flame className="h-4 w-4" />
            <span className="font-semibold">{streakDays}d</span>
            <span className="text-zinc-500">sequência</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-300">
            <Clock className="h-4 w-4" />
            <span className="font-semibold">{todayMinutes} min</span>
            <span className="text-zinc-500">hoje</span>
          </div>
          <div className="flex items-center gap-1.5 text-indigo-300">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-semibold">{todayReviews}</span>
            <span className="text-zinc-500">revisões</span>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1.5">
            {week.map((day) => (
              <div
                key={day.key}
                title={`${day.dateLabel}: ${day.minutes} min de foco • ${day.reviews} revisões`}
                className={`h-3.5 w-3.5 rounded-[4px] transition hover:scale-125 ${cellColor(day.score)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
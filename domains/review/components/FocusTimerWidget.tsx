'use client';

import React, { useEffect, useState } from 'react';
import { Timer, Play, Pause, Check, RotateCcw } from 'lucide-react';
import { useKnowledgeStore } from '@/domains/knowledge/store/useKnowledgeStore';
import { useUiStore } from '@/domains/ui/store/useUiStore';
import { StudySession } from '@/domains/knowledge/types';

const PRESETS: Array<{ mode: StudySession['mode']; label: string; seconds: number }> = [
  { mode: 'pomodoro25', label: 'Pomodoro 25 min', seconds: 25 * 60 },
  { mode: 'deep50', label: 'Bloco Profundo 50 min', seconds: 50 * 60 },
  { mode: 'free', label: 'Cronômetro Livre', seconds: 0 },
];

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function FocusTimerWidget() {
  const saveStudySession = useKnowledgeStore((s) => s.saveStudySession);
  const addToast = useUiStore((s) => s.addToast);

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<StudySession['mode'] | null>(null);
  const [targetSeconds, setTargetSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const finishSession = async (secondsToSave: number, mode: StudySession['mode']) => {
    setIsRunning(false);
    setActiveMode(null);
    setElapsedSeconds(0);

    if (secondsToSave >= 10) {
      await saveStudySession(secondsToSave, mode);
      const mins = Math.max(1, Math.round(secondsToSave / 60));
      addToast({
        message: `Sessão de foco registrada (${mins} min no seu Heatmap)`,
        variant: 'success',
      });
    }
  };

  useEffect(() => {
    if (!isRunning || !activeMode) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (targetSeconds > 0 && next >= targetSeconds) {
          finishSession(next, activeMode);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, activeMode, targetSeconds]);

  const startPreset = (preset: (typeof PRESETS)[number]) => {
    setActiveMode(preset.mode);
    setTargetSeconds(preset.seconds);
    setElapsedSeconds(0);
    setIsRunning(true);
    setMenuOpen(false);
  };

  if (!activeMode) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#181C24] px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-indigo-500/60 hover:text-zinc-100"
          title="Iniciar sessão de foco (Deep Work / Pomodoro)"
        >
          <Timer className="h-3.5 w-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Foco</span>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-zinc-800 bg-[#161920] p-1.5 shadow-2xl">
            <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Sessão de Estudo
            </p>
            {PRESETS.map((p) => (
              <button
                key={p.mode}
                type="button"
                onClick={() => startPreset(p)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-indigo-600/20 hover:text-indigo-200"
              >
                <span>{p.label}</span>
                <Play className="h-3 w-3 text-emerald-400" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const displaySeconds =
    targetSeconds > 0 ? Math.max(0, targetSeconds - elapsedSeconds) : elapsedSeconds;

  return (
    <div className="flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs">
      <span
        className={`h-2 w-2 rounded-full ${isRunning ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'}`}
      />
      <span className="font-mono font-semibold tabular-nums text-emerald-300">
        {formatClock(displaySeconds)}
      </span>

      <button
        type="button"
        onClick={() => setIsRunning((v) => !v)}
        className="ml-1 rounded p-1 text-zinc-300 hover:bg-zinc-800"
        title={isRunning ? 'Pausar' : 'Retomar'}
      >
        {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </button>

      <button
        type="button"
        onClick={() => finishSession(elapsedSeconds, activeMode)}
        className="rounded p-1 text-emerald-400 hover:bg-emerald-500/20"
        title="Concluir e salvar no Heatmap"
      >
        <Check className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={() => {
          setIsRunning(false);
          setActiveMode(null);
          setElapsedSeconds(0);
        }}
        className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        title="Cancelar sessão"
      >
        <RotateCcw className="h-3 w-3" />
      </button>
    </div>
  );
}
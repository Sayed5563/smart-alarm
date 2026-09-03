import { useEffect, useMemo, useRef, useState } from 'react';
import type { WakeUpTaskConfig, WakeUpDifficulty } from '@/types';
import { useT } from '@/i18n';
import { Button, cx } from './ui';

/**
 * Runs a wake-up task. Calls `onSolved` when the required number of rounds is
 * completed, and `onFail` on every wrong attempt (for history/stats).
 * The QR task is designed as a drop-in: it uses the native BarcodeDetector when
 * present and always offers a typed fallback, so a future dedicated scanner can
 * replace just this branch.
 */
export function WakeUpTaskRunner({
  config,
  onSolved,
  onFail,
}: {
  config: WakeUpTaskConfig;
  onSolved: () => void;
  onFail: () => void;
}) {
  const t = useT();
  const [round, setRound] = useState(1);
  const total = Math.max(1, config.rounds);

  const advance = () => {
    if (round >= total) onSolved();
    else setRound((r) => r + 1);
  };

  return (
    <div className="w-full">
      {total > 1 && (
        <p className="mb-3 text-center text-sm text-muted">
          {t('task.progress', { done: round - 1, total })}
        </p>
      )}
      {config.type === 'math' && (
        <MathTask key={round} difficulty={config.difficulty} onOk={advance} onBad={onFail} />
      )}
      {config.type === 'code' && (
        <CodeTask key={round} difficulty={config.difficulty} onOk={advance} onBad={onFail} />
      )}
      {config.type === 'sequence' && (
        <SequenceTask key={round} difficulty={config.difficulty} onOk={advance} onBad={onFail} />
      )}
      {config.type === 'qr' && (
        <QrTask
          key={round}
          payload={config.qrPayload ?? 'SMART-ALARM'}
          onOk={advance}
          onBad={onFail}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- Math */
function makeMathProblem(difficulty: WakeUpDifficulty): { q: string; a: number } {
  const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  if (difficulty === 'easy') {
    const a = rnd(2, 19);
    const b = rnd(2, 19);
    return { q: `${a} + ${b}`, a: a + b };
  }
  if (difficulty === 'medium') {
    const op = rnd(0, 2);
    if (op === 0) {
      const a = rnd(12, 49);
      const b = rnd(12, 49);
      return { q: `${a} + ${b}`, a: a + b };
    }
    if (op === 1) {
      const a = rnd(30, 89);
      const b = rnd(5, 29);
      return { q: `${a} − ${b}`, a: a - b };
    }
    const a = rnd(3, 12);
    const b = rnd(3, 12);
    return { q: `${a} × ${b}`, a: a * b };
  }
  // hard — two steps
  const a = rnd(4, 14);
  const b = rnd(4, 14);
  const c = rnd(5, 40);
  return { q: `${a} × ${b} + ${c}`, a: a * b + c };
}

function MathTask({
  difficulty,
  onOk,
  onBad,
}: {
  difficulty: WakeUpDifficulty;
  onOk: () => void;
  onBad: () => void;
}) {
  const t = useT();
  const problem = useMemo(() => makeMathProblem(difficulty), [difficulty]);
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(value) === problem.a) {
      onOk();
    } else {
      setError(true);
      setValue('');
      onBad();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 text-center">
      <p className="text-lg font-medium">{t('task.math.prompt', { question: problem.q })}</p>
      <input
        ref={inputRef}
        inputMode="numeric"
        pattern="-?[0-9]*"
        aria-label={t('task.math.answer')}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(false);
        }}
        className="tnum mx-auto block w-40 rounded-xl border border-border bg-surface-2 px-4 py-3 text-center text-2xl"
      />
      {error && <p className="text-sm text-danger">{t('task.math.wrong')}</p>}
      <Button type="submit" variant="primary" size="lg" full>
        {t('common.confirm')}
      </Button>
    </form>
  );
}

/* --------------------------------------------------------------------- Code */
function CodeTask({
  difficulty,
  onOk,
  onBad,
}: {
  difficulty: WakeUpDifficulty;
  onOk: () => void;
  onBad: () => void;
}) {
  const t = useT();
  const len = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6;
  const code = useMemo(
    () =>
      Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join(''),
    [len],
  );
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === code) onOk();
    else {
      setError(true);
      setValue('');
      onBad();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 text-center">
      <p className="text-sm text-muted">{t('task.code.prompt')}</p>
      <p className="tnum select-none text-4xl font-semibold tracking-[0.3em]" aria-label={`Code ${code.split('').join(' ')}`}>
        {code}
      </p>
      <input
        ref={inputRef}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={len}
        aria-label={t('task.code.placeholder')}
        placeholder={t('task.code.placeholder')}
        value={value}
        onChange={(e) => {
          setValue(e.target.value.replace(/\D/g, ''));
          setError(false);
        }}
        className="tnum mx-auto block w-48 rounded-xl border border-border bg-surface-2 px-4 py-3 text-center text-2xl tracking-[0.2em]"
      />
      {error && <p className="text-sm text-danger">{t('task.code.wrong')}</p>}
      <Button type="submit" variant="primary" size="lg" full>
        {t('common.confirm')}
      </Button>
    </form>
  );
}

/* ----------------------------------------------------------------- Sequence */
function SequenceTask({
  difficulty,
  onOk,
  onBad,
}: {
  difficulty: WakeUpDifficulty;
  onOk: () => void;
  onBad: () => void;
}) {
  const t = useT();
  const n = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6;
  const target = useMemo(() => shuffle(Array.from({ length: n }, (_, i) => i + 1)), [n]);
  const layout = useMemo(() => shuffle(Array.from({ length: n }, (_, i) => i + 1)), [n]);
  const [progress, setProgress] = useState(0);

  const press = (num: number) => {
    if (num === target[progress]) {
      const next = progress + 1;
      if (next === n) onOk();
      else setProgress(next);
    } else {
      setProgress(0);
      onBad();
    }
  };

  return (
    <div className="space-y-4 text-center">
      <p className="text-sm text-muted">{t('task.sequence.prompt')}</p>
      <div className="flex justify-center gap-2" aria-label="Target order">
        {target.map((num, i) => (
          <span
            key={i}
            className={cx(
              'tnum grid h-9 w-9 place-items-center rounded-lg text-sm font-semibold',
              i < progress ? 'bg-accent text-accent-contrast' : 'glass',
            )}
          >
            {num}
          </span>
        ))}
      </div>
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
        {layout.map((num) => (
          <button
            key={num}
            onClick={() => press(num)}
            className="tnum grid aspect-square place-items-center rounded-2xl glass text-2xl font-semibold hover:bg-surface-2"
            aria-label={`Button ${num}`}
          >
            {num}
          </button>
        ))}
      </div>
      {progress === 0 && <p className="h-5 text-sm text-danger" aria-live="polite" />}
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* --------------------------------------------------------------------- QR */
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

function QrTask({
  payload,
  onOk,
  onBad,
}: {
  payload: string;
  onOk: () => void;
  onBad: () => void;
}) {
  const t = useT();
  const supported =
    typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices;
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'denied' | 'fallback'>('idle');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  const start = async () => {
    if (!supported) {
      setPhase('fallback');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setPhase('scanning');
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const Detector = (window as unknown as { BarcodeDetector: new (o: object) => BarcodeDetectorLike })
        .BarcodeDetector;
      const detector = new Detector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          const hit = codes.find((c) => c.rawValue === payload);
          if (hit) {
            stopCamera();
            onOk();
            return;
          }
        } catch {
          /* frame not ready */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setPhase('denied');
    }
  };

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (typed.trim() === payload) onOk();
    else {
      setError(true);
      onBad();
    }
  };

  return (
    <div className="space-y-3 text-center">
      <p className="text-sm text-muted">{t('task.qr.prompt')}</p>

      {phase === 'idle' && (
        <>
          <p className="text-xs text-muted">{t('task.qr.permission')}</p>
          <Button variant="primary" size="lg" full onClick={start}>
            {supported ? t('task.qr.start') : t('task.qr.fallback')}
          </Button>
          {supported && (
            <button
              className="text-xs text-accent underline"
              onClick={() => setPhase('fallback')}
            >
              {t('task.qr.fallback')}
            </button>
          )}
        </>
      )}

      {phase === 'scanning' && (
        <div className="overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="aspect-square w-full object-cover" playsInline muted />
        </div>
      )}

      {phase === 'denied' && <p className="text-sm text-danger">{t('task.qr.denied')}</p>}

      {(phase === 'fallback' || phase === 'denied') && (
        <form onSubmit={submitTyped} className="space-y-2">
          <input
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              setError(false);
            }}
            aria-label={t('task.qr.fallback')}
            placeholder={payload}
            className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-center"
          />
          {error && <p className="text-sm text-danger">{t('task.qr.wrong')}</p>}
          <Button type="submit" variant="primary" size="lg" full>
            {t('common.confirm')}
          </Button>
        </form>
      )}
    </div>
  );
}

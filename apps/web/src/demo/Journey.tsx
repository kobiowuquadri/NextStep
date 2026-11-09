'use client';

import { useState } from 'react';
import { Flag, Lock, Sparkles } from 'lucide-react';
import { MASCOT_ACCESSORIES, MASCOT_SKINS, weekStartOfKey, addDaysToKey } from '@nextstep/contracts';
import { ACCESSORY_LABELS, badgeSvg, mascotSvg, SKINS, type BadgeKey } from '@nextstep/illustrations';
import { LEVEL_NAMES, xpForLevel } from '@nextstep/gamification';
import { updatePreferences, weeklySummary, saveReflection } from '@nextstep/engine';
import { XpBar } from './bits';
import { useDerived } from './derived';
import { formatDateKey, formatMinutes } from './shared';
import { useDemo } from './store';
import styles from './demo.module.css';

export function JourneyView() {
  const demo = useDemo();
  const d = useDerived();
  const { app } = demo;
  const prefs = app.preferences;
  const [reflecting, setReflecting] = useState(false);
  const weekStart = weekStartOfKey(d.day);
  const summary = weeklySummary(app, weekStart, demo.clock);
  const reflected = app.reflections.some((r) => r.weekStart === weekStart && !r.deletedAt);
  const stations = Array.from({ length: 6 }, (_, i) => Math.max(1, d.level.level - 1) + i).filter((l) => l <= LEVEL_NAMES.length);

  return (
    <div className={styles.view}>
      <section className={`${styles.card} ${styles.journeyHero}`} aria-labelledby="lvl-h">
        <div className={styles.journeyMascot} aria-hidden dangerouslySetInnerHTML={{ __html: mascotSvg({ pose: 'encourage', skin: prefs.mascotSkin, accessory: prefs.mascotAccessory }) }} />
        <div className={styles.grow}>
          <p className={styles.kicker}>Level {d.level.level}</p>
          <h2 id="lvl-h" className={styles.previewTitle}>
            {d.level.name}
          </h2>
          <XpBar progress={d.level.progress} label="Level progress" />
          <p className={styles.muted}>
            {d.xp} XP · {d.level.nextLevelXp - d.xp} XP to {LEVEL_NAMES[d.level.level] ?? `level ${d.level.level + 1}`}
          </p>
        </div>
      </section>

      <section aria-labelledby="path-h">
        <h3 id="path-h" className={styles.sectionLabel}>
          <Flag size={16} aria-hidden /> Your path
        </h3>
        <ol className={styles.path}>
          {stations.map((l) => (
            <li key={l} className={l < d.level.level ? styles.stationDone : l === d.level.level ? styles.stationNow : ''}>
              <span className={styles.stationDot}>{l}</span>
              <span>
                <strong>{LEVEL_NAMES[l - 1]}</strong>
                <small>{xpForLevel(l)} XP</small>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {prefs.streaksEnabled && (
        <section className={styles.card} aria-labelledby="steady-h">
          <h3 id="steady-h" className={styles.cardTitle}>
            Steady weeks
          </h3>
          <div className={styles.weekDots} aria-label={`${d.steady.activeDaysThisWeek} of ${d.steady.goal} active days this week`}>
            {Array.from({ length: 7 }, (_, i) => {
              const k = addDaysToKey(weekStart, i);
              const active = d.ledger.some((e) => e.localDate === k && ['task_completed', 'subtask_completed', 'focus_completed', 'goal_checkin', 'practice_completed', 'checkin_completed'].includes(e.type));
              return (
                <span key={k} className={active ? styles.dotOn : ''} title={formatDateKey(k)}>
                  {formatDateKey(k).slice(0, 1)}
                </span>
              );
            })}
          </div>
          <p className={styles.muted}>
            {d.steady.activeDaysThisWeek} of {d.steady.goal} active days this week (your goal). Missing a day never resets your progress.
          </p>
        </section>
      )}

      <section aria-labelledby="quests-h">
        <h3 id="quests-h" className={styles.sectionLabel}>
          <Sparkles size={16} aria-hidden /> Quests
        </h3>
        <ul className={styles.questList}>
          {[...d.quests.daily, ...d.quests.weekly].map((q) => (
            <li key={q.instanceId} className={q.complete ? styles.questDone : ''}>
              <span className={styles.questTag}>{q.def.cadence === 'daily' ? 'Today' : 'This week'}</span>
              <strong>{q.def.title}</strong>
              <small>{q.def.description}</small>
              <XpBar progress={q.progress / q.def.target} label={`${q.def.title}: ${q.progress} of ${q.def.target}`} />
              <small>
                {q.complete ? `Done · +${q.def.xp} XP` : `${q.progress}/${q.def.target} · ${q.def.xp} XP`}
              </small>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="badges-h">
        <h3 id="badges-h" className={styles.sectionLabel}>
          Badges
        </h3>
        <ul className={styles.badgeGrid}>
          {d.achievements.map((a) => {
            const unlocked = d.unlockedIds.has(a.id);
            return (
              <li key={a.id} className={unlocked ? '' : styles.locked}>
                <span aria-hidden dangerouslySetInnerHTML={{ __html: badgeSvg(a.badge as BadgeKey, { locked: !unlocked }) }} />
                <strong>{a.title}</strong>
                <small>{unlocked ? a.description : a.rule}</small>
                {!unlocked && <span className="visually-hidden">Locked</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.card} aria-labelledby="style-h">
        <h3 id="style-h" className={styles.cardTitle}>
          Style Nex
        </h3>
        <p className={styles.muted}>Cosmetic only — nothing here locks a feature.</p>
        <div className={styles.cosmetics} role="radiogroup" aria-label="Colour">
          {MASCOT_SKINS.map((s) => {
            const has = d.cosmetics.skins.includes(s);
            return (
              <button key={s} type="button" role="radio" aria-checked={prefs.mascotSkin === s} disabled={!has} title={has ? SKINS[s].label : `${SKINS[s].label} (locked)`} className={styles.swatch} style={{ background: SKINS[s].body }} onClick={() => demo.commit(updatePreferences(app, { mascotSkin: s }, demo.ctx()))}>
                {!has && <Lock size={14} aria-hidden />}
                <span className="visually-hidden">
                  {SKINS[s].label}
                  {has ? '' : ' (locked)'}
                </span>
              </button>
            );
          })}
        </div>
        <div className={styles.chips} role="radiogroup" aria-label="Accessory">
          {MASCOT_ACCESSORIES.map((a) => {
            const has = d.cosmetics.accessories.includes(a);
            return (
              <button key={a} type="button" role="radio" aria-checked={prefs.mascotAccessory === a} disabled={!has} className={styles.chipBtn} onClick={() => demo.commit(updatePreferences(app, { mascotAccessory: a }, demo.ctx()))}>
                {!has && <Lock size={12} aria-hidden />} {ACCESSORY_LABELS[a]}
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.card} aria-labelledby="refl-h">
        <h3 id="refl-h" className={styles.cardTitle}>
          This week so far
        </h3>
        <dl className={styles.stats}>
          <div>
            <dt>Planned</dt>
            <dd>{formatMinutes(summary.plannedMinutes)}</dd>
          </div>
          <div>
            <dt>Done</dt>
            <dd>{formatMinutes(summary.completedMinutes)}</dd>
          </div>
          <div>
            <dt>Logged focus</dt>
            <dd>{formatMinutes(summary.actualMinutes)}</dd>
          </div>
          <div>
            <dt>Restarts</dt>
            <dd>{summary.restarts}</dd>
          </div>
        </dl>
        <ul className={styles.reasons}>
          {summary.suggestions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className={styles.fine}>Logged activity is not the same as learning or grades.</p>
        {!reflected ? (
          reflecting ? (
            <ReflectionForm
              onDone={(wentWell, obstacles) => {
                demo.commit(
                  saveReflection(app, { weekStart, wentWell, obstacles, adjustments: summary.suggestions.slice(0, 2) }, { plannedMinutes: summary.plannedMinutes, completedMinutes: summary.completedMinutes, estimatedMinutes: summary.estimatedMinutes, actualMinutes: summary.actualMinutes }, demo.ctx()),
                  { toast: 'Reflection saved' },
                );
                setReflecting(false);
              }}
            />
          ) : (
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setReflecting(true)}>
              Write this week’s reflection
            </button>
          )
        ) : (
          <p className={styles.muted}>Reflection saved for this week.</p>
        )}
      </section>
    </div>
  );
}

function ReflectionForm({ onDone }: { onDone: (wentWell: string, obstacles: string[]) => void }) {
  const [wentWell, setWentWell] = useState('');
  const [obs, setObs] = useState<string[]>([]);
  return (
    <form
      className={styles.stack}
      onSubmit={(e) => {
        e.preventDefault();
        onDone(wentWell, obs);
      }}
    >
      <label className={styles.field}>
        <span>What went well?</span>
        <textarea value={wentWell} onChange={(e) => setWentWell(e.target.value)} rows={3} maxLength={500} />
      </label>
      <fieldset className={styles.fieldset}>
        <legend>What got in the way?</legend>
        <div className={styles.chips}>
          {['Work shifts', 'Commute', 'Data', 'Power', 'Health', 'Family', 'Motivation'].map((o) => (
            <label key={o} className={styles.chip}>
              <input type="checkbox" checked={obs.includes(o)} onChange={(e) => setObs((xs) => (e.target.checked ? [...xs, o] : xs.filter((x) => x !== o)))} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
        Save reflection
      </button>
    </form>
  );
}

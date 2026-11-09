'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { LEARNING_RESOURCES } from '@nextstep/demo-data';
import { completePractice } from '@nextstep/engine';
import { useDemo } from './store';
import styles from './demo.module.css';

export function Practice({ resourceId, onClose }: { resourceId: string; onClose: () => void }) {
  const demo = useDemo();
  const r = LEARNING_RESOURCES.find((x) => x.id === resourceId);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);
  if (!r) return <p>Resource not found.</p>;
  const correct = r.questions.filter((q) => answers[q.id] === q.answerIndex).length;

  return (
    <div className={styles.stack}>
      <p className={`${styles.notice} ${styles.noticeInfo}`}>{r.provenance}</p>
      {r.sections.map((s) => (
        <section key={s.heading}>
          <h4 className={styles.sectionLabel}>{s.heading}</h4>
          <p>{s.body}</p>
        </section>
      ))}
      {r.questions.length > 0 && (
        <form
          className={styles.stack}
          onSubmit={(e) => {
            e.preventDefault();
            setChecked(true);
            demo.commit(completePractice(demo.app, r.id, (correct / r.questions.length) * 100, demo.ctx()), { toast: 'Practice check done' });
          }}
        >
          <h4 className={styles.sectionLabel}>Quick check</h4>
          {r.questions.map((q, qi) => (
            <fieldset key={q.id} className={styles.fieldset}>
              <legend>
                {qi + 1}. {q.prompt}
              </legend>
              <div className={styles.stack}>
                {q.choices.map((c, ci) => {
                  const state = checked ? (ci === q.answerIndex ? 'right' : answers[q.id] === ci ? 'wrong' : '') : '';
                  return (
                    <label key={c} className={`${styles.checkRow} ${state === 'right' ? styles.right : state === 'wrong' ? styles.wrong : ''}`}>
                      <input type="radio" name={q.id} disabled={checked} checked={answers[q.id] === ci} onChange={() => setAnswers((a) => ({ ...a, [q.id]: ci }))} />
                      <span>
                        <strong>{c}</strong>
                        {state === 'right' && (
                          <small>
                            <CheckCircle2 size={14} aria-hidden /> Correct answer
                          </small>
                        )}
                        {state === 'wrong' && (
                          <small>
                            <XCircle size={14} aria-hidden /> Your answer
                          </small>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              {checked && <p className={styles.why}>{q.explanation}</p>}
            </fieldset>
          ))}
          {!checked ? (
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={Object.keys(answers).length < r.questions.length}>
              Check answers
            </button>
          ) : (
            <>
              <p className={styles.lead}>
                {correct} of {r.questions.length} correct. This checks recall on a few points — it isn’t a grade or a measure of mastery.
              </p>
              <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>
                Done
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}

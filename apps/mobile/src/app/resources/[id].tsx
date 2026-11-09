import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, XCircle } from '../../ui/icons';
import type { LearningResource } from '@nextstep/contracts';
import { completePractice } from '@nextstep/engine';
import { getDownloaded } from '../../lib/resources';
import { useApp } from '../../lib/store';
import { Button, Card, Notice, Screen, SectionLabel, T } from '../../ui/kit';
import { useTheme } from '../../ui/theme';

export default function ResourceView() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, run } = useApp();
  const [res, setRes] = useState<LearningResource | null | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (db && id) void getDownloaded(db, id).then(setRes);
  }, [db, id]);

  if (res === undefined) return null;
  if (res === null) {
    return (
      <Screen>
        <Notice tone="warning">This resource isn’t downloaded. Download it from the library to use it offline.</Notice>
        <Button label="Back to library" onPress={() => router.replace('/resources')} />
      </Screen>
    );
  }
  const correct = res.questions.filter((q) => answers[q.id] === q.answerIndex).length;

  return (
    <Screen>
      <T variant="h1">{res.title}</T>
      <Notice>{res.provenance}</Notice>
      {res.sections.map((s) => (
        <View key={s.heading} style={{ gap: 6 }}>
          <T variant="h3">{s.heading}</T>
          <T color="textSecondary">{s.body}</T>
        </View>
      ))}
      {res.questions.length > 0 && (
        <>
          <SectionLabel>Quick check</SectionLabel>
          {res.questions.map((q, qi) => (
            <Card key={q.id} flat>
              <T variant="bodyStrong">
                {qi + 1}. {q.prompt}
              </T>
              <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
                {q.choices.map((choice, ci) => {
                  const picked = answers[q.id] === ci;
                  const isRight = checked && ci === q.answerIndex;
                  const isWrong = checked && picked && ci !== q.answerIndex;
                  return (
                    <Pressable
                      key={choice}
                      disabled={checked}
                      onPress={() => setAnswers((a) => ({ ...a, [q.id]: ci }))}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: picked, disabled: checked }}
                      accessibilityLabel={`${choice}${isRight ? ', correct answer' : isWrong ? ', your answer, incorrect' : ''}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, padding: 10, borderRadius: 12, borderWidth: 2, borderColor: isRight ? c.success : isWrong ? c.danger : picked ? c.borderStrong : c.border, backgroundColor: isRight ? c.successSoft : isWrong ? c.dangerSoft : picked ? c.primarySoft : c.surface }}
                    >
                      {isRight ? <CheckCircle2 size={18} color={c.successText} /> : isWrong ? <XCircle size={18} color={c.dangerText} /> : <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: picked ? c.primary : 'transparent' }} />}
                      <T style={{ flex: 1 }}>{choice}</T>
                    </Pressable>
                  );
                })}
              </View>
              {checked && (
                <T variant="small" color="textSecondary">
                  {q.explanation}
                </T>
              )}
            </Card>
          ))}
          {!checked ? (
            <Button
              label="Check answers"
              disabled={Object.keys(answers).length < res.questions.length}
              onPress={async () => {
                setChecked(true);
                await run((s, ctx) => completePractice(s, res.id, (correct / res.questions.length) * 100, ctx), { toast: 'Practice check done' });
              }}
            />
          ) : (
            <Card tone="calm">
              <T variant="bodyStrong">
                {correct} of {res.questions.length} correct
              </T>
              <T variant="small" color="textSecondary">
                This checks recall on a few points — it isn’t a grade or a measure of mastery. Retakes are for learning and don’t earn extra XP.
              </T>
              <Button label="Try again" small variant="secondary" onPress={() => { setAnswers({}); setChecked(false); }} />
            </Card>
          )}
        </>
      )}
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

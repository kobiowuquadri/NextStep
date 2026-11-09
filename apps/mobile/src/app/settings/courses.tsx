import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Trash2 } from '../../ui/icons';
import { courseColors } from '@nextstep/design-tokens';
import { deleteCourse, live, saveCourse } from '@nextstep/engine';
import { useApp } from '../../lib/store';
import { Button, Card, Field, ListRow, Row, Screen, T } from '../../ui/kit';
import { useTheme } from '../../ui/theme';

export default function Courses() {
  const { c } = useTheme();
  const { state, run } = useApp();
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState<string>(courseColors[0]);
  if (!state) return null;
  const courses = live(state.courses);
  return (
    <Screen>
      <T variant="h1">Courses</T>
      {courses.length === 0 && <T color="textMuted">No courses yet. Tasks can also have no course.</T>}
      {courses.map((co) => (
        <ListRow
          key={co.id}
          title={co.title}
          subtitle={co.code ?? undefined}
          left={<View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: c.borderStrong, backgroundColor: co.color }} />}
          right={
            <Pressable onPress={() => void run((s, ctx) => deleteCourse(s, co.id, ctx), { toast: 'Course removed; its tasks were kept' })} accessibilityRole="button" accessibilityLabel={`Remove ${co.title}`} hitSlop={10}>
              <Trash2 size={18} color={c.textMuted} />
            </Pressable>
          }
        />
      ))}
      <Card>
        <Field label="Course title" value={title} onChangeText={setTitle} maxLength={100} />
        <Field label="Code (optional)" value={code} onChangeText={setCode} maxLength={20} />
        <T variant="small" weight="700">
          Colour
        </T>
        <Row gap={10}>
          {courseColors.map((col) => (
            <Pressable key={col} onPress={() => setColor(col)} accessibilityRole="radio" accessibilityState={{ checked: color === col }} accessibilityLabel={`Colour ${col}`} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: col, borderWidth: color === col ? 4 : 2, borderColor: c.borderStrong }} />
          ))}
        </Row>
        <Button label="Add course" disabled={!title.trim()} onPress={async () => { await run((s, ctx) => saveCourse(s, { title: title.trim(), code: code.trim() || null, color }, ctx), { toast: 'Course added' }); setTitle(''); setCode(''); }} />
      </Card>
      <Button label="Done" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

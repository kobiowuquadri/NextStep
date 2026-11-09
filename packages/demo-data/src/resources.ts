import { stableUuid, type LearningResource } from '@nextstep/contracts';

const PROVENANCE =
  'Written by Team Apex for the NextStep demo (2026). Not reviewed by an educator — check it against your own course materials.';
const LICENSE = 'Original work by Team Apex. Licence to be confirmed by the team before public release.';

type Draft = Omit<LearningResource, 'id' | 'version' | 'provenance' | 'reviewStatus' | 'license'>;

const drafts: Draft[] = [
  {
    slug: 'big-o-in-ten-minutes',
    title: 'Big-O notation in ten minutes',
    subject: 'Computer science',
    kind: 'practice',
    summary: 'How to read the growth rate of simple loops, with four quick checks.',
    estMinutes: 10,
    sections: [
      {
        heading: 'What Big-O describes',
        body: 'Big-O describes how the number of steps an algorithm takes grows as the input size n grows. It ignores constant factors and smaller terms, so 3n + 5 steps is written O(n). It is about growth, not exact running time.',
      },
      {
        heading: 'Common growth rates',
        body: 'From slowest-growing to fastest: O(1) constant, O(log n) logarithmic, O(n) linear, O(n log n), O(n²) quadratic, O(2ⁿ) exponential. Doubling n leaves O(1) unchanged, roughly doubles O(n) work, and roughly quadruples O(n²) work.',
      },
      {
        heading: 'Reading loops',
        body: 'One loop over n items is usually O(n). A loop inside another loop, both over n items, is usually O(n²). A loop that halves the remaining range each time (like binary search) is O(log n). Loops one after another add: O(n) + O(n) is still O(n).',
      },
    ],
    questions: [
      {
        id: 'q1',
        prompt: 'An algorithm takes 4n² + 10n + 7 steps. What is its Big-O?',
        choices: ['O(n)', 'O(n²)', 'O(4n²)', 'O(n³)'],
        answerIndex: 1,
        explanation: 'Keep the fastest-growing term and drop constant factors: 4n² becomes n², so the answer is O(n²).',
      },
      {
        id: 'q2',
        prompt: 'A for-loop runs from 1 to n, and inside it another for-loop runs from 1 to n. What is the growth rate?',
        choices: ['O(n)', 'O(2n)', 'O(n²)', 'O(log n)'],
        answerIndex: 2,
        explanation: 'The inner loop runs n times for each of the n outer iterations: n × n = n² steps.',
      },
      {
        id: 'q3',
        prompt: 'Binary search halves the search range on each step. How does its work grow?',
        choices: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        answerIndex: 1,
        explanation: 'Halving repeatedly reaches one item after about log₂ n steps, so binary search is O(log n).',
      },
      {
        id: 'q4',
        prompt: 'Two separate loops each run over n items, one after the other. What is the total?',
        choices: ['O(n²)', 'O(2ⁿ)', 'O(n)', 'O(log n)'],
        answerIndex: 2,
        explanation: 'Sequential loops add: n + n = 2n steps, and dropping the constant gives O(n).',
      },
    ],
  },
  {
    slug: 'solving-2x2-linear-systems',
    title: 'Solving 2×2 linear systems',
    subject: 'Mathematics',
    kind: 'practice',
    summary: 'Elimination and the determinant check, with worked examples and three checks.',
    estMinutes: 12,
    sections: [
      {
        heading: 'Elimination',
        body: 'To solve x + y = 5 and x − y = 1, add the equations to eliminate y: 2x = 6, so x = 3. Substitute back: 3 + y = 5, so y = 2. Always check by substituting both values into both equations.',
      },
      {
        heading: 'The determinant test',
        body: 'For the system ax + by = e and cx + dy = f, the determinant is ad − bc. If it is not zero there is exactly one solution. If it is zero, the lines are parallel (no solution) or identical (infinitely many solutions).',
      },
      {
        heading: 'Cramer’s rule',
        body: 'When ad − bc ≠ 0: x = (ed − bf) / (ad − bc) and y = (af − ec) / (ad − bc). It is quick for 2×2 systems but elimination is often less error-prone by hand.',
      },
    ],
    questions: [
      {
        id: 'q1',
        prompt: 'Solve 2x + y = 7 and x − y = 2.',
        choices: ['x = 3, y = 1', 'x = 2, y = 3', 'x = 1, y = 5', 'x = 4, y = −1'],
        answerIndex: 0,
        explanation: 'Adding the equations gives 3x = 9, so x = 3. Then 3 − y = 2 gives y = 1. Check: 2(3) + 1 = 7 ✓.',
      },
      {
        id: 'q2',
        prompt: 'What is the determinant of the system 3x + 2y = 1, 6x + 4y = 5?',
        choices: ['24', '0', '−12', '12'],
        answerIndex: 1,
        explanation: 'ad − bc = 3·4 − 2·6 = 12 − 12 = 0. Because 6x + 4y is exactly twice 3x + 2y but 5 ≠ 2·1, the lines are parallel and there is no solution.',
      },
      {
        id: 'q3',
        prompt: 'If the determinant of a 2×2 system is not zero, how many solutions are there?',
        choices: ['None', 'Exactly one', 'Exactly two', 'Infinitely many'],
        answerIndex: 1,
        explanation: 'A non-zero determinant means the two lines cross at exactly one point.',
      },
    ],
  },
  {
    slug: 'linked-lists-insert-delete',
    title: 'Linked lists: insert and delete',
    subject: 'Computer science',
    kind: 'guide',
    summary: 'The pointer moves behind insertion and deletion in a singly linked list.',
    estMinutes: 8,
    sections: [
      {
        heading: 'The shape of a node',
        body: 'Each node stores a value and a reference (next) to the following node. The list keeps a reference to the first node, the head. The last node’s next is null.',
      },
      {
        heading: 'Inserting after a node',
        body: 'To insert new node N after node P: first set N.next = P.next, then set P.next = N. Doing it in the other order loses the rest of the list. Inserting at the head means N.next = head, then head = N.',
      },
      {
        heading: 'Deleting a node',
        body: 'To delete the node after P, set P.next = P.next.next. To delete the head, set head = head.next. Always handle the empty list and the single-node list as special cases, and test them.',
      },
    ],
    questions: [
      {
        id: 'q1',
        prompt: 'Inserting node N after node P: which step must come first?',
        choices: ['P.next = N', 'N.next = P.next', 'head = N', 'N.next = null'],
        answerIndex: 1,
        explanation: 'Set N.next = P.next first so the rest of the list is still reachable; then link P to N.',
      },
      {
        id: 'q2',
        prompt: 'How do you remove the first node of a non-empty list?',
        choices: ['head.next = null', 'head = null', 'head = head.next', 'head.next = head'],
        answerIndex: 2,
        explanation: 'Moving head to head.next skips the old first node, which can then be cleaned up.',
      },
    ],
  },
  {
    slug: 'breaking-down-an-assignment',
    title: 'Breaking down a big assignment',
    subject: 'Study skills',
    kind: 'guide',
    summary: 'Turn a vague assignment into steps you can actually start tonight.',
    estMinutes: 6,
    sections: [
      {
        heading: 'Start with the brief',
        body: 'Copy the exact question and the marking points into your task. Underline the verbs (explain, compare, implement): each one usually becomes at least one step.',
      },
      {
        heading: 'Make the first step tiny',
        body: 'A good first step takes 15–25 minutes and needs no decisions, such as “list the three sources I already have” or “write the function signatures”. Starting is the hardest part; make it easy.',
      },
      {
        heading: 'Estimate, then add margin',
        body: 'Estimate each step, add them up, then add about a quarter for things you cannot see yet. If the total does not fit before the deadline, decide early: reduce scope, ask for help, or move something else.',
      },
    ],
    questions: [],
  },
];

export const LEARNING_RESOURCES: LearningResource[] = drafts.map((d) => ({
  ...d,
  id: stableUuid('resource', d.slug),
  version: 1,
  provenance: PROVENANCE,
  reviewStatus: 'unreviewed',
  license: LICENSE,
}));

/** Approximate download size in bytes (UTF-8 JSON payload). */
export function resourceSize(r: LearningResource): number {
  let bytes = 0;
  for (const ch of JSON.stringify(r)) {
    const c = ch.codePointAt(0)!;
    bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * Shared demo data string embedded in every StackBlitz project.
 * Contains the Person interface, sample data array, and getRowId helper.
 */
export const DEMO_DATA_TS = `export interface Person {
  id: number;
  name: string;
  age: number;
  email: string;
  department: string;
  salary: number;
  status: string;
  startDate: string;
}

const NAMES = [
  'Alice Johnson', 'Bob Smith', 'Carol Lee', 'David Kim', 'Eve Torres',
  'Frank Wu', 'Grace Park', 'Henry Adams', 'Irene Costa', 'Jack Rivera',
  'Karen Liu', 'Leo Martinez', 'Mona Chen', 'Nate Brown', 'Olivia Scott',
  'Paul Davis', 'Quinn Foster', 'Rachel Green', 'Sam Wilson', 'Tina Hall',
  'Uma Patel', 'Vince Moore', 'Wendy Diaz', 'Xander Young', 'Yara King',
];

const DEPTS = ['Engineering', 'Marketing', 'Sales', 'Finance', 'Operations'];
const STATUSES = ['Active', 'Draft', 'Archived'];

export const people: Person[] = NAMES.map((name, i) => ({
  id: i + 1,
  name,
  age: 25 + (i % 30),
  email: \`\${name.split(' ')[0].toLowerCase()}@example.com\`,
  department: DEPTS[i % DEPTS.length],
  salary: 50000 + i * 3500,
  status: STATUSES[i % STATUSES.length],
  startDate: \`2024-\${String((i % 12) + 1).padStart(2, '0')}-15\`,
}));

export const getRowId = (p: Person) => p.id;
`;

export type CodeExample = { language: string; caption: string; code: string };

export const examples: Record<string, CodeExample> = {
  "day-2026-10-17": {
    language: "html",
    caption: "A small semantic page. This sample was not executed in the app.",
    code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Portfolio</title>
  </head>
  <body>
    <header><nav><a href="#work">Work</a></nav></header>
    <main>
      <h1>Ayush</h1>
      <img src="photo.jpg" alt="Ayush smiling outdoors" width="240" height="240" />
    </main>
  </body>
</html>`,
  },
  "day-2026-10-18": {
    language: "css",
    caption: "A mobile-first card row. This sample was not executed in the app.",
    code: `.cards { display: grid; gap: 1rem; }
@media (min-width: 40rem) {
  .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}`,
  },
  "day-2026-10-19": {
    language: "javascript",
    caption: "A function with an early return. This sample was not executed in the app.",
    code: `function largest(a, b, c) {
  if (a >= b && a >= c) return a;
  if (b >= a && b >= c) return b;
  return c;
}`,
  },
  "day-2026-10-20": {
    language: "javascript",
    caption: "map returns a new array. This sample was not executed in the app.",
    code: `const prices = [2, 4, 6];
const withTax = prices.map((price) => price * 1.1);`,
  },
  "day-2026-10-21": {
    language: "javascript",
    caption: "A counter closure. This sample was not executed in the app.",
    code: `function makeCounter() {
  let count = 0;
  return () => {
    count += 1;
    return count;
  };
}`,
  },
  "day-2026-10-22": {
    language: "javascript",
    caption: "await needs a try/catch when the promise can reject. This sample was not executed in the app.",
    code: `async function loadUser(id) {
  try {
    const response = await fetch(\`/api/users/\${id}\`);
    if (!response.ok) throw new Error("Request failed");
    return await response.json();
  } catch (error) {
    return null;
  }
}`,
  },
  "day-2026-10-24": {
    language: "typescript",
    caption: "unknown forces a check before use. This sample was not executed in the app.",
    code: `function readName(value: unknown): string {
  if (typeof value === "object" && value && "name" in value && typeof value.name === "string") {
    return value.name;
  }
  return "unknown";
}`,
  },
  "day-2026-10-25": {
    language: "tsx",
    caption: "State is replaced, not mutated. This sample was not executed in the app.",
    code: `function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((value) => value + 1)}>{count}</button>;
}`,
  },
  "day-2026-10-27": {
    language: "typescript",
    caption: "A Redux Toolkit slice. Immer allows the assignment. This sample was not executed in the app.",
    code: `const counterSlice = createSlice({
  name: "counter",
  initialState: { value: 0 },
  reducers: {
    incremented(state) {
      state.value += 1;
    },
  },
});`,
  },
  "day-2026-10-30": {
    language: "typescript",
    caption: "A thin route and an error middleware with four parameters. This sample was not executed in the app.",
    code: `app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ error: "Something went wrong" });
});`,
  },
  "day-2026-11-01": {
    language: "sql",
    caption: "An inner join keeps matching rows. This sample was not executed in the app.",
    code: `SELECT orders.id, customers.email
FROM orders
INNER JOIN customers ON customers.id = orders.customer_id
WHERE orders.status = 'paid';`,
  },
  "day-2026-11-02": {
    language: "javascript",
    caption: "A find query. This sample was not executed in the app.",
    code: `await db.collection("notes").find({ dayId: "day-2026-10-17" }).sort({ updatedAt: -1 }).toArray();`,
  },
  "day-2026-11-09": {
    language: "dockerfile",
    caption: "A small Node image. This sample was not executed in the app.",
    code: `FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
USER node
CMD ["node", "server.js"]`,
  },
  "day-2026-11-11": {
    language: "yaml",
    caption: "A workflow that stops when tests fail. This sample was not executed in the app.",
    code: `name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test`,
  },
};

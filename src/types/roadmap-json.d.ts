declare module "@/data/roadmap.json" {
  const value: {
    count: number;
    days: {
      id: string;
      date: string;
      weekday: string;
      weekId: string;
      weekTitle: string;
      title: string;
      targetLabel: string;
      targetMinutes: number;
      holiday: boolean;
      doneWhen: string;
      blocks: { title: string; concepts: string[] }[];
      practice: string[];
    }[];
  };
  export default value;
}

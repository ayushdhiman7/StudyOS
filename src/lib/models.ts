import mongoose, { Schema, type Model } from "mongoose";

function collection(name: string, schema: Schema): Model<Record<string, unknown>> {
  return (mongoose.models[name] as Model<Record<string, unknown>>) || mongoose.model(name, schema);
}

const daySchema = new Schema(
  {
    _id: String,
    date: String,
    weekday: String,
    weekId: String,
    weekTitle: String,
    title: String,
    targetLabel: String,
    targetMinutes: Number,
    holiday: Boolean,
    doneWhen: String,
    blocks: [{ title: String, concepts: [String], _id: false }],
    practice: [String],
  },
  { versionKey: false },
);

const completionSchema = new Schema(
  { _id: String, dayId: String, completedAt: String, updatedAt: String },
  { versionKey: false },
);

const dayStateSchema = new Schema(
  {
    _id: String,
    completedAt: String,
    skippedAt: String,
    scheduledDate: String,
    personalNotes: { type: String, default: "" },
    updatedAt: String,
  },
  { versionKey: false },
);

const noteSchema = new Schema(
  {
    _id: String,
    title: String,
    body: String,
    dayId: String,
    tags: [String],
    pinned: Boolean,
    forRevision: Boolean,
    createdAt: String,
    updatedAt: String,
  },
  { versionKey: false },
);

const conversationSchema = new Schema(
  { _id: String, title: String, dayId: String, style: String, createdAt: String, updatedAt: String },
  { versionKey: false },
);

const messageSchema = new Schema(
  { _id: String, conversationId: String, role: String, content: String, helpful: Boolean, createdAt: String },
  { versionKey: false },
);

const sessionSchema = new Schema(
  {
    _id: String,
    dayId: String,
    plannedSeconds: Number,
    elapsedSeconds: Number,
    status: String,
    startedAt: String,
    lastResumedAt: String,
    finishedAt: String,
    notes: String,
    breakReminder: Boolean,
    updatedAt: String,
  },
  { versionKey: false },
);

const questionSchema = new Schema(
  {
    _id: String,
    dayId: String,
    kind: String,
    prompt: String,
    choices: [String],
    answer: String,
    keywords: [String],
    explanation: String,
    topic: String,
    source: String,
  },
  { versionKey: false },
);

const attemptSchema = new Schema(
  {
    _id: String,
    dayId: String,
    startedAt: String,
    finishedAt: String,
    score: Number,
    total: Number,
    durationSeconds: Number,
    answers: Schema.Types.Mixed,
    weakTopics: [String],
  },
  { versionKey: false },
);

const revisionSchema = new Schema(
  {
    _id: String,
    dayId: String,
    noteId: String,
    title: String,
    dueDate: String,
    intervalDays: Number,
    stage: Number,
    status: String,
    confidence: Number,
    createdAt: String,
    updatedAt: String,
  },
  { versionKey: false },
);

const preferenceSchema = new Schema({ _id: String, data: Schema.Types.Mixed, updatedAt: String }, { versionKey: false });
const usageSchema = new Schema({ _id: String, count: Number }, { versionKey: false });

export const DayModel = collection("RoadmapDay", daySchema);
export const CompletionModel = collection("Completion", completionSchema);
export const DayStateModel = collection("DayState", dayStateSchema);
export const NoteModel = collection("Note", noteSchema);
export const ConversationModel = collection("Conversation", conversationSchema);
export const MessageModel = collection("Message", messageSchema);
export const SessionModel = collection("StudySession", sessionSchema);
export const QuestionModel = collection("QuizQuestion", questionSchema);
export const AttemptModel = collection("QuizAttempt", attemptSchema);
export const RevisionModel = collection("RevisionItem", revisionSchema);
export const PreferenceModel = collection("Preference", preferenceSchema);
export const UsageModel = collection("AiUsage", usageSchema);

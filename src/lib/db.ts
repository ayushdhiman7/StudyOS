import mongoose from "mongoose";

const cache = globalThis as unknown as { studyosConn?: Promise<typeof mongoose> };

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set. Add it to the server environment.");
  if (!cache.studyosConn) {
    mongoose.set("strictQuery", true);
    cache.studyosConn = mongoose
      .connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        dbName: "studyos",
      })
      .catch((error: unknown) => {
        cache.studyosConn = undefined;
        console.error("MongoDB connection failed", { name: error instanceof Error ? error.name : "Error" });
        throw new Error("MongoDB is not reachable. Check MONGO_URI, network access, and Atlas IP allowlist.");
      });
  }
  return cache.studyosConn;
}

export function mongoReady(): boolean {
  return mongoose.connection.readyState === 1;
}

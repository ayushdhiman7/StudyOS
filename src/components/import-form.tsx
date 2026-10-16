"use client";

import { useState } from "react";
import { importBackupAction } from "@/server/actions";
import { buttonClass } from "@/components/ui";

export function ImportForm() {
  const [message, setMessage] = useState("");
  const [raw, setRaw] = useState("");

  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm font-medium">
        Import backup JSON
        <input
          className="text-sm"
          type="file"
          accept="application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setRaw(await file.text());
            setMessage("File loaded. Import it, or confirm replace if notes already exist.");
          }}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          className={buttonClass("ghost")}
          type="button"
          disabled={!raw}
          onClick={async () => setMessage((await importBackupAction(raw, false)).error || "Imported.")}
        >
          Import
        </button>
        <button
          className={buttonClass("danger")}
          type="button"
          disabled={!raw}
          onClick={async () => {
            if (!confirm("Replace existing notes and progress that share the same ids?")) return;
            setMessage((await importBackupAction(raw, true)).error || "Imported and replaced matching records.");
          }}
        >
          Replace matching records
        </button>
      </div>
      {message ? <p className="text-sm text-muted">{message}</p> : null}
    </div>
  );
}

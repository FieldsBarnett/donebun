import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import initSqlJs from "sql.js";
import { ChevronLeft, Upload, FileJson, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface ImportDataProps {
  onBack: () => void;
}

export default function ImportData({ onBack }: ImportDataProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null);
  const importMutation = useMutation(api.import.importFromThings3);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setResult(null);
    setProgress(null);

    try {
      const SQL = await initSqlJs({
        locateFile: (file) => `/sqljs/${file}`,
      });

      const arrayBuffer = await file.arrayBuffer();
      const db = new SQL.Database(new Uint8Array(arrayBuffer));

      // 1. Get Areas (Categories)
      const areasResult = db.exec("SELECT uuid, title FROM TMArea");
      const categories = areasResult[0]?.values.map((v) => ({
        originalId: v[0] as string,
        name: v[1] as string,
      })) || [];

      // 2. Get Tasks (type 0 = task, trashed 0 = not deleted)
      // We'll also get the checklist items for each task
      const tasksResult = db.exec(`
        SELECT 
          uuid, title, notes, status, startDate, deadline, area, project, rt1_recurrenceRule 
        FROM TMTask 
        WHERE type = 0 AND trashed = 0
      `);

      if (!tasksResult[0]) {
        throw new Error("No tasks found in the database.");
      }

      const rawTasks = tasksResult[0].values;
      const totalTasks = rawTasks.length;
      setProgress({ current: 0, total: totalTasks });

      // 3. Get Checklist Items
      const checklistResult = db.exec("SELECT task, title, status FROM TMChecklistItem");
      const checklistMap = new Map<string, any[]>();
      checklistResult[0]?.values.forEach((v) => {
        const taskId = v[0] as string;
        const items = checklistMap.get(taskId) || [];
        items.push({
          text: v[1] as string,
          completed: v[2] === 2, // 2 = completed in Things 3 checklist items?
        });
        checklistMap.set(taskId, items);
      });

      const formattedTasks: any[] = [];

      for (const row of rawTasks) {
        const [uuid, title, notes, status, startDate, deadline, area, _project, recurrenceBlob] = row;
        
        // Map status: 0=open, 2=completed, 3=canceled
        let mappedStatus: "active" | "completed" | "deleted" = "active";
        if (status === 2) mappedStatus = "completed";
        if (status === 3) mappedStatus = "deleted";

        const originalAreaId = (area as string) || undefined;

        // Map Due Date: Use deadline if available, else startDate
        let dueDate: string | undefined = undefined;
        const ts = (deadline as number) || (startDate as number);
        if (ts) {
          dueDate = new Date(ts * 1000).toISOString();
        }

        // Parse Recurrence
        let recurrence: any = undefined;
        if (recurrenceBlob) {
          try {
            const plistStr = new TextDecoder().decode(recurrenceBlob as Uint8Array);
            const parsedRecurrence = parseThings3Recurrence(plistStr);
            if (parsedRecurrence) {
              const { startDate: recStartDate, endDate, ...rule } = parsedRecurrence;
              recurrence = { ...rule, endDate };
              
              // If no dueDate from columns, use the start date from the recurrence rule
              if (!dueDate && recStartDate) {
                dueDate = recStartDate;
              }
            }
          } catch (e) {
            console.error("Failed to parse recurrence for task", title, e);
          }
        }

        formattedTasks.push({
          title: (title as string) || "Untitled Task",
          description: (notes as string) || undefined,
          status: mappedStatus,
          originalAreaId,
          dueDate,
          recurrence,
          checklist: checklistMap.get(uuid as string),
        });
      }

      // 4. Send to Convex in batches of 100 to avoid limits
      const batchSize = 100;
      let importedCount = 0;
      for (let i = 0; i < formattedTasks.length; i += batchSize) {
        const batch = formattedTasks.slice(i, i + batchSize);
        // Only send categories on the first batch
        const res = await importMutation({
          categories: i === 0 ? categories : [],
          tasks: batch,
        });
        importedCount += res.count;
        setProgress({ current: Math.min(i + batchSize, totalTasks), total: totalTasks });
      }

      setResult({ success: true, count: importedCount });
    } catch (err: any) {
      console.error(err);
      setResult({ success: false, error: err.message });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-6 py-4 border-b border-[var(--color-hairline)] flex items-center gap-4 sticky top-0 bg-white z-10">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 hover:bg-[var(--color-surface-soft)] rounded-full transition-colors text-[var(--color-muted)]"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-xl font-bold tracking-tight">Import Data</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-12">
        <div className="max-w-xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-[var(--color-surface-soft)] rounded-3xl flex items-center justify-center mx-auto mb-6">
              <FileJson size={40} className="text-[#007aff]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Import from Things 3</h1>
            <p className="text-[var(--color-muted)] text-lg leading-relaxed">
              Upload your <code className="bg-[var(--color-surface-soft)] px-1.5 py-0.5 rounded text-black font-medium">main.sqlite</code> file to bring your tasks, projects, and repeating rules into Donebun.
            </p>
          </div>

          <div className="space-y-6">
            {!isImporting && !result && (
              <label className="relative block group cursor-pointer">
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".sqlite" 
                  onChange={handleFileUpload}
                />
                <div className="border-2 border-dashed border-[var(--color-hairline)] group-hover:border-[#007aff] group-hover:bg-[#007aff]/5 rounded-[40px] p-12 transition-all flex flex-col items-center gap-4">
                  <div className="w-14 h-14 bg-[#007aff]/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload size={24} className="text-[#007aff]" />
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold">Select main.sqlite</p>
                    <p className="text-[var(--color-muted)] mt-1 font-medium">Click to browse your files</p>
                  </div>
                </div>
              </label>
            )}

            {isImporting && (
              <div className="bg-[var(--color-surface-soft)] rounded-[40px] p-12 text-center space-y-6 border border-[var(--color-hairline)]">
                <Loader2 size={40} className="text-[#007aff] animate-spin mx-auto" />
                <div className="space-y-2">
                  <p className="text-2xl font-bold">Importing tasks...</p>
                  {progress && (
                    <div className="space-y-3">
                      <div className="w-full bg-white rounded-full h-3 overflow-hidden border border-[var(--color-hairline)]">
                        <div 
                          className="bg-[#007aff] h-full transition-all duration-300"
                          style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-sm font-bold text-[var(--color-muted)] uppercase tracking-wider">
                        {progress.current} of {progress.total} tasks processed
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {result && (
              <div className={`rounded-[40px] p-12 text-center space-y-6 border ${result.success ? "bg-[#34c759]/10 border-[#34c759]/20" : "bg-[#ff3b30]/10 border-[#ff3b30]/20"}`}>
                {result.success ? (
                  <CheckCircle2 size={48} className="text-[#34c759] mx-auto" />
                ) : (
                  <AlertCircle size={48} className="text-[#ff3b30] mx-auto" />
                )}
                <div className="space-y-2">
                  <p className="text-2xl font-bold">
                    {result.success ? "Import successful!" : "Import failed"}
                  </p>
                  <p className="text-lg font-medium opacity-80">
                    {result.success 
                      ? `We've successfully imported ${result.count} tasks into your family.`
                      : result.error || "An unexpected error occurred during import."}
                  </p>
                </div>
                {result.success && (
                  <button 
                    onClick={onBack}
                    className="bg-black text-white px-8 py-4 rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Return to Settings
                  </button>
                )}
                {!result.success && (
                  <button 
                    onClick={() => setResult(null)}
                    className="bg-black text-white px-8 py-4 rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Try Again
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="bg-[var(--color-surface-soft)] rounded-3xl p-8 space-y-4">
            <h3 className="text-sm font-bold text-[var(--color-muted)] uppercase tracking-wider px-1">How to find your file</h3>
            <p className="text-base leading-relaxed font-medium">
              On macOS, you can find your Things 3 database at:
            </p>
            <div className="bg-white p-4 rounded-2xl border border-[var(--color-hairline)] font-mono text-sm break-all leading-relaxed">
              ~/Library/Group Containers/JLMPQHK86C.com.culturedcode.ThingsMac/Things Database.thingsdatabase/main.sqlite
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Simple Things 3 Plist Recurrence Parser
 */
function parseThings3Recurrence(plistStr: string) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(plistStr, "text/xml");
  const dict = xmlDoc.querySelector("dict");
  if (!dict) return null;

  const data: Record<string, any> = {};
  let currentKey = "";

  for (let i = 0; i < dict.children.length; i++) {
    const child = dict.children[i];
    if (child.tagName === "key") {
      currentKey = child.textContent || "";
    } else if (currentKey) {
      if (child.tagName === "integer") {
        data[currentKey] = parseInt(child.textContent || "0", 10);
      } else if (child.tagName === "real") {
        data[currentKey] = parseFloat(child.textContent || "0");
      } else if (child.tagName === "array") {
        // Handle offset array
        const offsets: any[] = [];
        const items = child.querySelectorAll("dict");
        items.forEach(item => {
          const offset: any = {};
          let k = "";
          for (let j = 0; j < item.children.length; j++) {
            const c = item.children[j];
            if (c.tagName === "key") k = c.textContent || "";
            else if (k) {
              offset[k] = parseInt(c.textContent || "0", 10);
              k = "";
            }
          }
          offsets.push(offset);
        });
        data[currentKey] = offsets;
      }
      currentKey = "";
    }
  }

  // Map to our schema
  // fu: 16384 (Daily), 256 (Weekly), 8 (Monthly), 4 (Yearly)
  let frequency: "daily" | "weekly" | "monthly" | "yearly" = "daily";
  if (data.fu === 16384) frequency = "daily";
  else if (data.fu === 256) frequency = "weekly";
  else if (data.fu === 8) frequency = "monthly";
  else if (data.fu === 4) frequency = "yearly";

  const strategy: "fixed" | "completion" = data.tp === 1 ? "completion" : "fixed";
  const interval = data.fa || 1;

  let daysOfWeek: number[] | undefined = undefined;
  let dayOfMonth: number | undefined = undefined;

  if (frequency === "weekly" && data.of && data.of.length > 0) {
    daysOfWeek = data.of.map((o: any) => o.wd - 1).filter((d: number) => !isNaN(d));
  } else if (frequency === "monthly" && data.of && data.of.length > 0) {
    dayOfMonth = data.of[0].dy;
  } else if (frequency === "yearly" && data.of && data.of.length > 0) {
     dayOfMonth = data.of[0].dy;
  }

  // Extract dates from plist
  // ia = initial anchor, sr = start, ed = end
  const startTs = data.ia || data.sr;
  const startDate = startTs ? new Date(startTs * 1000).toISOString() : undefined;
  
  // Refine dayOfMonth/daysOfWeek from startDate if missing
  if (startDate) {
    const date = new Date(startDate);
    if (frequency === "monthly" && !dayOfMonth) {
      dayOfMonth = date.getDate();
    } else if (frequency === "weekly" && (!daysOfWeek || daysOfWeek.length === 0)) {
      daysOfWeek = [date.getDay()];
    }
  }

  // Things 3 often uses a very far future date for "no end date" (e.g. 64092211200)
  // We'll ignore it if it's beyond year 3000
  let endDate: string | undefined = undefined;
  if (data.ed && data.ed < 32503680000) { // 32503680000 = year 3000
    endDate = new Date(data.ed * 1000).toISOString();
  }

  return {
    strategy,
    frequency,
    interval,
    daysOfWeek,
    dayOfMonth,
    startDate,
    endDate,
  };
}

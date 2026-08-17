import { useState } from "react";
import Editor from "@monaco-editor/react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Play, Terminal } from "lucide-react";
import { runCodeSnippet } from "@/lib/code-runner.functions";
import {
  CODING_LANGUAGES,
  codingLanguageById,
  isCodingLanguageId,
  starterTemplate,
  type CodingLanguageId,
} from "@/lib/coding-languages";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CodeConsoleProps = {
  value: string;
  language: string;
  disabled?: boolean;
  onChange: (code: string) => void;
  onLanguageChange?: (language: CodingLanguageId) => void;
  allowLanguageSwitch?: boolean;
};

export function CodeConsole({
  value,
  language,
  disabled,
  onChange,
  onLanguageChange,
  allowLanguageSwitch = false,
}: CodeConsoleProps) {
  const runCode = useServerFn(runCodeSnippet);
  const lang = codingLanguageById(isCodingLanguageId(language) ? language : "python");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);

  async function handleRun() {
    if (disabled) return;
    setRunning(true);
    setOutput("Running…");
    try {
      const result = await runCode({
        data: {
          language: lang.id,
          source: value || starterTemplate(lang.id),
          stdin,
        },
      });
      const parts = [
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
        result.exitCode !== null ? `exit code: ${result.exitCode}` : "",
      ].filter(Boolean);
      setOutput(parts.join("\n\n") || "(no output)");
      if (!result.ok) {
        toast.error(
          result.stderr?.includes("timeout") ? "Execution timed out" : "Program exited with errors",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Run failed";
      const friendly = message.includes("timed out")
        ? message
        : message.includes("unavailable")
          ? "Code runner is temporarily unavailable. Try again in a moment."
          : message;
      setOutput(friendly);
      toast.error(friendly);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        {allowLanguageSwitch && onLanguageChange ? (
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={lang.id}
            disabled={disabled}
            onChange={(e) => {
              const next = e.target.value as CodingLanguageId;
              onLanguageChange(next);
              if (!value.trim()) onChange(starterTemplate(next));
            }}
          >
            {CODING_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-medium">{lang.label}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled || running}
            onClick={handleRun}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {running ? "Running…" : "Run"}
          </Button>
        </div>
      </div>

      <div className="min-h-[280px] border-b border-border">
        <Editor
          height="280px"
          language={lang.monaco}
          theme="vs-dark"
          value={value}
          onChange={(v) => onChange(v ?? "")}
          options={{
            readOnly: !!disabled,
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
          }}
        />
      </div>

      <div className="grid gap-3 p-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Standard input (optional)</Label>
          <Textarea
            rows={4}
            className="font-mono text-xs"
            disabled={disabled}
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Input passed to your program"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Terminal className="h-3.5 w-3.5" /> Console output
          </Label>
          <pre className="h-[104px] overflow-auto rounded-md border border-border bg-zinc-950 p-3 font-mono text-xs text-zinc-100">
            {output || "Run your code to see output here."}
          </pre>
        </div>
      </div>
    </div>
  );
}

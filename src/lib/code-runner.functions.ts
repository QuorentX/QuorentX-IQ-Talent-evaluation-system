import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { codingLanguageById, isCodingLanguageId } from "@/lib/coding-languages";

const runSchema = z.object({
  language: z.string().min(1).max(20),
  source: z.string().max(50000),
  stdin: z.string().max(10000).optional(),
});

type PistonResponse = {
  language?: string;
  run?: {
    stdout?: string;
    stderr?: string;
    code?: number;
    output?: string;
    signal?: string | null;
  };
  compile?: {
    stdout?: string;
    stderr?: string;
    code?: number;
  };
  message?: string;
};

/**
 * Runs candidate code in an isolated public sandbox (Piston).
 * Authenticated users only; source size limited.
 */
export const runCodeSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => runSchema.parse(input))
  .handler(async ({ data }) => {
    if (!isCodingLanguageId(data.language)) {
      throw new Error("Unsupported language");
    }
    const lang = codingLanguageById(data.language);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    try {
      const res = await fetch("https://emkc.org/api/v2/piston/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          language: lang.piston.language,
          version: lang.piston.version,
          files: [{ content: data.source }],
          stdin: data.stdin ?? "",
          run_timeout: 3000,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Code runner unavailable (${res.status}): ${text.slice(0, 200)}`);
      }

      const payload = (await res.json()) as PistonResponse;
      const compileErr = payload.compile?.stderr?.trim() || "";
      const stderr = payload.run?.stderr?.trim() || "";
      const stdout = payload.run?.stdout ?? payload.run?.output ?? "";

      return {
        language: lang.id,
        stdout: String(stdout).slice(0, 20000),
        stderr: (compileErr || stderr || payload.message || "").slice(0, 20000),
        exitCode: payload.run?.code ?? payload.compile?.code ?? null,
        ok: !compileErr && (payload.run?.code ?? 0) === 0,
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          "Code execution timed out (12s). Simplify the program or try again — the public runner may be slow.",
        );
      }
      throw err instanceof Error ? err : new Error("Code execution failed");
    } finally {
      clearTimeout(timer);
    }
  });

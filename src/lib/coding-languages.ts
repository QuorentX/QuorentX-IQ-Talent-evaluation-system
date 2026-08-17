export const CODING_LANGUAGES = [
  {
    id: "python",
    label: "Python",
    monaco: "python",
    piston: { language: "python", version: "3.10.0" },
  },
  { id: "sql", label: "SQL", monaco: "sql", piston: { language: "sqlite3", version: "3.36.0" } },
  { id: "java", label: "Java", monaco: "java", piston: { language: "java", version: "15.0.2" } },
  { id: "c", label: "C", monaco: "c", piston: { language: "c", version: "10.2.0" } },
  { id: "cpp", label: "C++", monaco: "cpp", piston: { language: "c++", version: "10.2.0" } },
] as const;

export type CodingLanguageId = (typeof CODING_LANGUAGES)[number]["id"];

export function isCodingLanguageId(value: string): value is CodingLanguageId {
  return CODING_LANGUAGES.some((l) => l.id === value);
}

export function codingLanguageById(id: string | null | undefined) {
  return CODING_LANGUAGES.find((l) => l.id === id) ?? CODING_LANGUAGES[0];
}

export function starterTemplate(id: CodingLanguageId): string {
  switch (id) {
    case "python":
      return `# Write your solution\ndef solve():\n    pass\n\nif __name__ == "__main__":\n    solve()\n`;
    case "sql":
      return `-- Write your SQL query\nSELECT 1;\n`;
    case "java":
      return `public class Main {\n    public static void main(String[] args) {\n        // Write your solution\n        System.out.println("Hello");\n    }\n}\n`;
    case "c":
      return `#include <stdio.h>\n\nint main(void) {\n    // Write your solution\n    printf("Hello\\n");\n    return 0;\n}\n`;
    case "cpp":
      return `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution\n    cout << "Hello" << endl;\n    return 0;\n}\n`;
  }
}

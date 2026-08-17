import { createServerFn } from "@tanstack/react-start";
import { PARENT, type ParentBrandInfo } from "@/lib/brand";

/**
 * Pulls live meta from www.quorentx.com so the landing page stays in sync.
 * Falls back to baked-in defaults when the fetch fails.
 */
export const fetchParentBrandInfo = createServerFn({ method: "GET" }).handler(
  async (): Promise<ParentBrandInfo> => {
    const fallback: ParentBrandInfo = {
      title: PARENT.title,
      description: PARENT.description,
      ogDescription: PARENT.ogDescription,
      url: PARENT.url,
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const res = await fetch(PARENT.url, {
        signal: controller.signal,
        headers: { Accept: "text/html", "User-Agent": "QuorentX-IQ-Landing/1.0" },
      });
      clearTimeout(timer);
      if (!res.ok) return fallback;

      const html = await res.text();
      const pick = (re: RegExp) => {
        const m = html.match(re);
        return m?.[1]?.replace(/\s+/g, " ").trim() || "";
      };

      const title = pick(/<title[^>]*>([^<]+)<\/title>/i) || fallback.title;
      const description =
        pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
        pick(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) ||
        fallback.description;
      const ogDescription =
        pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
        pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i) ||
        fallback.ogDescription;

      return { title, description, ogDescription, url: PARENT.url };
    } catch {
      return fallback;
    }
  },
);

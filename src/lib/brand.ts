/** QuorentX IQ product + parent brand */
export const PRODUCT = {
  name: "QuorentX",
  mark: "IQ",
  fullName: "QuorentX IQ",
  tagline: "Smarter interviews, better hires",
  positioning:
    "Help your team run consistent interviews, score candidates with clear criteria, and see hiring results in one place.",
  shortDescription:
    "QuorentX IQ brings scheduling, structured interviews, assessments, and hiring insights together for growing companies.",
  iqMeaning: "Built for clearer hiring decisions — from first screen to final offer.",
  buyers: "talent and hiring teams",
} as const;

/** Parent company — defaults match live meta on https://www.quorentx.com */
export const PARENT = {
  name: "QuorentX",
  url: "https://www.quorentx.com",
  title: "QuorentX | Intelligent Data & AI Solutions",
  description:
    "QuorentX helps enterprises with AI solutions, advanced analytics, and digital infrastructure that support better decisions.",
  ogDescription:
    "AI solutions and analytics for modern enterprises — from QuorentX.",
  keywords: [
    "Data Analytics",
    "AI",
    "Machine Learning",
    "Data Engineering",
    "BI Dashboards",
    "Business Intelligence",
  ],
  contactEmail: "quorentanalytics@gmail.com",
  linkedIn: "https://www.linkedin.com/company/quorentx",
} as const;

export const BRAND_COLORS = {
  primary: "#185FA5",
  navy: "#042C53",
  teal: "#0F6E56",
  warm: "#F1EFE8",
  ink: "#2C2C2A",
} as const;

export type ParentBrandInfo = {
  title: string;
  description: string;
  ogDescription: string;
  url: string;
};

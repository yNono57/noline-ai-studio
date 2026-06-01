export type ClientBrand = {
  structureName: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  typography: string;
  socials: string;
  email: string;
  website: string;
};

const STORAGE_KEY = "noline-client-brand";

export const defaultBrand: ClientBrand = {
  structureName: "",
  logo: "",
  primaryColor: "#FF6B00",
  secondaryColor: "#FFFFFF",
  typography: "Arial",
  socials: "",
  email: "",
  website: ""
};

export function readBrand(): ClientBrand {
  if (typeof window === "undefined") return defaultBrand;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultBrand, ...(JSON.parse(raw) as ClientBrand) } : defaultBrand;
  } catch {
    return defaultBrand;
  }
}

export function saveBrand(brand: ClientBrand) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(brand));
}

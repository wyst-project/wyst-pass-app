export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const getApiUrl = (path: string) => `${API_URL}${path}`;

export const getUploadUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
};

export const getAuthHeaders = (): HeadersInit => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("sessionToken") : null;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

export const getAuthHeadersForUpload = (): HeadersInit => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("sessionToken") : null;
  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

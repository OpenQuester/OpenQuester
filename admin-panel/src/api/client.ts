import axios, { type AxiosInstance } from "axios";

// Single place to listen for auth invalidation (used in AuthContext)
export const UNAUTHORIZED_EVENT = "app:unauthorized";

export function createApiClient(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    withCredentials: true, // send cookies (session)
    headers: { "Content-Type": "application/json" },
  });

  instance.interceptors.response.use(
    (r) => r,
    (error) => {
      // Emit event instead of coupling every call to auth logic
      if (error.response?.status === 401) {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

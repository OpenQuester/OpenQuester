export function makePng(width?: number, height?: number, rgb?: number[]): Buffer;
export function demoPackage(title: string, imageMd5: string): unknown;
export function seedPackage(base: string, title?: string): Promise<{ id: number; title: string }>;
export function seedBigPackage(
  base: string,
  title?: string,
): Promise<{ id: number; title: string }>;
export function seedMediaPackage(
  base: string,
  title?: string,
): Promise<{ id: number; title: string }>;
export function seedAllPlayPackage(
  base: string,
  title?: string,
): Promise<{ id: number; title: string }>;

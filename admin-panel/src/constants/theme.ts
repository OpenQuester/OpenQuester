export enum StatGradients {
  BLUE = "bg-gradient-to-br from-blue-500 to-blue-600",
  GREEN = "bg-gradient-to-br from-green-500 to-green-600",
  GRAY = "bg-gradient-to-br from-gray-500 to-gray-600",
  RED = "bg-gradient-to-br from-red-500 to-red-600",
  PURPLE = "bg-gradient-to-br from-purple-500 to-purple-600",
}

export type StatGradientKey = keyof typeof StatGradients;

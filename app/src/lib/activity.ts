export type ActivityLogEntry = {
  id: string;
  message: string;
  time: string;
  tone: "info" | "success" | "error";
};

import { authService } from "./auth-service";
import { getConfig } from "../lib/config";

export interface RestoreCounts {
  activities: number;
  timeRecords: number;
  notes: number;
  routines: number;
  routineActivities: number;
  activityRecords: number;
  transactions: number;
  payments: number;
  mealLogs: number;
  exercises: number;
  workoutSessions: number;
}

interface RestoreResponse {
  message: string;
  data: RestoreCounts;
}

const DEFAULT_FILENAME = "life-tracker-backup.xlsx";

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/filename="?([^";]+)"?/);
  return match ? match[1] : null;
}

class DataService {
  private get baseUrl(): string {
    return getConfig().apiUrl;
  }

  /**
   * Downloads the user's full backup as an XLSX file and triggers a
   * browser download. Web only.
   */
  async exportData(): Promise<string> {
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/users/me/data/export`,
    );
    if (!response.ok) {
      throw new Error("Failed to export data");
    }
    const blob = await response.blob();
    const filename =
      filenameFromDisposition(response.headers.get("Content-Disposition")) ??
      DEFAULT_FILENAME;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return filename;
  }

  /**
   * Restores the user's data from an XLSX backup. Destructive: all current
   * data is deleted and replaced with the file's contents.
   */
  async importData(file: File): Promise<RestoreCounts> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await authService.makeAuthenticatedRequest(
      `${this.baseUrl}/users/me/data/import`,
      {
        method: "POST",
        body: formData,
      },
    );
    if (!response.ok) {
      let message = "Failed to import data";
      try {
        const error = (await response.json()) as { error?: string };
        if (error.error) message = error.error;
      } catch {
        // keep default message
      }
      throw new Error(message);
    }
    const result: RestoreResponse = await response.json();
    return result.data;
  }
}

export const dataService = new DataService();

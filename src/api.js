import { initialData } from "./data.js";

const STORAGE_KEY = "orbit-student-workspace-v1";

function readStore() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : structuredClone(initialData);
  } catch (error) {
    throw new Error(`Unable to load your saved workspace: ${error.message}`);
  }
}

function saveStore(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    throw new Error(`Unable to save your changes: ${error.message}`);
  }
}

export const workspaceApi = {
  async getWorkspace() {
    return readStore();
  },
  async saveWorkspace(data) {
    saveStore(data);
    return data;
  },
};

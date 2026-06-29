import fs from 'fs';
import path from 'path';

export interface HistoryEvent {
  id: string;
  timestamp: string;
  labId: string;
  action: string;
  status: 'success' | 'failed' | 'info';
  message: string;
}

const HISTORY_FILE = path.join(__dirname, '../../history.json');

class HistoryService {
  private events: HistoryEvent[] = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory() {
    try {
      if (fs.existsSync(HISTORY_FILE)) {
        const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
        this.events = JSON.parse(data);
      } else {
        this.events = [];
      }
    } catch (e) {
      this.events = [];
    }
  }

  private saveHistory() {
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(this.events, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save deployment history:', e);
    }
  }

  addEvent(labId: string, action: string, status: 'success' | 'failed' | 'info', message: string): HistoryEvent {
    const event: HistoryEvent = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      labId,
      action,
      status,
      message
    };
    this.events.unshift(event); // newest first
    // Limit to last 100 entries
    if (this.events.length > 100) {
      this.events = this.events.slice(0, 100);
    }
    this.saveHistory();
    return event;
  }

  getEvents(): HistoryEvent[] {
    return this.events;
  }

  clearHistory() {
    this.events = [];
    this.saveHistory();
  }
}

export default new HistoryService();

import type { OndcRealtimeEvent, WebSocketStatus } from '../types/ondc';
import { getWebSocketBaseUrl } from '../utils/environment';

type EventCallback = (event: OndcRealtimeEvent) => void;
type StatusCallback = (status: WebSocketStatus) => void;

class OndcSocketService {
  private socket?: WebSocket;
  private transactionId?: string;
  private eventSubscribers = new Set<EventCallback>();
  private statusSubscribers = new Set<StatusCallback>();
  private reconnectTimer?: number;
  private reconnectAttempts = 0;
  private manuallyClosed = false;

  connect(transactionId: string): void {
    if (this.socket && this.transactionId === transactionId && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    this.disconnect();
    this.transactionId = transactionId;
    this.manuallyClosed = false;
    this.emitStatus('CONNECTING');
    this.openSocket();
  }

  disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
    }
    this.emitStatus('DISCONNECTED');
  }

  subscribe(callback: EventCallback): () => void {
    this.eventSubscribers.add(callback);
    return () => this.unsubscribe(callback);
  }

  unsubscribe(callback: EventCallback): void {
    this.eventSubscribers.delete(callback);
  }

  subscribeStatus(callback: StatusCallback): () => void {
    this.statusSubscribers.add(callback);
    return () => this.statusSubscribers.delete(callback);
  }

  private openSocket(): void {
    if (!this.transactionId) {
      return;
    }

    const baseUrl = this.resolveWebSocketBaseUrl();
    const socketUrl = `${baseUrl}/ws/ondc/${encodeURIComponent(this.transactionId)}`;
    console.info('Connecting websocket:', socketUrl);
    this.socket = new WebSocket(socketUrl);

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      console.info('WebSocket connected');
      this.emitStatus('CONNECTED');
    };

    this.socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as OndcRealtimeEvent;
        this.eventSubscribers.forEach((callback) => callback(event));
      } catch {
        this.emitStatus('ERROR');
      }
    };

    this.socket.onerror = () => {
      this.emitStatus('ERROR');
    };

    this.socket.onclose = () => {
      this.socket = undefined;
      console.info('WebSocket disconnected');
      if (this.manuallyClosed) {
        this.emitStatus('DISCONNECTED');
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    console.info('WebSocket reconnecting');
    this.emitStatus('RECONNECTING');
    const delay = Math.min(1000 * this.reconnectAttempts, 8000);
    this.reconnectTimer = window.setTimeout(() => this.openSocket(), delay);
  }

  private emitStatus(status: WebSocketStatus): void {
    this.statusSubscribers.forEach((callback) => callback(status));
  }

  private resolveWebSocketBaseUrl(): string {
    return getWebSocketBaseUrl();
  }
}

export const ondcSocketService = new OndcSocketService();

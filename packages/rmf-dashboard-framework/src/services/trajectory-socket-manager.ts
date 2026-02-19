import EventEmitter from 'eventemitter3';

type Events = {
  updated: [];
};

export default class TrajectorySocketManager extends EventEmitter<Events> {
  private _ongoingRequest: Promise<MessageEvent> | null = null;

  private _listenOnce<K extends keyof WebSocketEventMap>(
    event: K,
    webSocket: WebSocket,
    listener: (e: WebSocketEventMap[K]) => unknown,
  ): void {
    webSocket.addEventListener(event, (e) => {
      webSocket.removeEventListener(event, listener);
      listener(e);
    });
  }

  /**
   * Sends a message and waits for response from the server.
   *
   * @remarks This is an alternative to the old implementation of creating a promise, storing the
   * resolver and processing each message in an event loop. Advantage of this is that each message
   * processing logic can be self-contained without a need for a switch or if elses.
   */
  protected async send(
    payload: WebSocketSendParam0T,
    webSocket: WebSocket | undefined,
  ): Promise<MessageEvent> {
    if (!webSocket) throw Error('Websocket not initialized!');
    if (webSocket.readyState === WebSocket.CONNECTING) {
      await new Promise<void>((resolve, reject) => {
        const onOpen = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(Error('Websocket connection failed'));
        };
        const onClose = () => {
          cleanup();
          reject(Error('Websocket closed before opening'));
        };
        const cleanup = () => {
          webSocket.removeEventListener('open', onOpen);
          webSocket.removeEventListener('error', onError);
          webSocket.removeEventListener('close', onClose);
        };
        webSocket.addEventListener('open', onOpen);
        webSocket.addEventListener('error', onError);
        webSocket.addEventListener('close', onClose);
      });
    }
    if (webSocket.readyState !== WebSocket.OPEN) {
      throw Error(`Websocket is not open (state=${webSocket.readyState})`);
    }

    // response should come in the order that requests are sent, this should allow multiple messages
    // in-flight while processing the responses in the order they are sent.
    // waits for the earlier response to be processed.
    if (this._ongoingRequest) {
      await this._ongoingRequest;
    }

    this._ongoingRequest = new Promise((res) => {
      this._listenOnce('message', webSocket, (e) => {
        this._ongoingRequest = null;
        res(e);
      });
      // Listen first, then send, so a fast local response cannot be missed.
      webSocket.send(payload);
    });
    return this._ongoingRequest;
  }
}

type WebSocketSendParam0T = Parameters<WebSocket['send']>[0];

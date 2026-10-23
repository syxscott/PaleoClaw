import "@solidjs/web";

declare module "@solidjs/web" {
  namespace JSX {
    interface IntrinsicElements {
      "workboard-inline-text": HTMLAttributes<HTMLElement>;
      "paleoclaw-workboard-session-status": HTMLAttributes<HTMLElement>;
      "paleoclaw-workboard-toast": HTMLAttributes<HTMLElement>;
    }
  }
}

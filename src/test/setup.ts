import "@testing-library/jest-dom";

if (typeof window !== "undefined") {
  if (!window.PointerEvent) {
    class MockPointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, props: any = {}) {
        super(type, props);
        this.pointerId = props.pointerId || 0;
        this.pointerType = props.pointerType || "mouse";
      }
    }
    // @ts-ignore
    window.PointerEvent = MockPointerEvent;
  }
}


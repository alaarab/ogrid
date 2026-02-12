// Mock for @angular/cdk/overlay in tests
class MockOverlay {
  position() {
    return {
      flexibleConnectedTo() {
        return {
          withPositions() {
            return this;
          }
        };
      }
    };
  }

  create(config) {
    return {
      attach: jest.fn(),
      detach: jest.fn(),
      dispose: jest.fn(),
      backdropClick: () => ({
        subscribe: jest.fn()
      })
    };
  }
}

class MockComponentPortal {
  constructor(component) {
    this.component = component;
  }
}

module.exports = {
  Overlay: MockOverlay,
  OverlayModule: class MockOverlayModule {},
  ComponentPortal: MockComponentPortal,
  CdkOverlayOrigin: class MockCdkOverlayOrigin {},
};

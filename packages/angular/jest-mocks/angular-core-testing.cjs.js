/**
 * Mock for @angular/core/testing in Jest
 */

class ComponentFixture {
  constructor(componentInstance) {
    this.componentInstance = componentInstance;
    this.debugElement = {
      query: () => null,
      queryAll: () => [],
      nativeElement: document.createElement('div'),
    };
    this.nativeElement = this.debugElement.nativeElement;
    this.componentRef = {
      setInput: (name, value) => {
        this.componentInstance[name] = () => value;
      },
    };
  }

  detectChanges() {
    // Trigger change detection
  }
}

class TestBed {
  static configureTestingModule(config) {
    return {
      compileComponents: () => Promise.resolve(),
    };
  }

  static createComponent(componentClass) {
    const instance = new componentClass();
    return new ComponentFixture(instance);
  }
}

module.exports = {
  ComponentFixture,
  TestBed,
  fakeAsync: (fn) => fn,
  tick: (millis) => {},
};

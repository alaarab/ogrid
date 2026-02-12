/**
 * Mock for @angular/platform-browser in Jest
 */

class By {
  static css(selector) {
    return (debugElement) => {
      // Simple CSS selector matching
      return debugElement;
    };
  }
}

module.exports = {
  By,
};

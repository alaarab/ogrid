// Mock for any primevue/* sub-module import.
// PrimeVue components use default exports, so we export a stub component as default.

const stubComponent = { name: 'PrimeVueStub', render: () => null };

module.exports = stubComponent;
module.exports.default = stubComponent;

// Mock vuetify/components for Jest smoke tests.
// Provides stub Vue component objects for all Vuetify components used by ogrid-vue-vuetify.

const stubComponent = (name) => ({ name, render: () => null });

module.exports = {
  VBtn: stubComponent('VBtn'),
  VIcon: stubComponent('VIcon'),
  VMenu: stubComponent('VMenu'),
  VList: stubComponent('VList'),
  VListItem: stubComponent('VListItem'),
  VDivider: stubComponent('VDivider'),
  VSelect: stubComponent('VSelect'),
  VTextField: stubComponent('VTextField'),
  VCheckbox: stubComponent('VCheckbox'),
  VProgressCircular: stubComponent('VProgressCircular'),
  VTooltip: stubComponent('VTooltip'),
  VAvatar: stubComponent('VAvatar'),
};

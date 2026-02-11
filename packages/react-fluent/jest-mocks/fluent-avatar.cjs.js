const React = require('react');

/**
 * Minimal Jest mock for @fluentui/react-avatar.
 * Provides a simple renderable Avatar component so that
 * tests depending on @fluentui/react-components can run.
 */

function Avatar(props) {
  const { name, image, children, ...rest } = props || {};
  const content = children || (name ? String(name).charAt(0) : null);

  return React.createElement(
    'div',
    {
      'data-mock': 'Avatar',
      'data-name': name,
      'data-image-src': image && image.src,
      ...rest,
    },
    content
  );
}

Avatar.displayName = 'Avatar';

module.exports = {
  Avatar,
};


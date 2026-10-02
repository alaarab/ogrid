# @alaarab/ogrid-react

React hooks and headless components for OGrid data grids.

## Install

```bash
npm install @alaarab/ogrid-react
```

You typically don't need to install this directly — the UI packages (`@alaarab/ogrid-react-radix`, `@alaarab/ogrid-react-fluent`) re-export everything from this package.

```tsx
import { useOGrid, type IColumnDef } from '@alaarab/ogrid-react';
```

See the [OGrid docs](https://alaarab.github.io/ogrid/) for full documentation.

## Testing helpers

`@alaarab/ogrid-react/testing` ships reusable test factories. It needs `@testing-library/react` 16 (an optional peer), so unlike the main entry, which supports React 17, 18 and 19, it requires React 18 or later:

```tsx
import { createOGridTests } from '@alaarab/ogrid-react/testing';
```

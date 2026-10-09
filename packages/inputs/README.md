# @alaarab/ogrid-inputs

Framework-free helpers for OGrid's optional editors: calendar grids and date parsing, time options, star ratings, color parsing, slider math and tag parsing. No runtime dependencies.

```bash
npm install @alaarab/ogrid-inputs
```

```ts
import { clampRating, parseTags } from '@alaarab/ogrid-inputs';

console.log(clampRating(7, 5)); // 5
console.log(parseTags('red, green')); // ['red', 'green']
```

`@alaarab/ogrid-react-inputs` uses these helpers for its React editors. Install this package directly when building your own editor UI.

See the [editor guide](https://alaarab.github.io/ogrid/docs/features/premium-inputs). MIT licensed.

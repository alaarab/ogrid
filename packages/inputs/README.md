# @alaarab/ogrid-inputs

Framework-free helpers behind OGrid's premium cell editors: calendar grids and date parsing, time options, star ratings, color parsing, slider math, and tag parsing. Zero dependencies.

## Install

```bash
npm install @alaarab/ogrid-inputs
```

You usually don't install this directly. `@alaarab/ogrid-react-inputs` uses it for its React editors. Use it yourself if you're building editors on a different UI layer.

```typescript
import { getCalendarGrid, parseDate, getMinuteOptions, clampRating, parseTags } from '@alaarab/ogrid-inputs';
```

See the [OGrid docs](https://alaarab.github.io/ogrid/) for full documentation.

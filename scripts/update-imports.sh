#!/bin/bash

# Update imports in react-radix
find /home/alaarab/Sites/ogrid/packages/react-radix/src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d '' file; do
  sed -i "s|from '@alaarab/ogrid-core'|from '@alaarab/ogrid-react'|g" "$file"
  sed -i 's|from "@alaarab/ogrid-core"|from "@alaarab/ogrid-react"|g' "$file"
  sed -i "s|from '@alaarab/ogrid-core/testing'|from '@alaarab/ogrid-react/testing'|g" "$file"
  sed -i 's|from "@alaarab/ogrid-core/testing"|from "@alaarab/ogrid-react/testing"|g' "$file"
  sed -i "s|from '@alaarab/ogrid-core/storybook'|from '@alaarab/ogrid-react/storybook'|g" "$file"
  sed -i 's|from "@alaarab/ogrid-core/storybook"|from "@alaarab/ogrid-react/storybook"|g' "$file"
done

# Update imports in react-fluent
find /home/alaarab/Sites/ogrid/packages/react-fluent/src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d '' file; do
  sed -i "s|from '@alaarab/ogrid-core'|from '@alaarab/ogrid-react'|g" "$file"
  sed -i 's|from "@alaarab/ogrid-core"|from "@alaarab/ogrid-react"|g' "$file"
  sed -i "s|from '@alaarab/ogrid-core/testing'|from '@alaarab/ogrid-react/testing'|g" "$file"
  sed -i 's|from "@alaarab/ogrid-core/testing"|from "@alaarab/ogrid-react/testing"|g' "$file"
  sed -i "s|from '@alaarab/ogrid-core/storybook'|from '@alaarab/ogrid-react/storybook'|g" "$file"
  sed -i 's|from "@alaarab/ogrid-core/storybook"|from "@alaarab/ogrid-react/storybook"|g' "$file"
done

# Update imports in react-material
find /home/alaarab/Sites/ogrid/packages/react-material/src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d '' file; do
  sed -i "s|from '@alaarab/ogrid-core'|from '@alaarab/ogrid-react'|g" "$file"
  sed -i 's|from "@alaarab/ogrid-core"|from "@alaarab/ogrid-react"|g' "$file"
  sed -i "s|from '@alaarab/ogrid-core/testing'|from '@alaarab/ogrid-react/testing'|g" "$file"
  sed -i 's|from "@alaarab/ogrid-core/testing"|from "@alaarab/ogrid-react/testing"|g' "$file"
  sed -i "s|from '@alaarab/ogrid-core/storybook'|from '@alaarab/ogrid-react/storybook'|g" "$file"
  sed -i 's|from "@alaarab/ogrid-core/storybook"|from "@alaarab/ogrid-react/storybook"|g' "$file"
done

echo "Import updates complete!"

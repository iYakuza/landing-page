# Shared V/A layout components

Both Human Archive and Posts use the same section component renderer and the same layout tokens.

## Add a shared section

Inside a page's `<main data-vha-layout-root>`, author the section content inside a template:

```html
<template
  data-vha-component="section"
  data-vha-kind="hero"
  data-vha-classes="page-specific-theme-hook"
>
  <!-- Page-specific content -->
</template>
```

The shared `layout.js` turns the template into a real `<section>` before the page feature scripts run. The generated element receives the common `vha-layout-section` class and the appropriate layout-kind class. Page-specific classes are retained only for content and visual treatment.

Supported kinds:
- `hero` — uses the shared Human Archive hero spacing.
- `intro` — uses the shared Human Archive intro spacing.
- `records` — uses the shared records-section box model.

The `layout.css` file is the single source of truth for the main content width and the margin, border, and padding rules of these shared sections. Page stylesheets should style their content and visual variants, not redefine those box-model properties.

Load `layout.css` after page styles and `layout.js` after the main element but before page feature scripts.

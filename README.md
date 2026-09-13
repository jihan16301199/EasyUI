# EasyUI

A lightweight, deterministic UI pattern generator for Visual Studio Code.

EasyUI lets you define reusable HTML and SCSS patterns once in `component-map.json` and generate them consistently inside your project.

## Features

* Generate predefined UI patterns
* Generate HTML from a component map
* Generate SCSS using project-specific BEM conventions
* Detect surrounding BEM blocks
* Generate nested BEM components automatically
* No AI
* No API
* No internet connection required

## Example

Given a `button` pattern:

```html
<button class="__button">
  <div class="__button--icon">
    <svg>.....</svg>
  </div>
  <span class="__button--text">Button</span>
</button>
```

When generated inside a `card` block:

```html
<div class="card">
  <button class="card__button">
    <div class="card__button--icon">
      <svg>.....</svg>
    </div>
    <span class="card__button--text">Button</span>
  </button>
</div>
```

The corresponding SCSS is generated using nested BEM syntax:

```scss
.card {
  &__button {
    display: flex;

    &--icon {
      display: flex;
    }

    &--text {
    }
  }
}
```

## Configuration

Patterns are defined in:

```text
EasyUI/component-map.json
```

Example:

```json
{
  "button": {
    "tag": "button",
    "styles": {
      "display": "flex",
      "align-items": "center",
      "justify-content": "center",
      "gap": "8px"
    },
    "children": [
      {
        "name": "icon",
        "tag": "div",
        "content": "<svg>.....</svg>",
        "styles": {
          "display": "flex"
        }
      },
      {
        "name": "text",
        "tag": "span",
        "content": "Button",
        "styles": {}
      }
    ]
  }
}
```

## Usage

1. Open a project containing a `EasyUI/component-map.json`.
2. Place the cursor where the component should be generated.
3. Open the VS Code Command Palette.
4. Run:

```text
EasyUI: Generate
```

5. Select the desired UI pattern.

## Development

Compile the extension:

```bash
npm run compile
```

Package the extension:

```bash
npx vsce package
```

This produces a `.vsix` package that can be installed directly into Visual Studio Code.

## License

Private / Personal Use

# Contributing to Resonance

## Development Workflow

### Branch Naming
- `feature/description` — New features
- `fix/description` — Bug fixes
- `refactor/description` — Code refactoring
- `docs/description` — Documentation updates

### Commit Messages
Follow conventional commits:
```
feat: add new block type
canvas: improve drag-and-drop UX
fix: resolve simulation metrics display
refactor: extract simulation logic to hook
docs: update API documentation
```

### Code Style
- Use **ESLint** with the provided config
- Follow **Tailwind** utility-first approach
- Use **Zustand** for state management (no Redux)
- Prefer **functional components** with hooks

### Testing
```bash
# Run unit tests (Phase 2)
npm run test

# Run e2e tests (Phase 2)
npm run test:e2e
```

## Component Guidelines

### New UI Component
```jsx
// src/components/ui/MyComponent.jsx
import React from 'react'

export const MyComponent = ({ children, className = '', ...props }) => {
  return (
    <div className={`base-styles ${className}`} {...props}>
      {children}
    </div>
  )
}
```

### New Store
```js
// src/stores/myStore.js
import { create } from 'zustand'

export const useMyStore = create((set, get) => ({
  value: null,
  setValue: (value) => set({ value }),
}))
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear commits
3. Run `npm run lint` to ensure code quality
4. Update documentation if needed
5. Open a PR with a clear description
6. Request review from maintainers

## Questions?

Open an issue or reach out in discussions.

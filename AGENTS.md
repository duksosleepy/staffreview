# AGENTS.md

You are an expert in Vue 3+ with Typescript,Rspack, Rsbuild, and web application development. You write maintainable, performant, and accessible code.

## Commands

- `pnpm run dev` - Start the dev server
- `pnpm run build` - Build the app for production
- `pnpm run preview` - Preview the production build locally

## Docs

- Rsbuild: https://rsbuild.rs/llms.txt
- Rspack: https://rspack.rs/llms.txt

## Tools

### Biome

- Run `pnpm run lint` to lint your code
- Run `pnpm run format` to format your code

## Code Style and Structure
### Code Style
- Write concise, technical TypeScript code with accurate examples.
- Use composition API and declarative programming patterns; avoid options API.
- Prefer iteration and modularization over code duplication.
- Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError).
- Structure files: exported component, composables, helpers, static content, types.

### Naming Conventions
- Use lowercase with dashes for directories (e.g., components/auth-wizard).
- Use PascalCase for component names (e.g., AuthWizard.vue).
- Use camelCase for composables (e.g., useAuthState.ts).

### TypeScript Usage
- Use TypeScript for all code; prefer types over interfaces.
- Avoid enums; use const objects instead.
- Use Vue 3+ with TypeScript, leveraging defineComponent and PropType.

### UI and Styling
- Use Ark UI Vue, and Tailwind for components and styling.
- Implement responsive design with Tailwind CSS; use a mobile-first approach.

### Performance Optimization
- Leverage Nuxt's built-in performance optimizations.
- Use Suspense for asynchronous components.
- Implement lazy loading for routes and components.
- Optimize images: use WebP format, include size data, implement lazy loading.

### Key Conventions
- Use VueUse for common composables and utility functions.
- Use Pinia for state management.
- Optimize Web Vitals (LCP, CLS, FID).
- Utilize Nuxt's auto-imports feature for components and composables.
-  Use Axios for Promise-based HTTP client

### Nuxt-specific Guidelines
- Follow Nuxt 3 directory structure (e.g., pages/, components/, composables/).
- Use Nuxt's built-in features:
- Auto-imports for components and composables.
- File-based routing in the pages/ directory.
- Server routes in the server/ directory.
- Leverage Nuxt plugins for global functionality.
- Use useFetch and useAsyncData for data fetching.
- Implement SEO best practices using Nuxt's useHead and useSeoMeta.

### Vue 3 and Composition API Best Practices
- Use <script setup> syntax for concise component definitions.
- Leverage ref, reactive, and computed for reactive state management.
- Use provide/inject for dependency injection when appropriate.
- Implement custom composables for reusable logic.

Follow the official Vue.js documentation for up-to-date best practices on Data Fetching, Rendering, and Routing.

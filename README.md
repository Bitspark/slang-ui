# Slang UI — legacy Angular editor

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Bitspark/slang-design/a16912ee2938ad9202380c88ce486adf893e5ccf/assets/logo/slang-logo-dark.svg">
    <img src="https://raw.githubusercontent.com/Bitspark/slang-design/a16912ee2938ad9202380c88ce486adf893e5ccf/assets/logo/slang-logo-light.svg" alt="Slang" width="280">
  </picture>
</p>

> **This is the legacy editor.** It is the Angular 6 interface the Slang daemon
> served in 2018, kept as working source and as the pinned artifact that older
> standalone installations still install. It is **not** the current studio and is
> not where new editor work happens.
>
> The current studio is **[slang.run](https://slang.run/)**
> ([source](https://github.com/Bitspark/slang-studio)). Start at the
> [product website](https://slang.bitspark.com/) and its
> [quick start](https://slang.bitspark.com/slang-app/index-1/).

## What this is

Slang is a visual flow-based programming language. A program is built by placing
typed operators and connecting their ports, and is exchanged as YAML. This
repository holds the browser editor for that format: an operator list, a visual
graph editor, a YAML view, and run/stop controls that talk to the
[Slang daemon](https://github.com/Bitspark/slang) over its HTTP API.

The editor is served at `/app/` by the daemon, which is why the build sets
`--base-href /app/`. `src/environments/environment.ts` points development builds
at `http://localhost:5149`; production builds use the serving origin.

## Status and toolchain

Angular 6 with `node-sass` 4.x, pinned in `package-lock.json`. It does not build
on current Node releases, and the CircleCI pipeline that produced its releases
was retired. Treat the published
[`v0.2.5a` release](https://github.com/Bitspark/slang-ui/releases) as the artifact
in use: deployments install it by tag and SHA-256 rather than building from this
tree.

Source changes here therefore do not reach existing installations until someone
cuts a new release on a compatible toolchain. `ci/check_retired_links.py` runs on
every push and pull request and needs no Angular toolchain.

## Build

```sh
npm install
npm run build     # ng build --base-href /app/ --prod --output-path dist
```

`ci/package.py v0.2.5a` packages `dist/` into the release ZIP layout.

## Questions and problems

Use the [Slang issue tracker](https://github.com/Bitspark/slang/issues).

## Related

- [slang](https://github.com/Bitspark/slang) — language runtime, daemon and CLI
- [slang-studio](https://github.com/Bitspark/slang-studio) — current studio
- [slang-website](https://github.com/Bitspark/slang-website) — product website
- [slang-design](https://github.com/Bitspark/slang-design) — shared design system

Apache-2.0; see [LICENSE](LICENSE).

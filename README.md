# Prototuipe v2

This is the full rewrite of prototuipe, a webapp similar to GIMP for prototuipe.

The first version is great and I'm very proud of it. That said, its reliability and robustness is very surprising, considering the (lack of) design considerations and the overall code quality.

With this new version, I target:

- full compatibility and all the features of the previous version;
- cleaner codebase with the help of typescript;
- better touchpad support;
- mobile support?;
- improved performance when possible:
  - more performant use of canvas (especially in Chrome) and possibly WebGL;
  - lighter web page, by reducing the amount of dependencies and the size of assets.
- more features, namely:
  - custom fonts, which would've been hard to implement in the previous versions;
  - folder-like project structure;
  - saving history accross reloads;
  - in the future, project sharing.


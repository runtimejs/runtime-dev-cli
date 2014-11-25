## Runtime.JS developer CLI

#### INSTALL

```bash
npm install runtime-cli -g
runtime initconfig
```

Edit config file (runtime.js, cross compiler directory)
```bash
runtime editconfig  # the same as "vim ~/.runtimerc.toml"
```

```
# Runtime.js directory path
RuntimePath = "${HOME}/runtime"

# Cross compiler root path
CrossCompilerPath = "${HOME}/opt/cross"
```

#### COMPLETION

```bash

# bash
runtime completion >> ~/.bashrc

# zsh
runtime completion >> ~/.zshrc
```

#### USAGE

Example commands

```bash
runtime start
runtime start --build
runtime start --initrd
runtime start --net --kvm
runtime start --net --kvm --curses
runtime start --build --net --kvm --curses
runtime start --build --docker --net
runtime build
runtime build --docker
runtime initrd
runtime initrd --docker
```

Run `runtime` for usage info

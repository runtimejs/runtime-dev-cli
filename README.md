## Runtime.JS developer CLI

#### INSTALL

```bash
npm install runtime-cli -g
runtime-dev initconfig
```

Edit config file (runtime.js, cross compiler directory)
```bash
runtime-dev editconfig  # the same as "vim ~/.runtimerc.toml"
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
runtime-dev completion >> ~/.bashrc

# zsh
runtime-dev completion >> ~/.zshrc
```

#### USAGE

Example commands

```bash
runtime-dev start
runtime-dev start --build
runtime-dev start --initrd
runtime-dev start --net --kvm
runtime-dev start --net --kvm --curses
runtime-dev start --build --net --kvm --curses
runtime-dev start --build --docker --net
runtime-dev build
runtime-dev build --docker
runtime-dev initrd
runtime-dev initrd --docker
```

Run `runtime-dev` for usage info

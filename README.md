## Runtime.JS developer CLI

#### INSTALL

```bash
npm install runtime-cli -g
runtime initconfig
```

Edit config file (runtime.js, cross compiler directory)
```bash
vim ~/.runtimerc.toml
```

```
RuntimePath = "~/runtime"
CrossCompilerPath = "~/opt/cross"
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

import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const originalExec = childProcess.exec;
childProcess.exec = function patchedExec(command, options, callback) {
  if (command === "net use") {
    queueMicrotask(() => callback?.(null, "", ""));
    return { on() { return this; }, kill() {}, unref() {} };
  }
  return originalExec.call(this, command, options, callback);
};
const nativeRealpath = fs.realpathSync.native;
Object.defineProperty(fs.realpathSync, "native", {
  configurable: true,
  value(target, options) {
    if (path.resolve(String(target)) === path.resolve(process.cwd())) {
      throw new Error("EISDIR: illegal operation on a directory, realpath");
    }
    return nativeRealpath(target, options);
  },
});

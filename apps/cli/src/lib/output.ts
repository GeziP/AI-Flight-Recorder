const colors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

export function success(msg: string): void {
  console.log(`${colors.green('success')} ${msg}`);
}

export function info(msg: string): void {
  console.log(`${colors.cyan('info')}    ${msg}`);
}

export function warn(msg: string): void {
  console.log(`${colors.yellow('warn')}   ${msg}`);
}

export function error(msg: string): void {
  console.error(`${colors.red('error')}  ${msg}`);
}

export function header(text: string): void {
  console.log(`\n${colors.bold(text)}`);
  console.log(colors.dim('─'.repeat(text.length)));
}

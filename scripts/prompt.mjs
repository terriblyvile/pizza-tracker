const KEY_ENTER = ['\r', '\n'];
const KEY_EOF = '\u0004'; // Ctrl-D
const KEY_INTERRUPT = '\u0003'; // Ctrl-C
const KEY_BACKSPACE = ['\u007f', '\b'];

export const MIN_LENGTH = 10;

/**
 * Reads a line from the terminal, echoing '*' instead of the characters typed.
 *
 * Uses raw mode rather than readline: readline redraws its line on every
 * keystroke, which erases a prompt written directly to stdout.
 *
 * @throws {Error} with message 'not-a-tty' when there's no interactive terminal.
 */
export function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;

    if (!stdin.isTTY) {
      reject(new Error('not-a-tty'));
      return;
    }

    // Raw mode first: it disables terminal echo, and anything typed between
    // printing the prompt and enabling it would otherwise appear in the clear.
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdout.write(question);

    let value = '';

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
    };

    function onData(chunk) {
      // A chunk can hold several characters at once, e.g. when pasting.
      for (const char of chunk) {
        if (KEY_ENTER.includes(char) || char === KEY_EOF) {
          cleanup();
          stdout.write('\n');
          resolve(value);
          return;
        }

        if (char === KEY_INTERRUPT) {
          cleanup();
          stdout.write('\n');
          process.exit(130);
        }

        if (KEY_BACKSPACE.includes(char)) {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }

        // Skip any remaining control characters (arrow keys, tab, escape).
        if (char >= ' ') {
          value += char;
          stdout.write('*');
        }
      }
    }

    stdin.on('data', onData);
  });
}

/** Reads a single line from piped stdin, for non-interactive use. */
export function readPipedLine() {
  return new Promise((resolve, reject) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
    });
    process.stdin.on('end', () => resolve(buffer.split('\n')[0]));
    process.stdin.on('error', reject);
  });
}

/**
 * Collects a password, either interactively (with confirmation) or from a pipe
 * when `--stdin` is passed. Exits the process with a message on any problem.
 */
export async function collectPassword({ commandHint = '<command>' } = {}) {
  const useStdin = process.argv.includes('--stdin');
  let password;

  if (useStdin) {
    password = (await readPipedLine()).trim();
  } else {
    try {
      password = await promptHidden('New password: ');
    } catch (error) {
      if (error.message === 'not-a-tty') {
        console.error('\nThis needs an interactive terminal. Run it in a terminal, or pipe:');
        console.error(`  printf 'your-password\\n' | ${commandHint} -- --stdin\n`);
        process.exit(1);
      }
      throw error;
    }
  }

  if (password.length < MIN_LENGTH) {
    console.error(
      `\nToo short — use at least ${MIN_LENGTH} characters. This app will be reachable from the internet.`,
    );
    process.exit(1);
  }

  if (!useStdin) {
    const confirmation = await promptHidden('Confirm password: ');
    if (password !== confirmation) {
      console.error('\nThose did not match. Nothing was changed.');
      process.exit(1);
    }
  }

  return password;
}

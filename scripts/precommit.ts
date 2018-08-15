import { EOL } from "os";
import { extname, join } from "path";
import { exec } from "shelljs";

/**
 * Determines all staged files
 * @returns Array with the staged files
 */
function getStagedFiles(): string[] {
	const childProcess = exec("git diff --cached --name-only --diff-filter=ACM", { silent: true });
	if (childProcess.stderr !== "") {
		throw new Error(`Can't get staged files:${EOL}${childProcess.stderr}`);
	}

	return childProcess.stdout.toString().trim().split(/\r?\n/);
}

/**
 * Lints all passed files and prints linting errors to the console.
 * @param stagedFiles Files to lint
 * @throws Error if linter errors occurred
 */
function lintFiles(stagedFiles: string[]) {
	console.log(`Running TSLint`);
	let result = true;
	const tsLintPath = join(process.cwd(), "node_modules", ".bin", "tslint");

	for (const stagedFile of stagedFiles) {
		if (extname(stagedFile) === ".ts") {
			const childProcess = exec(`${tsLintPath} ${stagedFile}`, { silent: true });
			if (childProcess.stderr !== "") {
				throw new Error(`Error occurred while executing tslint:${EOL}${childProcess.stderr}`);
			}

			const lintResult = childProcess.stdout.toString().trim();
			if (lintResult === "") {
				// no error occurred
				console.log("\x1b[32m%s\x1b[0m", `${EOL}${stagedFile}: Succeeded${EOL}`);
			} else {
				// error occurred. print out the lint result
				console.log("\x1b[31m%s\x1b[0m", `${EOL}${stagedFile}: Failure`);
				console.log(lintResult);
				result = false;
			}
		}
	}

	if (!result) {
		throw new Error("There are linter errors in your staged files. Fix these errors and try again");
	}
}

try {
	const stagedFiles = getStagedFiles();

	lintFiles(stagedFiles);
} catch (err) {
	console.error(`err.message${EOL.repeat(2)}`);
	process.exit(1);
}

/**
 * @file These file contains configuration properties for running the tests against a live system or the
 *       mocked JANUS system. It's recommended to setup the livesystem as described here to ensure that no
 *       tests will fail. If tests fail please check if it's not caused by your live system before making changes.
 */

/** Default server to connect with */
export const HOST = "127.0.0.1";

/** Port the server is listening on */
export const PORT = 11001;

/** An existing principal */
export const TEST_PRINCIPAL = "test";

/** A user which can be used to login with */
export const ADMIN_USER = "admin";

/** The passwort of the TEST_USER */
export const ADMIN_USER_PASS = "test123";

/** A fellow registered in the passed principal */
export const TEST_FELLOW = "test";

/** The password of the fellow */
export const TEST_FELLOW_PASS = "test";

/**
 * Return true if you run the test against a live system
 */
export function isLiveMode(): boolean {
	// @ts-ignore
	return HOST !== "localhost" && PORT !== 11001;
}

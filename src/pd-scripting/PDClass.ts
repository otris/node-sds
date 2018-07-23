import { crypt_md5, Hash } from "../cryptmd5";
import { SDSConnection } from "../sds/SDSConnection";
import { Operations, ParameterNames } from "../sds/SDSMessage";
import { SDSRequest } from "../sds/SDSRequest";

/** Id of a logged in user */
export type UserId = number;

export class PDClass {
	/** Salt for hashing passwords before sending them to the JANUS-server */
	public static JANUS_CRYPTMD5_SALT: string = "o3";

	/** The initialized sds connection */
	private sdsConnection: SDSConnection;

	constructor(sdsConnection: SDSConnection) {
		this.sdsConnection = sdsConnection;
	}

	/**
	 * Changes the principal which the client is connected to
	 * @param principal Name of the principal
	 */
	public changePrincipal(principal: string): Promise<void> {
		return new Promise<void>(async (resolve, reject) => {
			const request = new SDSRequest();
			request.operation = Operations.CHANGE_PRINCIPAL;
			request.addParameter(ParameterNames.PRINCIPAL, principal);

			const response = await this.sdsConnection.send(request);
			const result = response.getParameter(ParameterNames.RETURN_VALUE) as number;
			if (result === 0) {
				resolve();
			} else {
				const errorMessage = await this.sdsConnection.PDMeta.getString(result);
				reject(new Error(`Unable to change principal to ${principal}: ${errorMessage}\r\nError code: ${result}`));
			}
		});
	}

	/**
	 * Changes the user which is logged in
	 * @param login Login of the user
	 * @param password password of the user or hashed MD5-value of the password
	 * @returns The id of the user
	 */
	public changeUser(login: string, password: string | Hash): Promise<UserId> {
		return new Promise(async (resolve, reject) => {
			const hashedPassword: string = (password instanceof Hash)
				? password.value
				:
				(password === "") // When the password is an empty string, don't hash it
					? ""
					: crypt_md5(password, PDClass.JANUS_CRYPTMD5_SALT).value;

			const request = new SDSRequest();
			request.operation = Operations.CHANGE_USER;
			request.addParameter(ParameterNames.USER, login);
			request.addParameter(ParameterNames.PASSWORD, hashedPassword);

			const response = await this.sdsConnection.send(request);
			const result = response.getParameter(ParameterNames.RETURN_VALUE) as number;
			if (result === 0) {
				resolve(response.getParameter(ParameterNames.USER_ID));
			} else {
				// Error occurred. Get the error message from the server
				const errorMessage = await this.sdsConnection.PDMeta.getString(result);
				reject(new Error(`Change user request failed: ${errorMessage}`));
			}
		});
	}
}

import { expect } from "chai";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SDSConnection } from "../../src/sds/SDSConnection";
import { HOST, PORT } from "../env.test";
import { MockedJanusServer } from "../MockedJanusServer";

chai.use(chaiAsPromised);

describe("Tests for the connection handler for the communication with the JANUS-server", () => {
	// For the unit tests we need to mock a JANUS-server that sends back meaningful and
	// correct responses to incoming requests
	const mockedJANUSServer = new MockedJanusServer();

	before(async () => {
		await mockedJANUSServer.init();
	});

	it("should connect successfully", () => {
		const sdsConnection = new SDSConnection();
		return expect(sdsConnection.connect("sdsConnection.test", HOST, PORT)).to.not.be.eventually.rejected;
	});

	it("should fail to connect", () => {
		const sdsConnection = new SDSConnection();

		// on this port no server is running
		const invalidPort = (PORT + 10);
		return expect(sdsConnection.connect("test123", HOST, invalidPort))
			.to.be.eventually.rejectedWith(Error)
			.and.have.property("message")
			.which.matches(new RegExp(`Unhandled error ocurred: The TCP-connection failed: connect (ECONNREFUSED|ETIMEDOUT) ${HOST}:${invalidPort}`));
	});

	it("should return a client id on connect", async () => {
		const sdsConnection = new SDSConnection();
		const clientId: number = await sdsConnection.connect("sdsConnection.test", HOST, PORT);
		expect(clientId).to.be.a("number");
	});

	after(() => {
		mockedJANUSServer.close();
	});
});

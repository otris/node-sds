[![Build Status](https://travis-ci.org/otris/node-sds.svg?branch=master)](https://travis-ci.org/otris/node-sds)

# node-sds
A Node.js module to communicate with JANUS-generated applications. Written in
TypeScript.

## Installation
In your project, run
```bash
$ yarn add git+https://git@github.com/otris/node-sds.git#1.0.0
```

or, if you're using npm, run
```bash
$ npm install --save git+https://git@github.com/otris/node-sds.git#1.0.0
```
Note that there is no npm package. You should always just use the **latest**
release tag if in doubt.

## Current status
This module does not support all SDS operations and calls. Only the pieces we
needed to get along. There is probably still plenty missing. But it should not
be terribly complicated to add support for those pieces.

## Contribute
If you want to hack on this module you could start with following recipe:

```bash
$ git clone https://github.com/otris/node-sds.git  # Clone the repo
$ cd node-sds  #  Change into the source directory
$ npm install  # or preferably yarn install
$ npm run --silent test  # Execute all tests
```

Note: If you prefer to use npm instead of yarn, you have to update the package-lock.json file first. To do so, run
```bash
$ npm run generate-package-lock
```

and reinstall the dependencies. The package-lock file will only be generated once a new release gets published.

**Please always run all tests against a live system before you push a PR!!!**   
Happy hacking!

### Testing
There are several tests for this API. The tests run against a mocked JANUS-server to verify that the generated SDSRequests are valid
and the responses are correctly parsed. However, it's often necessary to run the test against a real live system. You can do this
by changing the environment settings in the [test configuration](test/env.test.ts).
Enter the system informations of your system in this file and run the tests. Please read the header informations inside the config file.

## About SDS
SDS (or SDS2) is a synchronous binary application-layer protocol on top of TCP
that "real" JANUS clients use to speak to JANUS servers.

The protocol follows the [CORBA](https://en.wikipedia.org/wiki/Common_Object_Request_Broker_Architecture) architecture. You can execute several operations on
a remote server. Those operations can have an arbitrary number of parameters
and usually return something back.

The protocol is quite old, cumbersome, and it is easy to make mistakes.
Therefore you probably should just not use it at all. However, it gives you
direct access to any JANUS-based server without the need to install additional
SOAP or web service components.

<!-- vim: et sw=4 ts=4:
-->
